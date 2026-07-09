import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// RevenueCat -> Supabase webhook. Credits coins for consumable purchases, subscription
// grants (INITIAL_PURCHASE/RENEWAL), and pre-signup subscriptions reconciled on TRANSFER.
// Idempotent: add_coins dedupes on the external id. Subscriptions and their transfers
// share one key format (see makeSubKey) so the same period is never credited twice;
// coin packs key on the raw store transaction id.
//
// Product id -> coins granted. Server-authoritative: never trust a client-sent amount.
const COIN_GRANTS: Record<string, number> = {
  enola_coins_1: 1,
  enola_coins_5: 5,
  enola_coins_10: 10,
  enola_coins_25: 25,
  enola_coins_50: 50,
  enola_coins_100: 100,
  enola_pro_monthly: 15,  // 15 coins per month on INITIAL_PURCHASE + each RENEWAL
  enola_pro_yearly: 120,  // 120 coins per year on INITIAL_PURCHASE + each RENEWAL
}

// TRANSFER: RC moved a purchase from an anonymous id to the real app_user_id after
// the app called Purchases.logIn (our paywall runs BEFORE signup, so the subscription
// bought there is always anonymous until login).
//
// This is the ONLY event that fires when a pre-signup subscription becomes the real
// user's. RENEWAL does NOT re-fire on transfer — it only fires at the next billing
// period (a month/year away), so waiting for it means the user gets the `pro`
// entitlement but zero coins until then. So we must credit the initial grant HERE.
//
// The TRANSFER payload carries no product_id or transaction_id (only the two
// app_user_ids), so we call RC's REST API for the transferred_to subscriber to read
// which subscription(s) they now own, then credit off each product id.
//
// DEDUPE KEY — must match the webhook path so a subscription is never credited twice:
// we key on `${productId}:${store_transaction_id}`. For a subscription bought on the
// onboarding paywall (the only thing that ever transfers here) the sub has NEVER
// renewed, so store_transaction_id IS the original store transaction id — the exact
// value the webhook's INITIAL_PURCHASE path keys on (see makeSubKey below). So if RC
// ever also delivered an INITIAL_PURCHASE for the same period under the real id, or the
// TRANSFER is retried, add_coins no-ops. A future RENEWAL is a new period with a new
// store transaction id, so it credits correctly (new month = new coins).
async function handleTransfer(event: any, supabase: any): Promise<Response> {
  const userId: string | undefined = event.transferred_to
  const apiKey = Deno.env.get('REVENUECAT_REST_API_KEY')
  console.log('transfer received', { id: event.id, to: userId, from: event.transferred_from })

  // Guard the cases where we can't (or shouldn't) credit. Anonymous target = the
  // purchase moved to yet another anonymous id; a real RENEWAL/login credits it later.
  if (!userId || userId.startsWith('$RCAnonymousID')) {
    return new Response('transfer-acked-anon', { status: 200 })
  }
  if (!apiKey) {
    // Without the REST key we can't read what was transferred. 5xx so RC retries once
    // the secret is set, rather than silently dropping the grant.
    console.error('REVENUECAT_REST_API_KEY not set; cannot credit transfer')
    return new Response('missing-rest-key', { status: 500 })
  }

  let subscriber: any
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    if (!res.ok) {
      console.error('RC subscriber fetch failed', { status: res.status, userId })
      return new Response('rc-fetch-failed', { status: 500 }) // retry
    }
    subscriber = (await res.json()).subscriber
  } catch (e) {
    console.error('RC subscriber fetch error', e)
    return new Response('rc-fetch-error', { status: 500 }) // retry
  }

  // Credit every subscription this user owns that maps to a coin grant. Your test
  // (bought monthly AND yearly) lands both here as separate product keys — each gets
  // its own store_transaction_id, so both credit, once each.
  const subs: Record<string, any> = subscriber?.subscriptions ?? {}
  let creditedAny = false
  for (const [productId, sub] of Object.entries(subs)) {
    const amount = COIN_GRANTS[productId]
    const txnId: string | undefined = sub?.store_transaction_id
    if (!amount || !txnId) continue

    const externalId = makeSubKey(productId, txnId)
    const { error } = await supabase.rpc('add_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: 'subscription',
      p_external_id: externalId,
    })
    if (error) {
      if (typeof error.message === 'string' && error.message.includes('not found') && error.message.includes('profile')) {
        console.warn('transfer credit: profile not found, acking', { userId, externalId })
        return new Response('skipped-no-profile', { status: 200 })
      }
      console.error('transfer add_coins failed', error)
      return new Response('error', { status: 500 }) // retry
    }
    console.log('transfer credited', { userId, productId, amount, externalId })
    creditedAny = true
  }

  if (!creditedAny) console.log('transfer: no coin-granting subscription found', { userId })
  return new Response('transfer-ok', { status: 200 })
}

// One dedupe-key format shared by the TRANSFER path and the subscription webhook path.
// `${productId}:${storeTransactionId}` — the store transaction id is per-period, so
// renewals (new txn id) credit separately while retries/transfers of the SAME period
// collapse to one credit. productId is prefixed only for readability in the ledger.
function makeSubKey(productId: string, storeTransactionId: string): string {
  return `${productId}:${storeTransactionId}`
}

