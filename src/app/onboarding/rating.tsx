import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as StoreReview from 'expo-store-review';

export default function RatingScreen() {
  useEffect(() => {
    const requestReview = async () => {
      // Trigger native iOS App Store review popup
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      }
      // Navigate to next screen after a short delay
      setTimeout(() => {
        router.push('/onboarding/welcome');
      }, 500);
    };

    requestReview();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>Enola</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
});
