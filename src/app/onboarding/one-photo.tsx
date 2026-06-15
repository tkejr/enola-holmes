import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnePhotoScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/onboarding/social-proof');
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Find their entire{'\n'}
          online presence
        </Text>

        <Text style={styles.subtitle}>
          all from <Text style={styles.accent}>ONE</Text> photo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    textAlign: 'center',
  },
  accent: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
