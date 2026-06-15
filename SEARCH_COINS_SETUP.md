# Search History & Coins Setup

## What Was Implemented

### 1. Database Schema (`supabase-schema.sql`)
Run this in your Supabase SQL Editor to set up the database:

```sql
-- Tables created:
- users: Stores user profiles with coin balance (default 14 coins)
- searches: Stores search history with results, images, and metadata
- purchases: Tracks coin purchases (for future payment integration)

-- Functions created:
- record_search_and_deduct_coin(): Atomically records search and deducts 1 coin
- get_coin_balance(): Gets user's current coin balance
```

### 2. Search Service (`src/utils/searchService.ts`)
Helper functions for search and coin operations:
- `getCoinBalance()` - Get user's coin balance
- `recordSearchAndDeductCoin()` - Save search and deduct coin
- `getRecentSearches()` - Fetch user's search history
- `getSearchById()` - Get detailed search result

### 3. Scanning Screen (`src/app/scanning.tsx`)
**Before Search:**
- Checks coin balance
- Shows alert if insufficient coins with "Buy Coins" button

**After Search:**
- Records search in database
- Deducts 1 coin automatically
- Stores results data for history view

### 4. History Screen (`src/app/history.tsx`)
- Beautiful redesigned UI with thumbnails
- Shows all past searches with:
  - Original image thumbnail
  - Match count
  - Date/time
  - Tap to view results again

## How It Works

1. **User starts search** → System checks coin balance
2. **If balance < 1** → Show "Buy Coins" alert
3. **If balance ≥ 1** → Proceed with search
4. **Search completes** → Record to database & deduct 1 coin
5. **View history** → Tap any search to see results again

## Database Fields

### searches table:
- `id` - UUID primary key
- `user_id` - Reference to user (currently '1' for testing)
- `image_url` - Original image URI
- `results` - JSONB with full API response
- `results_count` - Number of matches found
- `coins_spent` - Always 1 per search
- `status` - 'completed' or 'processing'
- `created_at` - Timestamp

## Setup Instructions

1. **Run SQL Schema**:
   - Open Supabase Dashboard
   - Go to SQL Editor
   - Copy and paste `supabase-schema.sql`
   - Execute

2. **Test User**:
   - User ID: `'1'`
   - Default coins: 14
   - For testing without authentication

3. **Environment Variables** (already configured):
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_url
   EXPO_PUBLIC_SUPABASE_KEY=your_key
   ```

## Next Steps

- [ ] Implement real authentication (replace TEST_USER_ID)
- [ ] Add coin purchase flow
- [ ] Add refund capability for failed searches
- [ ] Implement search sharing
- [ ] Add filters to history (by date, platform, etc.)
