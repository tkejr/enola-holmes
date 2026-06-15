-- Part 5: Create Helper Functions (Run after Part 4)

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
  SELECT coins INTO v_current_coins FROM public.profiles WHERE id = p_user_id;

  IF v_current_coins IS NULL OR v_current_coins < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_coins',
      'message', 'Not enough coins. Please purchase more coins to continue.',
      'current_balance', COALESCE(v_current_coins, 0)
    );
  END IF;

  UPDATE public.profiles SET coins = coins - 1, updated_at = NOW() WHERE id = p_user_id RETURNING coins INTO v_new_balance;

  INSERT INTO public.searches (user_id, image_url, results_count, results, coins_spent, status, completed_at)
  VALUES (p_user_id, p_image_url, p_results_count, p_results_data, 1, 'completed', NOW())
  RETURNING id INTO v_search_id;

  RETURN jsonb_build_object('success', true, 'search_id', v_search_id, 'new_balance', v_new_balance);
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
  SELECT coins INTO v_coins FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(v_coins, 0);
END;
$$;
