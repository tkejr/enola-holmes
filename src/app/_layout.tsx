import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { supabase } from '../utils/supabase';
import { identifyUser } from '../utils/revenuecat';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Initialize RevenueCat
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    const apiKey =
      Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (apiKey) {
      Purchases.configure({ apiKey });
      // Tie RevenueCat to the Supabase user so purchases (and the webhook's
      // app_user_id) map to the right profile. Covers returning users whose
      // session is restored on launch; signup handles the first-time case.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) identifyUser(session.user.id);
      });
    } else {
      console.warn('⚠️ RevenueCat key missing for', Platform.OS);
    }

    // Hide splash screen after the app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="crop" />
        <Stack.Screen name="scanning" />
        <Stack.Screen name="results" />
        <Stack.Screen name="coins" />
        <Stack.Screen name="history" />
        <Stack.Screen name="transactions" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="paywall" />
      </Stack>
    </GestureHandlerRootView>
  );
}
