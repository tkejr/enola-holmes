import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

// The anonymous device account's credentials live in the iOS Keychain, which — unlike
// AsyncStorage — survives an app uninstall. Without this, a reinstall loses the only key
// to the Supabase account and orphans the user's coins, history, and subscription on a
// dead uid. Same account comes back on reinstall; no login UX.
const EMAIL_KEY = 'anon_email';
const PASSWORD_KEY = 'anon_password';
const DEVICE_ID_KEY = 'device_id';

// Keychain items sync via iCloud Keychain by default; keep them local to this device so a
// restore is deterministic and we never resurrect one device's account onto another's.
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const saveAnonCredentials = async (email: string, password: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(EMAIL_KEY, email, OPTS);
    await SecureStore.setItemAsync(PASSWORD_KEY, password, OPTS);
  } catch (error) {
    // Non-fatal: the session still works this install; we just lose reinstall-recovery.
    console.error('❌ Failed to persist anon credentials:', error);
  }
};

// A stable per-device id that SURVIVES uninstall (Keychain-backed), used to anchor the
// free-coin / referral guard server-side. iOS's identifierForVendor resets on uninstall,
// so it can't gate reinstall abuse — a self-generated id in the Keychain can. Generated
// once, reused forever. NOT cleared on account deletion: it must outlive the account so
// delete-and-recreate on the same device can't re-farm the free coin.
export const getDeviceId = async (): Promise<string | null> => {
  try {
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY, OPTS);
    if (!id) {
      // Crypto-random, no PII. Vary source: RN's global crypto if present, else a
      // high-entropy fallback (id uniqueness only needs to be practically collision-free).
      const g: any = globalThis as any;
      id = g.crypto?.randomUUID
        ? g.crypto.randomUUID()
        : `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id, OPTS);
    }
    return id;
  } catch (error) {
    console.error('❌ getDeviceId error:', error);
    return null; // RPC treats null device_id as "no guard" — fails open, never blocks signup.
  }
};

// Wipe the stored credentials. Call on account deletion — otherwise the deleted
// account's email/password linger in the Keychain and restoreAnonSession() tries (and
// fails) to sign back into a user that no longer exists on every cold start.
export const clearAnonCredentials = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(EMAIL_KEY, OPTS);
    await SecureStore.deleteItemAsync(PASSWORD_KEY, OPTS);
  } catch (error) {
    console.error('❌ Failed to clear anon credentials:', error);
  }
};

// Try to restore the anonymous session from Keychain credentials. Returns the userId on
// success, or null if there's nothing stored / sign-in fails. Call on launch when
// getSession() returns null (AsyncStorage was wiped by an uninstall).
export const restoreAnonSession = async (): Promise<string | null> => {
  try {
    const email = await SecureStore.getItemAsync(EMAIL_KEY, OPTS);
    const password = await SecureStore.getItemAsync(PASSWORD_KEY, OPTS);
    if (!email || !password) return null;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('❌ Anon session restore failed:', error);
      return null;
    }
    return data.user?.id ?? null;
  } catch (error) {
    console.error('❌ Anon session restore error:', error);
    return null;
  }
};

// demo/self-check: run under a debug build to confirm round-trip persistence.
// import { _anonAuthSelfCheck } from './anonAuth'; _anonAuthSelfCheck();
export const _anonAuthSelfCheck = async (): Promise<void> => {
  const email = 'selfcheck@example.test';
  const password = 'pw-selfcheck-123';
  await SecureStore.setItemAsync(EMAIL_KEY, email, OPTS);
  await SecureStore.setItemAsync(PASSWORD_KEY, password, OPTS);
  const gotEmail = await SecureStore.getItemAsync(EMAIL_KEY, OPTS);
  const gotPassword = await SecureStore.getItemAsync(PASSWORD_KEY, OPTS);
  if (gotEmail !== email || gotPassword !== password) {
    throw new Error('anonAuth self-check FAILED: Keychain round-trip mismatch');
  }
  console.log('✅ anonAuth self-check passed');
};
