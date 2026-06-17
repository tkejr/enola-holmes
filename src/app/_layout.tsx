import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Initialize RevenueCat
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: 'test_oiKinqnTvLpPTIMdzcuDacNWBmh' });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: 'test_oiKinqnTvLpPTIMdzcuDacNWBmh' });
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
        <Stack.Screen name="scanning" />
        <Stack.Screen name="results" />
        <Stack.Screen name="coins" />
        <Stack.Screen name="history" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="paywall" />
      </Stack>
    </GestureHandlerRootView>
  );
}
