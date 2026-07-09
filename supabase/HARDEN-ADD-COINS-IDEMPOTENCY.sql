-- Make add_coins idempotency ATOMIC.
--
-- The prior definition (RENAME-REASONS-ENUM-DROP-SOURCE.sql) did a separate
-- `EXISTS` check then an `INSERT`. Under concurrent duplicate webhook deliveries
-- (RevenueCat can and does send the same event twice at once) both calls pass the
-- EXISTS check, then the second INSERT hits the UNIQUE index `coin_txn_dedupe` and
-- raises 23505. The unique index still prevents a double-credit — but the raised
-- 23505 surfaces to the webhook as a generic error → HTTP 500 → RevenueCat retries
-- the (already-credited) event forever until its retry window closes.
--
-- Fix: fold the dedup into a single `INSERT ... ON CONFLICT (external_id) DO NOTHING`.
-- If it inserts, we credit; if it conflicts (already credited), we no-op and return
-- the current balance. No exception, no phantom 500, no retry storm. Same-signature
-- CREATE OR REPLACE, so the 4-arg webhook/face-search contract is unchanged.
--
-- Idempotent to run. Safe to apply anytime after RENAME-REASONS-ENUM-DROP-SOURCE.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.add_coins(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      public.coin_reason DEFAULT 'coin_pack_purchase',
  p_external_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new      INTEGER;
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  -- The ledger row is the dedup gate. ON CONFLICT makes the check+claim atomic:
  -- exactly one concurrent caller inserts; the rest get zero rows and no-op below.
  -- (Partial unique index coin_txn_dedupe covers external_id WHERE NOT NULL.)
  IF p_external_id IS NOT NULL THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason, external_id)
      VALUES (p_user_id, p_amount, p_reason, p_external_id)
      ON CONFLICT (external_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;  -- 1 = we claimed it, 0 = duplicate
    IF NOT v_inserted THEN
      -- Already credited by the first delivery. Return current balance, credit nothing.
      RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
    END IF;
  ELSE
    -- No external id (e.g. in-app spend refunds that don't dedup): always record.
    INSERT INTO public.coin_transactions (user_id, amount, reason, external_id)
      VALUES (p_user_id, p_amount, p_reason, NULL);
  END IF;

  UPDATE public.profiles
    SET coins = coins + p_amount, updated_at = now()
    WHERE id = p_user_id
    RETURNING coins INTO v_new;

  -- Profile missing: undo the ledger insert (raising aborts the whole function tx, so
  -- the INSERT above rolls back too). Message contains 'not found' — the webhook greps
  -- that substring to ack (200) instead of retrying a permanently-unresolvable event.
  IF v_new IS NULL THEN RAISE EXCEPTION 'profile % not found', p_user_id; END IF;

  RETURN v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, public.coin_reason, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, public.coin_reason, TEXT) FROM authenticated;

COMMIT;