serve(async (req) => {
  // Auth: RC sends the shared secret in the Authorization header. Reject anything else.
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH')
  if (!expected || req.headers.get('Authorization') !== expected) {
    return new Response('unauthorized', { status: 401 })
  }

  let event: any
  try {
    ({ event } = await req.json())
  } catch {
    return new Response('bad request', { status: 400 })
  }
  if (!event) return new Response('no event', { status: 400 })

  // Events that GRANT coins. There is NO clawback: once paid, coins are the user's
  // forever. Cancelling a subscription only stops future renewals (the user keeps the
  // period they paid for). Refunds are never honored coin-side — CANCELLATION /
  // EXPIRATION / refunds are all ignored on purpose. Product decision: no coin refunds.
  //
  // PRODUCT_CHANGE is deliberately NOT here. A plan switch does not start a new paid
  // period — the App Store defers/prorates it, and the coins for the plan they moved TO
  // arrive on the NEXT RENEWAL (which fires with new_product_id + a real transaction_id
  // and credits correctly). Granting on PRODUCT_CHANGE would either double-credit or,
  // worse, let a user farm coins by toggling plans (each toggle is a distinct event so
  // any per-event dedupe key never trips). So we ignore it and let RENEWAL do the work.
  //
  // TRANSFER moves an existing purchase from one app_user_id to another (anon -> real,
  // after the app calls Purchases.logIn). It is handled separately (handleTransfer):
  // it's the ONLY event that fires when a pre-signup subscription becomes the real
  // user's, so the initial subscription grant is credited there, not here.
  const GRANTING = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL']
  if (event.type === 'TRANSFER') {
    return await handleTransfer(event, createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ))
  }
  if (!GRANTING.includes(event.type)) {
    return new Response('ignored', { status: 200 })
  }

  const userId: string | undefined = event.app_user_id
  const productId: string | undefined = event.product_id
  const amount = productId ? COIN_GRANTS[productId] : undefined
  const isSub = productId?.startsWith('enola_pro_')

  // Idempotency key. For subscriptions we use the SAME format as the TRANSFER path
  // (`product:store_transaction_id` via makeSubKey), so a subscription bought pre-login
  // and credited on TRANSFER can never also be credited by a stray INITIAL_PURCHASE for
  // the same period — both compute the identical key and add_coins dedupes.
  //
  // A subscription event MUST have transaction_id to build a key that matches the
  // TRANSFER path. If it's ever missing, event.id (a per-delivery UUID) can't collide
  // with the TRANSFER credit → double-credit risk. So for subs we do NOT fall back:
  // 5xx and let RC retry (transaction_id is essentially always present, so this is a
  // never-in-practice guard, not a real drop). Coin packs don't transfer and can safely
  // fall back to event.id.
  if (isSub && !event.transaction_id) {
    console.error('subscription event missing transaction_id; refusing unkeyed credit', { type: event.type, id: event.id })
    return new Response('missing-transaction-id', { status: 500 })
  }
  const txnId: string | undefined = event.transaction_id ?? event.id
  if (!event.transaction_id) {
    console.warn('coin-pack event missing transaction_id, using event.id as dedupe key', { type: event.type, id: event.id })
  }
  const externalId: string | undefined =
    isSub && productId && txnId ? makeSubKey(productId, txnId) : txnId

  if (!userId || !amount || !externalId) {
    console.warn('skip event', { type: event.type, userId, productId, externalId })
    return new Response('skipped', { status: 200 })
  }

  // Anonymous RC id ($RCAnonymousID:...) has no profile row — a purchase made before
  // the app called Purchases.logIn(supabaseUid). Don't credit it (there's no real user
  // yet). When the app logs in, RC fires a TRANSFER moving this purchase to the real
  // app_user_id, and handleTransfer credits the initial grant there (RENEWAL does NOT
  // re-fire on transfer — it's a billing-period event, a month/year away).
  if (userId.startsWith('$RCAnonymousID')) {
    console.log('skip anonymous user (renewal credits under real id after login)', { type: event.type, externalId })
    return new Response('skipped-anonymous', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // A non-empty `offer_code` means the user redeemed an App Store offer/promo code.
  // That flag wins over the product type — a code is a code whatever it discounts.
  // Excludes RENEWAL: RC echoes the original offer_code on paid renewals, but a
  // renewal is a recurring charge, not a fresh redemption, so it stays `subscription`.
  const redeemedCode = event.type !== 'RENEWAL' && typeof event.offer_code === 'string' && event.offer_code.trim() !== ''
  const reason = redeemedCode
    ? 'coupon_redemption'
    : event.type === 'RENEWAL' || isSub ? 'subscription' : 'coin_pack_purchase'
  const { data, error } = await supabase.rpc('add_coins', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_external_id: externalId,
  })

  if (error) {
    // "profile not found" isn't retryable — the row won't appear by retrying, so a 500
    // just wedges RC's queue. Ack it (200) and log. Real transient failures (DB down)
    // still 5xx so RC retries.
    if (typeof error.message === 'string' && error.message.includes('not found') && error.message.includes('profile')) {
      console.warn('add_coins: profile not found, acking', { userId, externalId })
      return new Response('skipped-no-profile', { status: 200 })
    }
    console.error('add_coins failed', error)
    return new Response('error', { status: 500 }) // 5xx -> RC retries
  }

  console.log('credited', { userId, amount, externalId, newBalance: data })
  return new Response('ok', { status: 200 })
})
