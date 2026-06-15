import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Option = {
  id: string;
  icon: string;
  label: string;
};

const options: Option[] = [
  { id: 'twitter', icon: '𝕏', label: 'Twitter' },
  { id: 'instagram', icon: '📷', label: 'Instagram' },
  { id: 'tiktok', icon: '🎵', label: 'TikTok' },
  { id: 'reddit', icon: '🤖', label: 'Reddit' },
  { id: 'friend', icon: '🎟️', label: 'Friend invite code' },
  { id: 'other', icon: '📋', label: 'Other' },
];

export default function HowFoundScreen() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>Enola</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>How did you find us?</Text>

        <View style={styles.optionsGrid}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionButton,
                selected === option.id && styles.optionButtonSelected,
              ]}
              onPress={() => setSelected(option.id)}
            >
              <Text style={styles.optionIcon}>{option.icon}</Text>
              <Text style={[
                styles.optionLabel,
                { color: selected === option.id ? '#FFF' : '#000' }
              ]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
        </View>

        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={() => router.push('/onboarding/search-target')}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/onboarding/search-target')}>
          <Text style={styles.skipText}>Skip</Text>
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
    justifyContent: 'center',
  },
  optionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 6,
  },
  dot: {
    width: 24,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1C1C1E',
  },
  dotInactive: {
    backgroundColor: '#D1D1D6',
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
