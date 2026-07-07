-- Atomic coin operations + IAP idempotency ledger.
-- Idempotent: safe to re-run. Run in Supabase SQL editor or `supabase db push`.

-- Ledger of every coin change. Doubles as the idempotency guard for IAP:
-- (source, external_id) is UNIQUE, so a replayed webhook can't credit twice.
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,          -- +credit / -spend
  reason       TEXT NOT NULL,             -- 'purchase' | 'scan' | 'subscription_grant' | ...
  source       TEXT NOT NULL DEFAULT 'app', -- 'revenuecat' | 'app'
  external_id  TEXT,                      -- Apple/RC transaction id (null for in-app spends)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coin_txn_dedupe
  ON public.coin_transactions (source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own txns" ON public.coin_transactions;
CREATE POLICY "own txns" ON public.coin_transactions
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT policy: rows are written only by SECURITY DEFINER functions / service role.

-- Atomic credit. Used by the webhook (service role). Idempotent when p_external_id is given.
-- Returns the new balance, or the existing balance if this txn was already applied.
CREATE OR REPLACE FUNCTION public.add_coins(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      TEXT DEFAULT 'purchase',
  p_source      TEXT DEFAULT 'revenuecat',
  p_external_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  -- Dedupe: if we've already recorded this external txn, no-op and return current balance.
  IF p_external_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE source = p_source AND external_id = p_external_id
  ) THEN
    RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
  END IF;

  UPDATE public.profiles
    SET coins = coins + p_amount, updated_at = now()
    WHERE id = p_user_id
    RETURNING coins INTO v_new;

  IF v_new IS NULL THEN RAISE EXCEPTION 'profile % not found', p_user_id; END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, source, external_id)
    VALUES (p_user_id, p_amount, p_reason, p_source, p_external_id);

  RETURN v_new;
END; $$;

-- Refund clawback. Called by the webhook (service role) on an Apple refund.
-- Deducts the previously-granted coins, allowing the balance to go NEGATIVE so a
-- user can't buy -> spend -> refund and keep the value. Idempotent by (source,
-- external_id): a replayed refund event won't claw back twice. Returns new balance.
CREATE OR REPLACE FUNCTION public.remove_coins(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      TEXT DEFAULT 'refund',
  p_source      TEXT DEFAULT 'revenuecat',
  p_external_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  -- Dedupe on the refund's own external id (distinct from the purchase's).
  IF p_external_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE source = p_source AND external_id = p_external_id
  ) THEN
    RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
  END IF;

  -- No coins >= floor here: refunds may legitimately push the balance negative.
  UPDATE public.profiles
    SET coins = coins - p_amount, updated_at = now()
    WHERE id = p_user_id
    RETURNING coins INTO v_new;

  IF v_new IS NULL THEN RAISE EXCEPTION 'profile % not found', p_user_id; END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, source, external_id)
    VALUES (p_user_id, -p_amount, p_reason, p_source, p_external_id);

  RETURN v_new;
END; $$;

-- Atomic spend. Callable by the signed-in user (checks auth.uid()).
-- Deducts p_amount only if the balance covers it, in a single row update — no read-then-write race.
-- Returns the new balance, or -1 if insufficient funds.
CREATE OR REPLACE FUNCTION public.spend_coin(
  p_amount INTEGER DEFAULT 1,
  p_reason TEXT DEFAULT 'scan'
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.profiles
    SET coins = coins - p_amount, updated_at = now()
    WHERE id = auth.uid() AND coins >= p_amount
    RETURNING coins INTO v_new;

  IF v_new IS NULL THEN
    RETURN -1;  -- insufficient funds (or no such profile)
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, source)
    VALUES (auth.uid(), -p_amount, p_reason, 'app');

  RETURN v_new;
END; $$;

GRANT EXECUTE ON FUNCTION public.spend_coin(INTEGER, TEXT) TO authenticated;

-- add_coins must never be callable by users. Postgres default-grants EXECUTE to PUBLIC
-- on new functions, so "not granting" is NOT enough — revoke it explicitly.
REVOKE EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_coins(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_coins(UUID, INTEGER, TEXT, TEXT, TEXT) FROM authenticated;

-- ==========================================================================
-- SECURITY FIX: block direct client writes to profiles.coins.
-- The legacy "Users can update own profile" RLS policy grants authenticated users
-- UPDATE on their own profiles row. Postgres RLS can't restrict *columns*, so that
-- policy lets ANY signed-in user run: update profiles set coins = 999999 where id = me
-- — bypassing the entire webhook/add_coins/ledger design. Drop it. Coins (and every
-- other field) are written only by SECURITY DEFINER functions, which bypass RLS, so
-- users need no direct UPDATE grant at all.
-- ==========================================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- ==========================================================================
-- SUPERSEDED: record_search_and_deduct_coin is no longer used or deployed. The live
-- scan spend runs server-side in the face-search edge function via spend_coin, and
-- DROP-STALE-TEXT-REASON-OVERLOADS.sql drops this function (it still referenced the
-- dropped `source` column). Kept here only as history; do not re-run this block.
--
-- CONCURRENCY FIX: make the scan-spend atomic.
-- The scan path (scanning.tsx) calls record_search_and_deduct_coin, whose legacy
-- definition did SELECT coins -> check -> separate UPDATE (read-then-write). Two
-- concurrent scans both read the same balance and both deduct -> balance goes
-- negative / a free scan. Rewrite it as a single conditional UPDATE, same pattern
-- as spend_coin: check and deduct in one locked row update.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.record_search_and_deduct_coin(
  p_user_id       UUID,
  p_image_url     TEXT,
  p_results_count INTEGER,
  p_results_data  JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new       INTEGER;
  v_search_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Atomic check+deduct: only succeeds if the row still has >= 1 coin.
  UPDATE public.profiles
    SET coins = coins - 1, updated_at = now()
    WHERE id = p_user_id AND coins >= 1
    RETURNING coins INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins');
  END IF;

  INSERT INTO public.searches (user_id, image_url, results_count, results)
    VALUES (p_user_id, p_image_url, p_results_count, p_results_data)
    RETURNING id INTO v_search_id;

  -- Log the spend in the coin ledger for a complete audit trail.
  INSERT INTO public.coin_transactions (user_id, amount, reason, source)
    VALUES (p_user_id, -1, 'scan', 'app');

  RETURN jsonb_build_object('success', true, 'search_id', v_search_id, 'new_balance', v_new);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'database_error', 'message', SQLERRM);
END; $$;
