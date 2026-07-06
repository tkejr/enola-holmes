import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import type { CoinTransaction } from '@/utils/coins';

type Profile = { coins: number; code: string; count: number };

// Live view of the signed-in user's profile row (coins + referral). Fetches once,
// then subscribes to postgres_changes on that single row so any server-side coin/
// referral change (scan, purchase, referral landing) reflects on screen instantly —
// no focus-refresh or polling. Realtime must be enabled on `profiles` (see
// supabase/ENABLE-REALTIME.sql). Falls back to the initial fetch if the socket drops.
export const useProfile = (): Profile | null => {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      const uid = session.user.id;

      const apply = (row: { coins?: number; referral_code?: string; referral_count?: number }) =>
        setProfile({
          coins: row.coins ?? 0,
          code: row.referral_code ?? '',
          count: row.referral_count ?? 0,
        });

      const { data } = await supabase
        .from('profiles')
        .select('coins, referral_code, referral_count')
        .eq('id', uid)
        .single();
      if (cancelled) return;
      if (data) apply(data);

      channel = supabase
        .channel(`profile:${uid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          (payload) => apply(payload.new as any),
        )
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, []);

  return profile;
};

// Live coin ledger, newest first. Fetches once, then prepends any INSERT to this
// user's transactions as they happen. RLS ("own txns") already scopes the stream.
export const useCoinTransactions = (): { txns: CoinTransaction[]; loading: boolean } => {
  const [txns, setTxns] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      const { data } = await supabase
        .from('coin_transactions')
        .select('id, amount, reason, created_at')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setTxns(data ?? []);
      setLoading(false);

      channel = supabase
        .channel(`txns:${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: `user_id=eq.${uid}` },
          (payload) => setTxns((prev) => [payload.new as CoinTransaction, ...prev]),
        )
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, []);

  return { txns, loading };
};
