import { Stack } from 'expo-router';

export default function RootLayout() {

  return (
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
  );
}
