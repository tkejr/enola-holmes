import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StaggerIn } from '../../components/stagger-in';
import { Pagination } from '../../components/pagination';
import { onboardingAnswers } from '../../utils/onboardingAnswers';

type Option = {
  id: string;
  icon: string;
  label: string;
  wide?: boolean; // spans the full row instead of sharing a column
};

const options: Option[] = [
  { id: 'twitter', icon: 'logo-twitter', label: 'Twitter' },
  { id: 'instagram', icon: 'logo-instagram', label: 'Instagram' },
  { id: 'tiktok', icon: 'logo-tiktok', label: 'TikTok' },
  { id: 'reddit', icon: 'logo-reddit', label: 'Reddit' },
  { id: 'friend', icon: 'ticket-outline', label: 'Friend invite code', wide: true },
  { id: 'other', icon: 'ellipsis-horizontal-circle-outline', label: 'Other' },
];

export default function HowFoundScreen() {
  const [selected, setSelected] = useState<string | null>(null);

  const goNext = () => {
    onboardingAnswers.howFound = selected ?? undefined;
    router.push('/onboarding/search-target');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HapticTouchable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </HapticTouchable>
        <Text style={styles.logo}>Enola</Text>
      </View>

      <Pagination step={3} />

      <StaggerIn style={styles.content}>
        <Text style={styles.title}>How did you find us?</Text>

        <View style={styles.optionsGrid}>
          {options.map((option) => (
            <HapticTouchable
              key={option.id}
              style={[
                styles.optionButton,
                option.wide && styles.optionButtonWide,
                selected === option.id && styles.optionButtonSelected,
              ]}
              onPress={() => setSelected(option.id)}
            >
              <Ionicons name={option.icon as any} size={18} color={selected === option.id ? '#FFF' : '#1C1C1E'} />
              <Text
                numberOfLines={1}
                style={[
                  styles.optionLabel,
                  { color: selected === option.id ? '#FFF' : '#000' }
                ]}
              >{option.label}</Text>
            </HapticTouchable>
          ))}
        </View>
      </StaggerIn>

      <View style={styles.footer}>
        <HapticTouchable
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={goNext}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </HapticTouchable>

        <HapticTouchable onPress={goNext}>
          <Text style={styles.skipText}>Skip</Text>
        </HapticTouchable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#007AFF',
    fontWeight: '300',
  },
  logo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  optionButtonWide: {
    flexBasis: '100%',
  },
  optionButtonSelected: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  optionIcon: {
    fontSize: 18,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingBottom: 40,
    backgroundColor: '#FAFAFA',
  },
  button: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#D1D1D6',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  skipText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});
