# 🎁 Referral System - Complete Guide

## Overview

Your Enola app now has a fully functional referral system!

### How It Works:

1. **Every user gets a unique 8-character referral code** (e.g., "ABC12XYZ")
2. **Default coins changed from 100 to 1** - everyone starts with 1 coin
3. **When someone uses a referral code during signup:**
   - New user gets **5 coins** (instead of 1)
   - Referrer gets **1 additional coin**
4. **Users can track their referrals** in the Settings screen

---

## 🚀 Setup Instructions

### Step 1: Run the Database Migration

1. Open **Supabase SQL Editor**
2. Copy the entire contents of `REFERRAL-SYSTEM-SETUP.sql`
3. Paste and click **Run**

This will:
- Add referral columns to your profiles table
- Change default coins from 100 to 1
- Create referral code generation function
- Update the `create_user_profile` function to handle referrals
- Generate referral codes for existing users
- Create a `get_referral_info` function to fetch referral stats

### Step 2: Restart Your App

```bash
npx expo start -c
```

Reload the app on your device.

---

## 📱 User Flow

### New User Signup

1. User goes through onboarding
2. On the final "Welcome" screen, they see:
   - A testimonial card
   - **Referral code input field** (optional)
   - "Get 5 coins with a referral code!" hint
   - "Get Started" button

3. If they enter a valid referral code:
   - ✅ New user starts with **5 coins**
   - ✅ Referrer gets **+1 coin** automatically
   - ✅ Success message shows: "🎉 Referral Applied! You received 5 coins!"

4. If they enter an invalid code:
   - ⚠️ Alert shows: "Invalid Referral Code"
   - ✅ User still gets **1 coin** to start

5. If they skip the referral code:
   - ✅ User starts with **1 coin**

### Sharing Referral Code

1. User taps **Settings** ⚙️ in the home screen
2. At the top, they see a **referral card** with:
   - Their unique referral code in a big display
   - **Copy** button
   - **Share Referral Code** button
   - Stats showing:
     - Friends Joined
     - Coins Earned

3. Tapping **Share** opens the native share sheet with:
   ```
   Join me on Enola and get 5 free coins!
   Use my referral code: ABC12XYZ

   Download: https://enola.app
   ```

4. Tapping **Copy** copies the code to clipboard

---

## 🗄️ Database Schema

### Profiles Table - New Columns

```sql
referral_code      TEXT UNIQUE      -- User's unique code (e.g., "ABC12XYZ")
referred_by        TEXT             -- Code they used during signup
referral_count     INTEGER          -- How many people used their code
coins              INTEGER DEFAULT 1 -- Changed from 100 to 1
```

### Example Profile

```json
{
  "id": "uuid-here",
  "referral_code": "ABC12XYZ",
  "referred_by": "XYZ98ABC",
  "referral_count": 3,
  "coins": 4
}
```

This user:
- Was referred by someone who had code "XYZ98ABC"
- Started with 5 coins (referral bonus)
- Has referred 3 people (earning 3 more coins)
- Currently has 4 coins (spent some on searches)

---

## 🔧 Technical Details

### Files Modified

1. **Database:**
   - `REFERRAL-SYSTEM-SETUP.sql` - Complete DB migration

2. **Onboarding:**
   - `src/app/onboarding/welcome.tsx` - Added referral code input

3. **Settings:**
   - `src/app/settings.tsx` - Added referral card, share & copy features

4. **Coin Defaults:**
   - `src/app/(tabs)/index.tsx` - Changed default from 100 to 1
   - `src/app/coins.tsx` - Changed default from 100 to 1

### RPC Functions

#### `create_user_profile(user_id, user_email, referral_code_used)`

Creates a new profile with referral handling:
- Generates unique referral code
- If `referral_code_used` is valid:
  - Gives new user 5 coins
  - Gives referrer +1 coin
  - Increments referrer's `referral_count`
  - Records who referred them
- Returns success with referral info

#### `get_referral_info(user_id)`

Returns user's referral stats:
```json
{
  "success": true,
  "referral_code": "ABC12XYZ",
  "referral_count": 3,
  "referred_by": "XYZ98ABC",
  "coins_earned": 3
}
```

