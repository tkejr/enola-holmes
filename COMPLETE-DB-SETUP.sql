-- COMPLETE DATABASE SETUP FOR ENOLA APP
-- Copy and paste this entire file into Supabase SQL Editor and click RUN

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Searches table
CREATE TABLE IF NOT EXISTS public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT,
  results JSONB,
  results_count INTEGER DEFAULT 0,
  coins_spent INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. DROP EXISTING POLICIES (if any)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own searches" ON public.searches;
DROP POLICY IF EXISTS "Users can insert own searches" ON public.searches;

-- ============================================================================
-- 4. CREATE RLS POLICIES FOR PROFILES
-- ============================================================================

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 5. CREATE RLS POLICIES FOR SEARCHES
-- ============================================================================

-- Allow users to view their own searches
CREATE POLICY "Users can view own searches"
  ON public.searches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own searches
CREATE POLICY "Users can insert own searches"
  ON public.searches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. CREATE RPC FUNCTION: create_user_profile
-- ============================================================================

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID);

CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT DEFAULT NULL,
  initial_coins INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
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

  -- Create the profile
  INSERT INTO public.profiles (id, coins)
  VALUES (user_id, initial_coins);

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'coins', initial_coins
  );
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
-- 7. CREATE RPC FUNCTION: get_coin_balance
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_coin_balance(UUID);

CREATE OR REPLACE FUNCTION public.get_coin_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the calling user matches the requested user_id
  IF auth.uid() != p_user_id THEN
    RETURN NULL;
  END IF;

  RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
END;
$$;

-- ============================================================================
-- 8. CREATE RPC FUNCTION: record_search_and_deduct_coin
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.record_search_and_deduct_coin(UUID, TEXT, INTEGER, JSONB);

CREATE OR REPLACE FUNCTION public.record_search_and_deduct_coin(
  p_user_id UUID,
  p_image_url TEXT,
  p_results_count INTEGER,
  p_results_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins INTEGER;
  v_search_id UUID;
BEGIN
  -- Verify the calling user matches the user_id
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized'
    );
  END IF;

  -- Get current coin balance
  SELECT coins INTO v_coins FROM public.profiles WHERE id = p_user_id;

  -- Check if user has enough coins
  IF v_coins < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_coins'
    );
  END IF;

  -- Deduct coin
  UPDATE public.profiles
  SET coins = coins - 1, updated_at = NOW()
  WHERE id = p_user_id;

  -- Record search
  INSERT INTO public.searches (user_id, image_url, results_count, results)
  VALUES (p_user_id, p_image_url, p_results_count, p_results_data)
  RETURNING id INTO v_search_id;

  -- Return success with new balance
  RETURN jsonb_build_object(
    'success', true,
    'search_id', v_search_id,
    'new_balance', v_coins - 1
  );
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
-- 9. CREATE TRIGGER: Auto-create profile on user signup (backup)
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, coins)
  VALUES (NEW.id, 100)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- DONE! Database setup complete.
-- ============================================================================

-- To verify, you can run:
-- SELECT * FROM public.profiles;
-- SELECT * FROM public.searches;
