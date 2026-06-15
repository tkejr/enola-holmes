import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@enola_onboarding_completed';

export const setOnboardingCompleted = async () => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (error) {
    console.error('Error saving onboarding status:', error);
  }
};

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error reading onboarding status:', error);
    return false;
  }
};

export const resetOnboarding = async () => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (error) {
    console.error('Error resetting onboarding status:', error);
  }
};