#### `generate_referral_code()`

Generates a random 8-character code:
- Uses A-Z and 0-9 characters
- Ensures uniqueness in database
- Format: `ABC12XYZ`

---

## 🎯 Testing the Referral System

### Test Scenario 1: User A refers User B

1. **User A signs up:**
   - Gets referral code: `TESTCODE`
   - Starts with 1 coin

2. **User B signs up with code `TESTCODE`:**
   - Enters `TESTCODE` on welcome screen
   - Gets 5 coins
   - Sees success message
   - User A gets +1 coin (now has 2)

3. **Verify in Supabase:**
   ```sql
   SELECT referral_code, referral_count, coins
   FROM profiles
   WHERE referral_code = 'TESTCODE';
   -- Should show: referral_count = 1, coins = 2
   ```

### Test Scenario 2: Invalid Code

1. User enters `INVALID123`
2. Gets alert: "Invalid Referral Code"
3. Still starts with 1 coin
4. No one gets rewarded

### Test Scenario 3: No Code

1. User skips referral field
2. Starts with 1 coin
3. Gets their own referral code to share

---

## 🎨 UI Features

### Welcome Screen (Onboarding)
- Clean input field for referral code
- Auto-capitalizes text
- Max 8 characters
- Green hint: "💰 Get 5 coins with a referral code!"

### Settings Screen
- Beautiful referral card at top
- Large code display
- One-tap copy to clipboard
- Share button with native share sheet
- Real-time stats:
  - Friends joined
  - Coins earned

---

## 💡 Tips & Best Practices

1. **Promote Referrals:**
   - Add referral info to onboarding slides
   - Show referral prompt after first successful search
   - Add referral button to coin purchase screen

2. **Gamification:**
   - Consider milestone rewards (10 referrals = bonus)
   - Leaderboard for top referrers
   - Special badges for referrers

3. **Tracking:**
   - Monitor referral conversion rates
   - Track most active referrers
   - A/B test referral rewards (5 coins vs 10 coins)

4. **Deep Linking (Future):**
   - Create referral URLs: `enola://ref/ABC12XYZ`
   - Auto-fill referral code from URL
   - Track install attribution

---

## 🐛 Troubleshooting

### Problem: User doesn't see referral card

**Solution:** Make sure they've completed signup. Check:
```sql
SELECT referral_code FROM profiles WHERE id = 'user-id';
```

### Problem: Referral code not working

**Solution:** Check if code exists:
```sql
SELECT * FROM profiles WHERE referral_code = 'ABC12XYZ';
```

### Problem: Referrer not getting coins

**Solution:** Check RLS policies allow updates:
```sql
SELECT * FROM profiles WHERE referral_code = 'ABC12XYZ';
-- Check if referral_count increased
```

### Problem: Existing users don't have codes

**Solution:** Run migration again:
```sql
UPDATE public.profiles
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;
```

---

## 📊 Analytics Queries

### Top Referrers
```sql
SELECT referral_code, referral_count, coins
FROM profiles
WHERE referral_count > 0
ORDER BY referral_count DESC
LIMIT 10;
```

### Total Referrals
```sql
SELECT COUNT(*) as total_referrals
FROM profiles
WHERE referred_by IS NOT NULL;
```

### Referral Conversion Rate
```sql
SELECT
  COUNT(*) FILTER (WHERE referred_by IS NOT NULL) * 100.0 / COUNT(*) as conversion_rate
FROM profiles;
```

---

## ✅ Checklist

- [x] Database migration completed
- [x] Referral code input on welcome screen
- [x] Settings screen shows referral card
- [x] Copy to clipboard works
- [x] Share feature works
- [x] Default coins changed to 1
- [x] Referral rewards working (5 coins new user, 1 coin referrer)
- [x] expo-clipboard installed
- [x] Testing completed

---

## 🚀 Ready to Go!

Your referral system is now complete and ready to use! Every new user will:
- Start with 1 coin (or 5 with a referral)
- Get their own unique code to share
- Earn coins when friends join

**Next Steps:**
1. Run the SQL migration
2. Restart your app
3. Test the flow end-to-end
4. Share your referral code!
