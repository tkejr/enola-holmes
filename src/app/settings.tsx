import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, Text, Linking, ScrollView, Share, Alert } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import * as Clipboard from 'expo-clipboard';
import * as StoreReview from 'expo-store-review';
import { LEGAL_URLS } from '@/components/subscription-disclosure';
import { useProfile } from '@/utils/useRealtime';

export default function SettingsScreen() {
  const params = useLocalSearchParams<{ code?: string; count?: string }>();
  // Live profile drives the values; nav params seed the first paint so there's no
  // pop-in when arriving from the coins screen. The hook wins once it resolves.
  const profile = useProfile();
  const referralCode = profile?.code ?? params.code ?? '';
  const referralCount = profile?.count ?? Number(params.count ?? 0);
  const loading = !profile && !params.code; // nothing to show from either source yet

  const handleShareReferral = async () => {
    if (!referralCode) return;

    try {
      await Share.share({
        message: `Join me on Enola and get 2 free coins! Use my referral code: ${referralCode}\n\nDownload: https://tryenola.com`,
        title: 'Join Enola',
      });
    } catch (error) {
      // A share cancel isn't an error; only surface genuine failures.
      console.error('Error sharing:', error);
      Alert.alert('Unavailable', "Couldn't open the share sheet. Copy your code instead.");
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;

    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  // Guarded opener: mailto/http can throw if no handler is configured on the device.
  const openUrl = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unavailable', "Couldn't open that link on this device.");
      }
    } catch {
      Alert.alert('Unavailable', "Couldn't open that link on this device.");
    }
  };

  const handleGiveUsLove = async () => {
    const isAvailable = await StoreReview.isAvailableAsync();

    if (isAvailable) {
      // Open native in-app review prompt
      await StoreReview.requestReview();
    } else {
      // Fallback to App Store review composer if the native prompt isn't available.
      openUrl('https://apps.apple.com/app/id6781339006?action=write-review');
    }
  };

  const handlePrivacyPolicy = () => {
    openUrl(LEGAL_URLS.privacy);
  };

  const handleTerms = () => {
    openUrl(LEGAL_URLS.terms);
  };

  const handleGetHelp = () => {
    openUrl('mailto:support@tryenola.com');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, coins, and search history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              Alert.alert('Not signed in', 'No account is currently signed in.');
              return;
            }
            const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`;
            try {
              const res = await fetch(url, {
                method: 'POST',
                headers: {
                  apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
              if (!res.ok) throw new Error(String(res.status));
              await supabase.auth.signOut();
              router.replace('/');
            } catch (e) {
              console.error('Delete account failed:', e);
              Alert.alert('Error', "Couldn't delete your account. Please try again or contact support.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <HapticTouchable
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#1C1C1E" />
          </HapticTouchable>
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Referral Card */}
          {!loading && referralCode && (
            <View style={styles.referralCard}>
              <Text style={styles.referralTitle}>Earn Free Coins</Text>
              <Text style={styles.referralSubtitle}>
                Get 1 coin for every person who uses your code
              </Text>

              <View style={styles.codeBox}>
                <View style={styles.codeTextGroup}>
                  <Text style={styles.codeLabel}>Your unique code</Text>
                  <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
                    {referralCode}
                  </Text>
                </View>
                <HapticTouchable
                  style={styles.copyIconButton}
                  onPress={handleCopyCode}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="copy-outline" size={22} color="#FFFFFF" />
                </HapticTouchable>
              </View>

              <HapticTouchable
                style={styles.shareButton}
                onPress={handleShareReferral}
              >
                <Text style={styles.shareButtonText}>Share your code</Text>
              </HapticTouchable>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{referralCount}</Text>
                  <Text style={styles.statLabel}>Friends Joined</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{referralCount}</Text>
                  <Text style={styles.statLabel}>Coins Earned</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.menuContainer}>
              <HapticTouchable style={styles.menuItem} onPress={() => router.push('/transactions')}>
                <Text style={styles.menuText}>Coin History</Text>
                <Text style={styles.menuArrow}>›</Text>
              </HapticTouchable>

              <View style={styles.divider} />

              <HapticTouchable style={styles.menuItem} onPress={handleGiveUsLove}>
                <Text style={styles.menuText}>Rate Enola</Text>
                <Text style={styles.menuArrow}>›</Text>
              </HapticTouchable>

              <View style={styles.divider} />

              <HapticTouchable style={styles.menuItem} onPress={handlePrivacyPolicy}>
                <Text style={styles.menuText}>Privacy Policy</Text>
                <Text style={styles.menuArrow}>›</Text>
              </HapticTouchable>

              <View style={styles.divider} />

              <HapticTouchable style={styles.menuItem} onPress={handleTerms}>
                <Text style={styles.menuText}>Terms & Conditions</Text>
                <Text style={styles.menuArrow}>›</Text>
              </HapticTouchable>

              <View style={styles.divider} />

              <HapticTouchable style={styles.menuItem} onPress={handleGetHelp}>
                <Text style={styles.menuText}>Get Help</Text>
                <Text style={styles.menuArrow}>›</Text>
              </HapticTouchable>

              <View style={styles.divider} />

              <HapticTouchable style={styles.menuItem} onPress={handleDeleteAccount}>
                <Text style={[styles.menuText, styles.menuTextDestructive]}>Delete Account</Text>
                <Text style={styles.menuArrow}>›</Text>
              </HapticTouchable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Made with care by Enola</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 28,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  referralTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  referralSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 24,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  codeTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  codeLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  code: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  copyIconButton: {
    padding: 4,
  },
  shareButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  shareButtonText: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#D1D1D6',
    marginHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    position: 'relative',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#8E8E93',
    fontWeight: '300',
  },
  menuContainer: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuText: {
    flex: 1,
    fontSize: 17,
    color: '#1C1C1E',
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  menuTextDestructive: {
    color: '#FF3B30',
  },
  menuArrow: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 20,
  },
  footer: {
    paddingTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});
