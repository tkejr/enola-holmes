-- Rename coin reasons to friendly names, convert `reason` to a real enum type,
-- and drop `source` entirely (dedup now keys on external_id alone).
--
-- ORDER MATTERS: rename data -> re-key dedup off source -> drop source ->
-- create enum -> convert column -> re-type the RPCs that write it.
-- Run as one transaction so a failure rolls back cleanly.
BEGIN;

-- 1. Rename existing rows to the new names (old text values still present).
UPDATE public.coin_transactions SET reason = 'coin_pack_purchase' WHERE reason = 'purchase';
UPDATE public.coin_transactions SET reason = 'subscription'       WHERE reason = 'subscription_grant';
-- scan / scan_refund / signup_bonus / referral_bonus keep their names.

-- 2. Move dedup off (source, external_id) -> (external_id) BEFORE dropping source.
DROP INDEX IF EXISTS public.coin_txn_dedupe;
CREATE UNIQUE INDEX coin_txn_dedupe
  ON public.coin_transactions (external_id)
  WHERE external_id IS NOT NULL;

-- 3. Drop the source column.
ALTER TABLE public.coin_transactions DROP COLUMN source;

-- 4. Create the enum and convert the column to it.
CREATE TYPE public.coin_reason AS ENUM (
  'scan',
  'scan_refund',
  'signup_bonus',
  'referral_bonus',
  'referral_redeemed',
  'subscription',
  'coin_pack_purchase'
);

ALTER TABLE public.coin_transactions
  ALTER COLUMN reason TYPE public.coin_reason USING reason::public.coin_reason;

-- 5. Re-create the writer RPCs without p_source, with reason typed as the enum.
--    Dedup now checks external_id only.

DROP FUNCTION IF EXISTS public.add_coins(UUID, INTEGER, TEXT, TEXT, TEXT);
CREATE FUNCTION public.add_coins(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      public.coin_reason DEFAULT 'coin_pack_purchase',
  p_external_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  IF p_external_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.coin_transactions WHERE external_id = p_external_id
  ) THEN
    RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
  END IF;

  UPDATE public.profiles
    SET coins = coins + p_amount, updated_at = now()
    WHERE id = p_user_id
    RETURNING coins INTO v_new;

  IF v_new IS NULL THEN RAISE EXCEPTION 'profile % not found', p_user_id; END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, external_id)
    VALUES (p_user_id, p_amount, p_reason, p_external_id);

  RETURN v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, public.coin_reason, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, public.coin_reason, TEXT) FROM authenticated;

