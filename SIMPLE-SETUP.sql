-- SIMPLE SETUP - Copy and paste this entire file into Supabase SQL Editor and click RUN

-- 1. Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create searches table
CREATE TABLE public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  image_url TEXT,
  results JSONB,
  results_count INTEGER DEFAULT 0,
  coins_spent INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create test profile
-- First, get a UUID from your auth.users table, then run:
-- INSERT INTO public.profiles (id, coins) VALUES ('your-uuid-here', 100);

-- 4. Create function to check balance
CREATE FUNCTION public.get_coin_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
END;
$$;

-- 5. Create function to save search
CREATE FUNCTION public.record_search_and_deduct_coin(
  p_user_id UUID,
  p_image_url TEXT,
  p_results_count INTEGER,
  p_results_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_coins INTEGER;
  v_search_id UUID;
BEGIN
  SELECT coins INTO v_coins FROM public.profiles WHERE id = p_user_id;

  IF v_coins < 1 THEN
    RETURN '{"success": false, "error": "insufficient_coins"}'::jsonb;
  END IF;

  UPDATE public.profiles SET coins = coins - 1 WHERE id = p_user_id;

  INSERT INTO public.searches (user_id, image_url, results_count, results)
  VALUES (p_user_id, p_image_url, p_results_count, p_results_data)
  RETURNING id INTO v_search_id;

  RETURN jsonb_build_object('success', true, 'search_id', v_search_id, 'new_balance', v_coins - 1);
END;
$$;

-- Done! Your database is ready.
