-- Part 3: Create RLS Policies (Run after Part 2)

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Purchases policies
CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own purchases"
  ON public.purchases FOR INSERT
  USING (auth.uid() = user_id);

-- Searches policies
CREATE POLICY "Users can view own searches"
  ON public.searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own searches"
  ON public.searches FOR INSERT
  USING (auth.uid() = user_id);
