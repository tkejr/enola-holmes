-- Part 1: Create Tables
-- Run this first

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON public.searches(created_at DESC);
