# Fix Supabase Integration

## Step 1: Get Correct API Keys

1. Go to your Supabase project: https://qwskolnrpbbhohqphhzl.supabase.co
2. Click **Settings** (gear icon in sidebar)
3. Click **API** section
4. Copy the **anon/public** key (NOT the service_role key)
   - It should be a long token starting with `eyJ...`

## Step 2: Update Your .env.local File

Replace the content of `.env.local` with:

```
EXPO_PUBLIC_SUPABASE_URL=https://qwskolnrpbbhohqphhzl.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJ... (paste your full anon key here)
```

## Step 3: Set Up Database Tables & RLS Policies

Go to **SQL Editor** in Supabase and run this:

```sql
-- 1. Create tables (if not already created)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  image_url TEXT,
  results JSONB,
  results_count INTEGER DEFAULT 0,
  coins_spent INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Create RLS policies for searches
CREATE POLICY "Users can view own searches"
  ON public.searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own searches"
  ON public.searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Create functions
CREATE OR REPLACE FUNCTION public.get_coin_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT coins FROM public.profiles WHERE id = p_user_id);
END;
$$;

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
  v_coins INTEGER;
  v_search_id UUID;
BEGIN
  -- Check authorization
  IF auth.uid() != p_user_id THEN
    RETURN '{"success": false, "error": "unauthorized"}'::jsonb;
  END IF;

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

-- 6. Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, coins)
  VALUES (NEW.id, 100)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Step 4: Create a Profile for Your Test User

If you already have a user account:

```sql
-- Check your user ID
SELECT id, email FROM auth.users;

-- Create profile for existing user (replace with your actual UUID)
INSERT INTO public.profiles (id, coins)
VALUES ('your-user-id-here', 100)
ON CONFLICT (id) DO UPDATE SET coins = 100;
```

## Step 5: Restart Your App

After updating `.env.local`:

1. Stop the Expo server (Ctrl+C in terminal)
2. Clear cache and restart: `npx expo start -c`
3. Reload the app on your device

## Troubleshooting

If the app still doesn't work:

1. **Check console logs** - Look for Supabase errors in your terminal
2. **Verify auth** - Make sure you're signed in (check Settings)
3. **Check RLS policies** - Go to Supabase Dashboard → Authentication → Policies
4. **Test connection** - Try logging out and back in
