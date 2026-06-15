import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hasCompletedOnboarding, resetOnboarding } from '../utils/storage';
import { supabase } from '../utils/supabase';

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthAndOnboarding();
  }, []);

  const checkAuthAndOnboarding = async () => {
    try {
      // First check if user has an active session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Supabase auth error:', error);
        // Continue without auth
        setIsLoading(false);
        return;
      }

      if (session) {
        console.log('Active session found, user logged in:', session.user.id);
        // User has a session, skip to main app
        router.replace('/(tabs)');
      } else {
        // No session, check if they've completed onboarding
        const completed = await hasCompletedOnboarding();
        if (completed) {
          router.replace('/(tabs)');
        } else {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    console.log('Get Started pressed');
    router.push('/onboarding/find-their');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#1C1C1E" />
        </View>
      </SafeAreaView>
    );
  }

  const handleResetOnboarding = async () => {
    Alert.alert(
      'Reset Onboarding',
      'This will reset your onboarding progress. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetOnboarding();
            Alert.alert('Success', 'Onboarding reset! Restart the app.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          onLongPress={handleResetOnboarding}
          delayLongPress={2000}
        >
          <Text style={styles.logo}>Enola</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Welcome to Enola</Text>
        <Text style={styles.subtitle}>Your personal search assistant</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  button: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
