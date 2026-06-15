import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Default values to prevent app crash if env vars are missing
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'placeholder-key'

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('⚠️ Supabase URL not configured. Check your .env.local file.')
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
