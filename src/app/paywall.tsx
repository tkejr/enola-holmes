import { router, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { getSubscriptionOfferings, hasProEntitlementSynced } from '@/utils/revenuecat';

// Renders the RevenueCat-hosted Paywall template for the `default` offering instead of
// hand-coded cards. Design/prices live in the RC dashboard.
export default function PaywallScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  // 'loading' | offering | null(=failed). null must NOT strand the user on a blank
  // screen — App Review rejected 2.1(a) for exactly that when offerings didn't load.
  const [offering, setOffering] = useState<PurchasesOffering | null | 'loading'>('loading');

  // All routes into welcome carry the referral code so it survives to profile creation.
  // RC's paywall fires onPurchaseCompleted AND onDismiss when the sheet closes, so guard
  // against a double navigation. replace (not push) so back-swipe can't re-enter the paywall.
  const advanced = useRef(false);
  const goToWelcome = () => {
    if (advanced.current) return;
    advanced.current = true;
    router.replace({ pathname: '/onboarding/welcome', params: code ? { code } : {} });
  };

  useEffect(() => {
    let alive = true;
    // Already subscribed (e.g. reinstall with a live App Store sub, which RC surfaces via
    // the synced receipt even while still anonymous) — don't show a buy-again paywall.
    // Skip straight into the app; the webhook credits any owed coins on the logIn TRANSFER.
    hasProEntitlementSynced().then((isPro) => {
      if (!alive) return;
      if (isPro) goToWelcome();
      else getSubscriptionOfferings().then((o) => alive && setOffering(o));
    });
    return () => { alive = false; };
  }, []);

  // Offerings unavailable (no config for this storefront, network, StoreKit) — don't
  // trap the reviewer/user on a dead paywall; continue into the app for free.
  useEffect(() => {
    if (offering === null) goToWelcome();
  }, [offering]);

  // Spinner while loading; on failure the effect above advances, so show the spinner
  // rather than a blank grey screen for the frame before navigation.
  if (offering === 'loading' || offering === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1C1C1E" />
      </View>
    );
  }

  // The RC-hosted template already renders Restore Purchases + Terms/Privacy + the
  // auto-renew disclosure (Guideline 3.1.2), so we don't stack our own on top — doing
  // so overlapped the template's own footer. Configure those links in the RC dashboard.
  return (
    <RevenueCatUI.Paywall
      style={{ flex: 1 }}
      options={{ offering }}
      onPurchaseCompleted={goToWelcome}
      onRestoreCompleted={goToWelcome}
      onDismiss={goToWelcome} // template close button = "continue with free"
    />
  );
}
