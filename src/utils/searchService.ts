import { supabase } from './supabase';

export interface RecordSearchResult {
  success: boolean;
  error?: string;
  message?: string;
  search_id?: string;
  new_balance?: number;
  current_balance?: number;
}

/**
 * Get current logged-in user ID
 */
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Check user's current coin balance
 */
export async function getCoinBalance(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  try {
    const { data, error } = await supabase.rpc('get_coin_balance', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting coin balance:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Exception getting coin balance:', error);
    return 0;
  }
}

/**
 * Record a search and deduct one coin
 */
export async function recordSearchAndDeductCoin(
  imageUrl: string,
  resultsCount: number,
  resultsData: any[]
): Promise<RecordSearchResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      error: 'not_authenticated',
      message: 'Please log in to perform searches.',
    };
  }
  try {
    const { data, error } = await supabase.rpc('record_search_and_deduct_coin', {
      p_user_id: userId,
      p_image_url: imageUrl,
      p_results_count: resultsCount,
      p_results_data: resultsData,
    });

    if (error) {
      console.error('Error recording search:', error);
      return {
        success: false,
        error: 'database_error',
        message: 'Failed to record search. Please try again.',
      };
    }

    return data as RecordSearchResult;
  } catch (error) {
    console.error('Exception recording search:', error);
    return {
      success: false,
      error: 'exception',
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Get user's recent searches
 */
export async function getRecentSearches(limit: number = 20): Promise<any[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  try {
    // Use direct query without RLS for testing
    const { data, error } = await supabase
      .from('searches')
      .select('id, image_url, results_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching searches:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching searches:', error);
    return [];
  }
}

/**
 * Get detailed search result by ID
 */
export async function getSearchById(searchId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('searches')
      .select('*')
      .eq('id', searchId)
      .single();

    if (error) {
      console.error('Error fetching search:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception fetching search:', error);
    return null;
  }
}
