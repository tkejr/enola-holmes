import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCoinTransactions } from '@/utils/useRealtime';

// Human labels for the `reason` codes written by the coin RPCs.
const LABELS: Record<string, string> = {
  scan: 'Face Search',
  scan_refund: 'Search Refund',
  purchase: 'Coin Purchase',
  refund: 'Refund',
  subscription_grant: 'Subscription Coins',
  signup_bonus: 'Welcome Bonus',
  referral_bonus: 'Successful Referral',  // referrer earned a coin from their code
  referral_redeemed: 'Referral Code',     // new user's bonus for entering a code
};

export default function TransactionsScreen() {
  const { txns, loading } = useCoinTransactions();

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#FAFAFA', '#F5F5F5', '#FFFFFF']} style={styles.gradient}>
        <View style={styles.header}>
          <HapticTouchable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={22} color="#1C1C1E" />
          </HapticTouchable>
          <Text style={styles.logo}>Coin History</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : txns.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="cash-outline" size={48} color="#1C1C1E" />
              </View>
              <Text style={styles.emptyTitle}>No Transactions Yet</Text>
              <Text style={styles.emptyText}>Your coin activity will appear here</Text>
            </View>
          ) : (
            txns.map((t) => {
              const credit = t.amount > 0;
              return (
                <View key={t.id} style={styles.row}>
                  <View style={[styles.iconWrap, credit ? styles.iconCredit : styles.iconDebit]}>
                    <Ionicons
                      name={credit ? 'arrow-up' : 'arrow-down'}
                      size={18}
                      color={credit ? '#16A34A' : '#DC2626'}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.title}>{LABELS[t.reason] ?? t.reason}</Text>
                    <Text style={styles.date}>{formatDate(t.created_at)}</Text>
                  </View>
                  <Text style={[styles.amount, credit ? styles.amountCredit : styles.amountDebit]}>
                    {credit ? '+' : ''}{t.amount}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  gradient: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  logo: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.5 },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyIconContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24, fontWeight: '700', color: '#0F172A',
    marginBottom: 8, letterSpacing: -0.6,
  },
  emptyText: { fontSize: 16, color: '#64748B', letterSpacing: -0.3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  iconCredit: { backgroundColor: '#F0FDF4' },
  iconDebit: { backgroundColor: '#FEF2F2' },
  info: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.3 },
  date: { fontSize: 13, color: '#64748B', letterSpacing: -0.2 },
  amount: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  amountCredit: { color: '#16A34A' },
  amountDebit: { color: '#DC2626' },
});
