-- Create test profile for development
-- Run this AFTER running the main schema

-- First, disable RLS temporarily to create test data
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Insert test profile
INSERT INTO public.profiles (id, email, coins)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@enola.app', 100)
ON CONFLICT (id) DO UPDATE SET coins = 100;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
