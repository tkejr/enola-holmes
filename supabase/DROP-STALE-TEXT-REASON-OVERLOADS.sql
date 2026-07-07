-- Post-migration cleanup after RENAME-REASONS-ENUM-DROP-SOURCE.sql.
-- Fixes the `spend_failed` face-search error and closes related enum gaps.
--
-- NOT wrapped in a transaction: `ALTER TYPE ... ADD VALUE` (below) can't run inside
-- a txn block. Every statement is independently idempotent, so partial/re-runs are safe.

-- 1. Drop the stale TEXT-signature RPC overloads.
--    The rename migration used CREATE OR REPLACE to re-type `p_reason` from TEXT to
--    coin_reason. Postgres can't change an arg type that way — it created a SECOND
--    overload instead of replacing. So spend_coin ended up with both (INTEGER, TEXT)
--    and (INTEGER, coin_reason). A PostgREST call with a bare string reason ('scan')
--    matches both → PGRST203 (ambiguous, HTTP 300) → spend_coin returns null →
--    face-search reports `spend_failed`. Dropping the TEXT overload leaves one match.
--    (add_coins/remove_coins already show only the coin_reason overload in prod, so
--    those two DROPs are no-ops — kept for safety / other environments.)
DROP FUNCTION IF EXISTS public.spend_coin(INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.add_coins(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.remove_coins(UUID, INTEGER, TEXT, TEXT);

-- 2. Add the enum value the deployed webhook already depends on.
--    revenuecat-webhook passes p_reason = 'coupon_redemption' when an App Store
--    offer code is redeemed. That value is NOT in the enum created by the rename
--    migration, so every code redemption fails add_coins with 22P02 → webhook 500 →
--    RevenueCat retries forever and the user never gets coins. (Supersedes the
--    standalone ADD-COUPON-REDEMPTION-REASON.sql — delete that file once this runs.)
ALTER TYPE public.coin_reason ADD VALUE IF NOT EXISTS 'coupon_redemption';

-- 3. Drop the orphaned record_search_and_deduct_coin: it still INSERTs into the
--    now-dropped `source` column and was NOT re-created by the rename migration, so
--    it would fail if ever called. Nothing calls it today (the live scan path spends
--    server-side in the face-search edge function via spend_coin), but leaving a
--    guaranteed-to-fail RPC around is a landmine. Drop all known signatures.
DROP FUNCTION IF EXISTS public.record_search_and_deduct_coin(UUID, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.record_search_and_deduct_coin(UUID, TEXT, INTEGER);
