import { StyleSheet, View, Text, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { restorePurchases, hasProEntitlement } from '@/utils/revenuecat';

// App Store legal links. These pages MUST resolve before submission (Guideline 3.1.2 / 1.5).
export const LEGAL_URLS = {
  terms: 'https://tryenola.com/terms',
  privacy: 'https://tryenola.com/privacy',
};

const openUrl = async (url: string) => {
  try {
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Unavailable', "Couldn't open that link on this device.");
  } catch {
    Alert.alert('Unavailable', "Couldn't open that link on this device.");
  }
};

// Required subscription footer: auto-renewal disclosure + Restore Purchases + EULA/Privacy
// links. Apple rejects subscription paywalls that omit any of these.
export function SubscriptionDisclosure() {
  const [restoring, setRestoring] = useState(false);

  const onRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      const pro = await hasProEntitlement();
      Alert.alert(
        pro ? 'Purchases Restored' : 'Nothing to Restore',
        pro ? 'Your subscription has been restored.' : 'No previous purchases were found for this account.',
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onRestore} disabled={restoring} style={styles.restoreBtn}>
        {restoring ? (
          <ActivityIndicator color="#8E8E93" />
        ) : (
          <Text style={styles.restoreText}>Restore Purchases</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclosure}>
        Subscriptions renew automatically at the price and period shown unless canceled at
        least 24 hours before the end of the current period. Manage or cancel anytime in your
        App Store account settings. Payment is charged to your Apple ID on confirmation.
      </Text>

      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.terms)}>
          <Text style={styles.link}>Terms of Use</Text>
        </TouchableOpacity>
        <Text style={styles.dot}> • </Text>
        <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.privacy)}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8, paddingHorizontal: 8, alignItems: 'center', gap: 12 },
  restoreBtn: { paddingVertical: 8 },
  restoreText: { fontSize: 15, fontWeight: '600', color: '#000000', letterSpacing: -0.3 },
  disclosure: { fontSize: 11, lineHeight: 16, color: '#8E8E93', textAlign: 'center' },
  linksRow: { flexDirection: 'row', alignItems: 'center' },
  link: { fontSize: 12, color: '#8E8E93', textDecorationLine: 'underline' },
  dot: { fontSize: 12, color: '#8E8E93' },
});
