-- ============================================================================
-- RUN THIS ONCE in the Supabase SQL editor. Paste the WHOLE file, hit Run.
--
-- Why: your DB has neither the device_claims table nor the 4-arg RPC, so the
-- app's anti-farm guard does nothing. This creates the table AND installs the
-- authoritative create_user_profile (the one from FIX-REFERRAL-LEDGER.sql,
-- which is the correct, non-ambiguous version — it just assumed the table
-- already existed). Idempotent: safe to re-run.
--
-- Prereq: the coin_transactions ledger table must already exist (it does —
-- spend_coin/getCoinTransactions use it).
-- ============================================================================

-- 1. Device ledger: one row per physical device that has claimed its free coin.
CREATE TABLE IF NOT EXISTS public.device_claims (
  device_id  TEXT PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);
-- Only the SECURITY DEFINER RPC touches this; no client policies => clients can't read/write it.
ALTER TABLE public.device_claims ENABLE ROW LEVEL SECURITY;

-- 2. One-time signup-bonus logger (idempotent; keyed on "a signup_bonus already exists").
CREATE OR REPLACE FUNCTION public._log_signup_bonus(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;  -- reclaimed device => 0 coins => nothing to log
  INSERT INTO public.coin_transactions (user_id, amount, reason, source)
  SELECT p_user_id, p_amount, 'signup_bonus', 'app'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE user_id = p_user_id AND reason = 'signup_bonus'
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public._log_signup_bonus(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._log_signup_bonus(UUID, INTEGER) FROM authenticated;

-- 3. The authoritative RPC. Drop every older arity first so only this 4-arg one remains.
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT DEFAULT NULL,
  referral_code_used TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code TEXT;
  v_referrer_id UUID;
  v_existing RECORD;
  v_device_claimed BOOLEAN := false;  -- true => this device already got its free coin
  v_free_coins INTEGER := 1;          -- free grant for a no-code signup (0 if reclaimed)
BEGIN
  IF auth.uid() != user_id THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'unauthorized',
      'message', 'Cannot create profile for another user'
    );
  END IF;

  -- Device guard: has this device already claimed a free coin? Claim it now if not.
  IF p_device_id IS NOT NULL AND p_device_id != '' THEN
    INSERT INTO public.device_claims (device_id, profile_id)
    VALUES (p_device_id, user_id)
    ON CONFLICT (device_id) DO NOTHING;
    IF NOT FOUND THEN
      v_device_claimed := true;
      v_free_coins := 0;
    END IF;
  END IF;

  -- Lock the (possibly trigger-created) row so concurrent calls for THIS user
  -- serialize here: the first sets referred_by + credits the referrer, the second
  -- sees referred_by and bails at 'already_redeemed'. The referrer is credited once.
  SELECT id, coins, referral_code, referred_by
    INTO v_existing
  FROM public.profiles
  WHERE id = user_id
  FOR UPDATE;

  -- Already redeemed => duplicate attempt, one redemption per user. Bail.
  IF FOUND AND v_existing.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'already_redeemed',
      'message', 'This account has already redeemed a referral code'
    );
  END IF;

  -- The trigger may have granted 1 coin on a reclaimed device. Claw it back to 0.
  IF FOUND AND v_device_claimed THEN
    UPDATE public.profiles
    SET coins = v_free_coins, updated_at = NOW()
    WHERE id = user_id;
    v_existing.coins := v_free_coins;
  END IF;

  v_referral_code := COALESCE(v_existing.referral_code, generate_referral_code());

  -- Resolve + validate the referral code.
  IF referral_code_used IS NOT NULL AND referral_code_used != '' THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = referral_code_used;

    IF v_referrer_id = user_id THEN  -- self-referral guard
      v_referrer_id := NULL;
    END IF;
  END IF;

  IF v_referrer_id IS NOT NULL THEN
    -- Reward the referrer: +1 coin, and LOG IT so it appears in their history.
    UPDATE public.profiles
    SET coins = coins + 1,
        referral_count = referral_count + 1,
        updated_at = NOW()
    WHERE id = v_referrer_id;

    INSERT INTO public.coin_transactions (user_id, amount, reason, source)
      VALUES (v_referrer_id, 1, 'referral_bonus', 'app');

    -- Create/upgrade the new user: free grant + 1 referral coin.
    INSERT INTO public.profiles (id, coins, referral_code, referred_by)
    VALUES (user_id, v_free_coins + 1, v_referral_code, referral_code_used)
    ON CONFLICT (id) DO UPDATE
      SET coins = public.profiles.coins + 1,
          referred_by = EXCLUDED.referred_by,
          updated_at = NOW();

    -- Log the signup grant (idempotent) and the referral coin.
    PERFORM public._log_signup_bonus(user_id, v_free_coins);
    INSERT INTO public.coin_transactions (user_id, amount, reason, source)
      VALUES (user_id, 1, 'referral_redeemed', 'app');

    RETURN jsonb_build_object(
      'success', true, 'user_id', user_id, 'coins', v_free_coins + 1,
      'referral_code', v_referral_code, 'referral_applied', true,
      'referrer_rewarded', true, 'device_reclaimed', v_device_claimed
    );
  ELSE
    -- No valid code: ensure a profile exists with the free grant.
    INSERT INTO public.profiles (id, coins, referral_code)
    VALUES (user_id, v_free_coins, v_referral_code)
    ON CONFLICT (id) DO NOTHING;

    PERFORM public._log_signup_bonus(user_id, v_free_coins);

    RETURN jsonb_build_object(
      'success', true, 'user_id', user_id,
      'coins', COALESCE(v_existing.coins, v_free_coins),
      'referral_code', v_referral_code, 'referral_applied', false,
      'device_reclaimed', v_device_claimed,
      'message', CASE WHEN referral_code_used IS NOT NULL AND referral_code_used != ''
                      THEN 'Invalid referral code' ELSE NULL END
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'database_error', 'message', SQLERRM
    );
END;
$$;

-- 4. Verify (optional): should show 4 args ending in p_device_id, and the table.
-- SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname='create_user_profile';
-- SELECT count(*) FROM device_claims;
