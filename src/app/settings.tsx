import { router } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, Linking, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as StoreReview from 'expo-store-review';

export default function SettingsScreen() {
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      // Query profiles table directly instead of using RPC
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code, referral_count')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error loading referral info:', error);
      } else if (data) {
        setReferralCode(data.referral_code || '');
        setReferralCount(data.referral_count || 0);
      }
    } catch (error) {
      console.error('Error loading referral info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareReferral = async () => {
    if (!referralCode) return;

    try {
      await Share.share({
        message: `Join me on Enola and get 2 free coins! Use my referral code: ${referralCode}\n\nDownload: https://enola.app`,
        title: 'Join Enola',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;

    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const handleGiveUsLove = async () => {
    const isAvailable = await StoreReview.isAvailableAsync();

    if (isAvailable) {
      // Open native in-app review prompt
      await StoreReview.requestReview();
    } else {
      // Fallback to App Store URL if review prompt not available
      Linking.openURL('https://apps.apple.com/app/enola');
    }
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://enola.app/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://enola.app/terms');
  };

  const handleGetHelp = () => {
    Linking.openURL('mailto:help@tryenola.com');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Referral Card */}
          {!loading && referralCode && (
            <View style={styles.referralCard}>
              <Text style={styles.referralTitle}>Earn Free Coins</Text>
              <Text style={styles.referralSubtitle}>
                Get 1 coin for every person who uses your code
              </Text>

              <View style={styles.codeContainer}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>Your Code</Text>
                  <Text style={styles.code}>{referralCode}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyCode}
                >
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareReferral}
              >
                <Text style={styles.shareButtonText}>Share Referral Code</Text>
              </TouchableOpacity>

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
              <TouchableOpacity style={styles.menuItem} onPress={handleGiveUsLove}>
                <Text style={styles.menuText}>Rate Enola</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
                <Text style={styles.menuText}>Privacy Policy</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuItem} onPress={handleTerms}>
                <Text style={styles.menuText}>Terms & Conditions</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuItem} onPress={handleGetHelp}>
                <Text style={styles.menuText}>Get Help</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
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
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
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
  codeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  codeBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  codeLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: 3,
  },
  copyButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  shareButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  shareButtonText: {
    color: '#FFFFFF',
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
    color: '#007AFF',
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
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
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
