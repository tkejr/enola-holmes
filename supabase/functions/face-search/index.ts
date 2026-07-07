import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// FaceCheck.id proxy. The API token lives ONLY here as a server secret
// (FACECHECK_API_TOKEN) so it never ships in the app bundle. The client sends the
// image bytes; we attach the token and forward to FaceCheck, then poll for results.
//
// Set the secret with:
//   supabase secrets set FACECHECK_API_TOKEN=... FACECHECK_DEMO=false
//
// FACECHECK_DEMO=true uses FaceCheck's demo mode (no credits, inaccurate results).
// Leave it false/unset in production.

const FACECHECK_SITE = 'https://facecheck.id'
const TOKEN = Deno.env.get('FACECHECK_API_TOKEN') ?? ''
const DEMO = Deno.env.get('FACECHECK_DEMO') === 'true'

// Supabase — used to spend/refund a coin server-side so the search can't be run for free.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Call spend_coin AS THE CALLING USER (forward their JWT). auth.uid() inside the RPC
// resolves to that user, so the atomic check+deduct+ledger you already have is reused.
// Returns the new balance, -1 if insufficient, or null on error.
async function spendCoin(userJwt: string): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/spend_coin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${userJwt}`,
    },
    body: JSON.stringify({ p_amount: 1, p_reason: 'scan' }),
  })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as number | null
}

// Refund via add_coins — users are revoked from it, so this uses the service_role key.
// p_external_id ties the refund to the specific search: add_coins dedupes on
// external_id, so a retried/duplicated call for the same search can't double-credit.
// Falls back to no key only if the search never got an id (upload failed before
// id_search existed) — at most one refund fires per request anyway.
async function refundCoin(userId: string, idSearch: string | null): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_coins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_amount: 1,
      p_reason: 'scan_refund',
      p_external_id: idSearch,
    }),
  }).catch(() => {}) // best-effort; a failed refund must not mask the original error
}

// Decode a JWT payload without verifying (the platform already verified it before we run).
// We only need the user id (sub) and to reject the anon key, which has role="anon".
function userFromJwt(jwt: string): { id: string } | null {
  try {
    const [, payload] = jwt.split('.')
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.role !== 'authenticated' || !claims.sub) return null
    return { id: claims.sub }
  } catch {
    return null
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  if (!TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
    console.error('missing FACECHECK_API_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'server_not_configured' }, 500)
  }

  // Require a real signed-in user, NOT the anon key. The anon key is public (it ships in
  // the app bundle), so without this anyone could script this endpoint and spend our
  // FaceCheck credits for free. Reject anything that isn't an authenticated-role JWT.
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const user = userFromJwt(jwt)
  if (!user) {
    return json({ error: 'unauthorized' }, 401)
  }

  // The client posts multipart form-data with an `images` file field.
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'expected multipart form-data with an images field' }, 400)
  }
  const image = form.get('images')
  if (!(image instanceof File)) {
    return json({ error: 'missing images file' }, 400)
  }

  // Charge the coin up front, atomically, as this user. If they have none, stop here
  // BEFORE spending a FaceCheck credit. Any FaceCheck failure below refunds the coin.
  const balance = await spendCoin(jwt)
  if (balance === null) return json({ error: 'spend_failed' }, 500)
  if (balance === -1) return json({ error: 'insufficient_coins' }, 402)

  // Everything past the charge: any error/timeout refunds the coin exactly once, so a
  // FaceCheck failure never costs the user. Success returns the items and keeps the coin.
  // Hoisted so the catch can pass it as the refund's dedupe key.
  let idSearch: string | null = null
  try {
    // Step 1: upload the image to FaceCheck.
    const uploadBody = new FormData()
    uploadBody.append('images', image, image.name || 'photo.jpg')

    const uploadRes = await fetch(`${FACECHECK_SITE}/api/upload_pic`, {
      method: 'POST',
      headers: { accept: 'application/json', Authorization: TOKEN },
      body: uploadBody,
    })
    const uploadData = await uploadRes.json().catch(() => null)
    if (!uploadData || uploadData.error) {
      throw { error: uploadData?.error ?? 'upload_failed', code: uploadData?.code }
    }
    idSearch = uploadData.id_search
    if (!idSearch) throw { error: 'no_search_id' }

    // Step 2: poll for results (up to ~2 min). Server-side polling keeps the token here.
    const MAX_ATTEMPTS = 120
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const searchRes = await fetch(`${FACECHECK_SITE}/api/search`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          Authorization: TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_search: idSearch,
          with_progress: true,
          status_only: false,
          demo: DEMO,
        }),
      })
      const searchData = await searchRes.json().catch(() => null)
      if (!searchData) throw { error: 'invalid_search_response' }
      if (searchData.error) throw { error: searchData.error, code: searchData.code }

      if (searchData.output?.items) {
        return json({ items: searchData.output.items }) // success — coin stays spent
      }

      // still processing — wait a second before the next poll
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw { error: 'search_timeout' }
  } catch (err) {
    await refundCoin(user.id, idSearch)
    const e = err as { error?: string; code?: string }
    return json({ error: e?.error ?? 'search_failed', code: e?.code, refunded: true }, 200)
  }
})
