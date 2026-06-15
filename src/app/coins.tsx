import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';

type CoinPackage = {
  id: string;
  coins: number;
  price: string;
  badge?: string;
};

const coinPackages: CoinPackage[] = [
  { id: '1', coins: 1, price: '$4.99' },
  { id: '5', coins: 5, price: '$19.99', badge: 'POPULAR' },
  { id: '10', coins: 10, price: '$29.99' },
  { id: '25', coins: 25, price: '$59.99' },
  { id: '50', coins: 50, price: '$99.99', badge: 'BEST VALUE' },
];

export default function CoinsScreen() {
  const [coins, setCoins] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserCoins();
  }, []);

  const loadUserCoins = async () => {
    try {
      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('No session found - using default coins');
        return;
      }

      setUserId(session.user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('coins')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error loading coins:', error);
      } else if (data) {
        setCoins(data.coins);
      }
    } catch (error) {
      console.error('Error loading coins:', error);
    }
  };

  const purchaseCoins = async (pkg: CoinPackage) => {
    if (!userId) {
      Alert.alert('Error', 'Please log in to purchase coins.');
      return;
    }

    // In production, you would integrate with Apple Pay / Google Pay here
    Alert.alert(
      'Purchase Coins',
      `Buy ${pkg.coins} coin${pkg.coins > 1 ? 's' : ''} for ${pkg.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            try {
              const newBalance = coins + pkg.coins;
              const { error } = await supabase
                .from('profiles')
                .update({ coins: newBalance, updated_at: new Date().toISOString() })
                .eq('id', userId);

              if (error) {
                console.error('Error updating coins:', error);
                Alert.alert('Error', 'Failed to purchase coins. Please try again.');
                return;
              }

              setCoins(newBalance);

              // Log the purchase (optional - you'd need to create a purchases table first)
              // await supabase.from('purchases').insert({
              //   user_id: userId,
              //   coins: pkg.coins,
              //   amount: parseFloat(pkg.price.replace('$', '')),
              //   created_at: new Date().toISOString(),
              // });

              Alert.alert('Success', `You now have ${newBalance} coins!`);
            } catch (error) {
              console.error('Error purchasing coins:', error);
              Alert.alert('Error', 'Failed to purchase coins. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>Enola</Text>
        <View style={styles.coinBadge}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinText}>{coins}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Text style={styles.coinEmoji}>🪙</Text>
          <Text style={styles.title}>Get More Coins</Text>
          <Text style={styles.subtitle}>1 Coin = 1 Face Scan</Text>
        </View>

        <View style={styles.packagesContainer}>
          {coinPackages.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={styles.packageCard}
              onPress={() => purchaseCoins(pkg)}
            >
              {pkg.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pkg.badge}</Text>
                </View>
              )}
              <Text style={styles.packageCoins}>{pkg.coins}</Text>
              <Text style={styles.packageLabel}>Coin{pkg.coins > 1 ? 's' : ''}</Text>
              <View style={styles.packagePrice}>
                <Text style={styles.priceText}>{pkg.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Why Coins?</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>✓</Text>
            <Text style={styles.infoText}>One-time purchase, no subscription</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>✓</Text>
            <Text style={styles.infoText}>Never expire</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>✓</Text>
            <Text style={styles.infoText}>Use whenever you need</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => Alert.alert('Invite Friends', 'Share feature coming soon!')}
        >
          <Text style={styles.inviteButtonText}>Invite Friends & Earn Free Coins</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#007AFF',
    fontWeight: '300',
  },
  logo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  coinIcon: {
    fontSize: 16,
  },
  coinText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  coinEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  packagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  packageCoins: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
    letterSpacing: -1,
  },
  packageLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 12,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  packagePrice: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    fontSize: 18,
    color: '#007AFF',
    marginRight: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#3C3C43',
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  inviteButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inviteButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
});