DROP FUNCTION IF EXISTS public.remove_coins(UUID, INTEGER, TEXT, TEXT, TEXT);
CREATE FUNCTION public.remove_coins(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      public.coin_reason DEFAULT 'coin_pack_purchase',
  p_external_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  IF p_external_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.coin_transactions WHERE external_id = p_external_id
  ) THEN
    RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
  END IF;

  UPDATE public.profiles
    SET coins = coins - p_amount, updated_at = now()
    WHERE id = p_user_id
    RETURNING coins INTO v_new;

  IF v_new IS NULL THEN RAISE EXCEPTION 'profile % not found', p_user_id; END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, external_id)
    VALUES (p_user_id, -p_amount, p_reason, p_external_id);

  RETURN v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.remove_coins(UUID, INTEGER, public.coin_reason, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_coins(UUID, INTEGER, public.coin_reason, TEXT) FROM authenticated;

-- 6. Re-create the other functions that INSERT `source`, minus the source column.

-- spend_coin (from coins-and-iap.sql)
CREATE OR REPLACE FUNCTION public.spend_coin(
  p_amount INTEGER DEFAULT 1,
  p_reason public.coin_reason DEFAULT 'scan'
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

  INSERT INTO public.coin_transactions (user_id, amount, reason)
    VALUES (auth.uid(), -p_amount, p_reason);

  RETURN v_new;
END; $$;
GRANT EXECUTE ON FUNCTION public.spend_coin(INTEGER, public.coin_reason) TO authenticated;

-- _log_signup_bonus (from FIX-REFERRAL-LEDGER.sql)
CREATE OR REPLACE FUNCTION public._log_signup_bonus(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.coin_transactions (user_id, amount, reason)
  SELECT p_user_id, p_amount, 'signup_bonus'::public.coin_reason
  WHERE NOT EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE user_id = p_user_id AND reason = 'signup_bonus'
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public._log_signup_bonus(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._log_signup_bonus(UUID, INTEGER) FROM authenticated;

-- create_user_profile (from FIX-REFERRAL-LEDGER.sql) — only change vs that file is
-- the two coin_transactions inserts drop `source`/`'app'` and cast reason to the enum.
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT DEFAULT NULL,
  referral_code_used TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral_code TEXT;
  v_referrer_id UUID;
  v_existing RECORD;
  v_device_claimed BOOLEAN := false;
  v_free_coins INTEGER := 1;
BEGIN
  IF auth.uid() != user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized',
      'message', 'Cannot create profile for another user');
  END IF;

  IF p_device_id IS NOT NULL AND p_device_id != '' THEN
    INSERT INTO public.device_claims (device_id, profile_id)
    VALUES (p_device_id, user_id)
    ON CONFLICT (device_id) DO NOTHING;
    IF NOT FOUND THEN
      v_device_claimed := true;
      v_free_coins := 0;
    END IF;
  END IF;

  SELECT id, coins, referral_code, referred_by INTO v_existing
  FROM public.profiles WHERE id = user_id FOR UPDATE;

  IF FOUND AND v_existing.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed',
      'message', 'This account has already redeemed a referral code');
  END IF;

  IF FOUND AND v_device_claimed THEN
    UPDATE public.profiles SET coins = v_free_coins, updated_at = NOW() WHERE id = user_id;
    v_existing.coins := v_free_coins;
  END IF;

  v_referral_code := COALESCE(v_existing.referral_code, generate_referral_code());

  IF referral_code_used IS NOT NULL AND referral_code_used != '' THEN
    SELECT id INTO v_referrer_id FROM public.profiles WHERE referral_code = referral_code_used;
    IF v_referrer_id = user_id THEN v_referrer_id := NULL; END IF;
  END IF;

  IF v_referrer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET coins = coins + 1, referral_count = referral_count + 1, updated_at = NOW()
    WHERE id = v_referrer_id;

    INSERT INTO public.coin_transactions (user_id, amount, reason)
      VALUES (v_referrer_id, 1, 'referral_bonus'::public.coin_reason);

    INSERT INTO public.profiles (id, coins, referral_code, referred_by)
    VALUES (user_id, v_free_coins + 1, v_referral_code, referral_code_used)
    ON CONFLICT (id) DO UPDATE
      SET coins = public.profiles.coins + 1,
          referred_by = EXCLUDED.referred_by, updated_at = NOW();

    PERFORM public._log_signup_bonus(user_id, v_free_coins);
    INSERT INTO public.coin_transactions (user_id, amount, reason)
      VALUES (user_id, 1, 'referral_redeemed'::public.coin_reason);

    RETURN jsonb_build_object('success', true, 'user_id', user_id, 'coins', v_free_coins + 1,
      'referral_code', v_referral_code, 'referral_applied', true,
      'referrer_rewarded', true, 'device_reclaimed', v_device_claimed);
  ELSE
    INSERT INTO public.profiles (id, coins, referral_code)
    VALUES (user_id, v_free_coins, v_referral_code)
    ON CONFLICT (id) DO NOTHING;

    PERFORM public._log_signup_bonus(user_id, v_free_coins);

    RETURN jsonb_build_object('success', true, 'user_id', user_id,
      'coins', COALESCE(v_existing.coins, v_free_coins),
      'referral_code', v_referral_code, 'referral_applied', false,
      'device_reclaimed', v_device_claimed,
      'message', CASE WHEN referral_code_used IS NOT NULL AND referral_code_used != ''
                      THEN 'Invalid referral code' ELSE NULL END);
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'database_error', 'message', SQLERRM);
END; $$;

COMMIT;
