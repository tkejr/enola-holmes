-- UPDATE REFERRAL REWARDS
-- Change new user bonus from 5 coins to 2 coins
-- Referrer still gets 1 coin

DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT DEFAULT NULL,
  referral_code_used TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_referral_code TEXT;
  v_initial_coins INTEGER := 1; -- Default 1 coin
  v_referrer_id UUID;
BEGIN
  -- Verify the calling user matches the user_id (security check)
  IF auth.uid() != user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Cannot create profile for another user'
    );
  END IF;

  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'profile_exists',
      'message', 'Profile already exists for this user'
    );
  END IF;

  -- Generate unique referral code for this user
  v_referral_code := generate_referral_code();

  -- If a referral code was used, validate and apply rewards
  IF referral_code_used IS NOT NULL AND referral_code_used != '' THEN
    -- Find the referrer
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = referral_code_used;

    IF v_referrer_id IS NOT NULL THEN
      -- Give new user 2 coins for using a referral code (CHANGED FROM 5)
      v_initial_coins := 2;

      -- Give referrer 1 additional coin
      UPDATE public.profiles
      SET coins = coins + 1,
          referral_count = referral_count + 1,
          updated_at = NOW()
      WHERE id = v_referrer_id;

      -- Create the new profile with referral tracking
      INSERT INTO public.profiles (id, coins, referral_code, referred_by)
      VALUES (user_id, v_initial_coins, v_referral_code, referral_code_used);

      RETURN jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'coins', v_initial_coins,
        'referral_code', v_referral_code,
        'referral_applied', true,
        'referrer_rewarded', true
      );
    ELSE
      -- Invalid referral code, still create profile but with 1 coin
      INSERT INTO public.profiles (id, coins, referral_code)
      VALUES (user_id, 1, v_referral_code);

      RETURN jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'coins', 1,
        'referral_code', v_referral_code,
        'referral_applied', false,
        'message', 'Invalid referral code'
      );
    END IF;
  ELSE
    -- No referral code used, create profile with 1 coin
    INSERT INTO public.profiles (id, coins, referral_code)
    VALUES (user_id, v_initial_coins, v_referral_code);

    RETURN jsonb_build_object(
      'success', true,
      'user_id', user_id,
      'coins', v_initial_coins,
      'referral_code', v_referral_code,
      'referral_applied', false
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$;
