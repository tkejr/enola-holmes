import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Default values to prevent app crash if env vars are missing
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'placeholder-key'

// A build with placeholder creds loads nothing after onboarding (App Store rejection
// #6). EAS cloud builds don't read .env.local — vars must be set as EAS env vars on the
// build's environment. Fail loudly instead of shipping a dead binary: crash release
// builds at startup, warn in dev.
if (supabaseUrl === 'https://placeholder.supabase.co') {
  const msg = '⚠️ Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL/KEY as EAS env vars (or .env.local for local dev).'
  if (__DEV__) console.warn(msg)
  else throw new Error(msg)
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
