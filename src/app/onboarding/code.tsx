import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CodeScreen() {
  const [code, setCode] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>Enola</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.giftIcon}>
          <Text style={styles.gift}>🎁</Text>
        </View>

        <Text style={styles.title}>Got a Code?</Text>
        <Text style={styles.subtitle}>Redeem it for a free search</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit code"
          placeholderTextColor="#999"
          value={code}
          onChangeText={setCode}
          maxLength={6}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
        </View>

        <TouchableOpacity
          style={[styles.button, !code && styles.buttonDisabled]}
          onPress={() => router.push('/onboarding/rating')}
          disabled={!code}
        >
          <Text style={styles.buttonText}>Redeem</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/onboarding/rating')}>
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
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  giftIcon: {
    marginBottom: 28,
  },
  gift: {
    fontSize: 90,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
    marginBottom: 36,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
