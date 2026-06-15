-- REFERRAL SYSTEM SETUP
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. ADD REFERRAL COLUMNS TO PROFILES TABLE
-- ============================================================================

-- Add referral_code column (unique code for each user)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Add referred_by column (stores the referral code that was used)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Add referral_count column (track how many people used this user's code)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- ============================================================================
-- 2. CHANGE DEFAULT COINS FROM 100 TO 1
-- ============================================================================

-- Update the default value for new profiles
ALTER TABLE public.profiles
ALTER COLUMN coins SET DEFAULT 1;

-- ============================================================================
-- 3. CREATE FUNCTION TO GENERATE UNIQUE REFERRAL CODE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    -- Generate 8-character code
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = result) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN result;
END;
$$;

-- ============================================================================
-- 4. UPDATE create_user_profile FUNCTION TO HANDLE REFERRALS
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, INTEGER);

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
      -- Give new user 5 coins for using a referral code
      v_initial_coins := 5;

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

-- ============================================================================
-- 5. UPDATE AUTO-PROFILE TRIGGER TO GENERATE REFERRAL CODES
-- ============================================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, coins, referral_code)
  VALUES (NEW.id, 1, generate_referral_code())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. CREATE FUNCTION TO GET USER'S REFERRAL INFO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_referral_info(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify the calling user matches the requested user_id
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized'
    );
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'referral_code', referral_code,
    'referral_count', referral_count,
    'referred_by', referred_by,
    'coins_earned', referral_count -- 1 coin per referral
  )
  INTO v_result
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'profile_not_found'));
END;
$$;

-- ============================================================================
-- 7. UPDATE EXISTING PROFILES TO HAVE REFERRAL CODES
-- ============================================================================

-- Generate referral codes for existing users who don't have one
UPDATE public.profiles
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- ============================================================================
-- DONE! Referral system is ready.
-- ============================================================================

-- To verify, run:
-- SELECT id, coins, referral_code, referred_by, referral_count FROM public.profiles;
