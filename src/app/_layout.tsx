import { Stack, useNavigationContainerRef } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import * as Sentry from '@sentry/react-native';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { supabase } from '../utils/supabase';
import { identify } from '../utils/identity';

// Records expo-router screen changes as breadcrumbs on Sentry events.
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
  console.warn('⚠️ Sentry DSN missing — crash reporting is disabled');
}

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  // ponytail: 1.0 (trace everything) is fine at launch; lower once traffic grows.
  tracesSampleRate: 1.0,
  integrations: [navigationIntegration],
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Restores tracking identity on every launch: if a session exists, tie the
// user to RevenueCat/PostHog/Sentry so returning users' errors aren't
// <anonymous>. Lives under PostHogProvider so it can use the posthog instance.
function IdentityGate() {
  const posthog = usePostHog();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) identify(session.user.id, posthog);
    });
  }, []);
  return null;
}

function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  useEffect(() => {
    // Initialize RevenueCat
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    const apiKey =
      Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (apiKey) {
      Purchases.configure({ apiKey });
    } else {
      console.warn('⚠️ RevenueCat key missing for', Platform.OS);
    }

    // Hide splash screen after the app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''}
        options={{
          host: 'https://us.i.posthog.com',
          enableSessionReplay: true,
          // Face-search app: mask images/text so we never record the photos
          // users upload of people or any typed input. Privacy-critical.
          sessionReplayConfig: {
            maskAllImages: true,
            maskAllTextInputs: true,
          },
        }}
        autocapture
      >
        <IdentityGate />
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
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
