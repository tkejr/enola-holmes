import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import type { PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { getSubscriptionOfferings } from '@/utils/revenuecat';

// Renders the RevenueCat-hosted Paywall template for the `default` offering instead of
// hand-coded cards. Design/prices live in the RC dashboard.
export default function PaywallScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    getSubscriptionOfferings().then(setOffering);
  }, []);

  // All routes into welcome carry the referral code so it survives to profile creation.
  const goToWelcome = () =>
    router.push({ pathname: '/onboarding/welcome', params: code ? { code } : {} });

  // Blank backdrop until the offering loads so the template has packages to draw.
  if (!offering) return <View style={{ flex: 1, backgroundColor: '#FAFAFA' }} />;

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
