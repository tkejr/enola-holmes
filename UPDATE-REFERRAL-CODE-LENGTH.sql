-- UPDATE REFERRAL CODE LENGTH FROM 8 TO 6 DIGITS
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS public.generate_referral_code();

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
    -- Generate 6-character code (changed from 8)
    FOR i IN 1..6 LOOP
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

-- Optional: Regenerate all existing referral codes to be 6 characters
-- WARNING: This will change everyone's referral codes!
-- Comment out if you want to keep existing codes
UPDATE public.profiles
SET referral_code = generate_referral_code()
WHERE LENGTH(referral_code) != 6 OR referral_code IS NULL;
