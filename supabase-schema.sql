-- Supabase Database Schema for Enola App
-- Run this in your Supabase SQL Editor to create the necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  coins INTEGER DEFAULT 14 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coins INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create searches table
CREATE TABLE IF NOT EXISTS public.searches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  results JSONB,
  results_count INTEGER DEFAULT 0,
  coins_spent INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON public.searches(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for purchases
CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own purchases"
  ON public.purchases FOR INSERT
  USING (auth.uid() = user_id);

-- RLS Policies for searches
CREATE POLICY "Users can view own searches"
  ON public.searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own searches"
  ON public.searches FOR INSERT
  USING (auth.uid() = user_id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, coins)
  VALUES (NEW.id, NEW.email, 14);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to deduct coins and record search
CREATE OR REPLACE FUNCTION public.record_search_and_deduct_coin(
  p_user_id UUID,
  p_image_url TEXT,
  p_results_count INTEGER,
  p_results_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_coins INTEGER;
  v_search_id UUID;
  v_new_balance INTEGER;
BEGIN
  -- Check current coin balance
  SELECT coins INTO v_current_coins
  FROM public.profiles
  WHERE id = p_user_id;

  -- Check if user has enough coins
  IF v_current_coins IS NULL OR v_current_coins < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_coins',
      'message', 'Not enough coins. Please purchase more coins to continue.',
      'current_balance', COALESCE(v_current_coins, 0)
    );
  END IF;

  -- Deduct coin
  UPDATE public.profiles
  SET coins = coins - 1,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING coins INTO v_new_balance;

  -- Insert search record
  INSERT INTO public.searches (user_id, image_url, results_count, results, coins_spent, status, completed_at)
  VALUES (p_user_id, p_image_url, p_results_count, p_results_data, 1, 'completed', NOW())
  RETURNING id INTO v_search_id;

  -- Return success with new balance
  RETURN jsonb_build_object(
    'success', true,
    'search_id', v_search_id,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function to get user's coin balance
CREATE OR REPLACE FUNCTION public.get_coin_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins INTEGER;
BEGIN
  SELECT coins INTO v_coins
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN COALESCE(v_coins, 0);
END;
$$;
