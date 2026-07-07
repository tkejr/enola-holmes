import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// RevenueCat -> Supabase webhook. Credits coins for consumable purchases and the
// monthly subscription grant. Idempotent: add_coins dedupes on the RC transaction id.
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
  const GRANTING = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL']
  if (!GRANTING.includes(event.type)) {
    return new Response('ignored', { status: 200 })
  }

  const userId: string | undefined = event.app_user_id
  const productId: string | undefined = event.product_id
  const amount = productId ? COIN_GRANTS[productId] : undefined

  // Idempotency key: prefer the real transaction_id. Fall back to event id only if
  // absent (and warn) — a changing fallback key is the one way a double-credit could
  // slip through, so we want visibility if it ever happens.
  const txnId: string | undefined = event.transaction_id ?? event.id
  if (!event.transaction_id) {
    console.warn('event missing transaction_id, using event.id as dedupe key', { type: event.type, id: event.id })
  }
  const externalId = txnId

  if (!userId || !amount || !externalId) {
    console.warn('skip event', { type: event.type, userId, productId, txnId })
    return new Response('skipped', { status: 200 })
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
    : event.type === 'RENEWAL' || productId?.startsWith('enola_pro_') ? 'subscription' : 'coin_pack_purchase'
  const { data, error } = await supabase.rpc('add_coins', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_external_id: externalId,
  })

  if (error) {
    console.error('add_coins failed', error)
    return new Response('error', { status: 500 }) // 5xx -> RC retries
  }

  console.log('credited', { userId, amount, externalId, newBalance: data })
  return new Response('ok', { status: 200 })
})
