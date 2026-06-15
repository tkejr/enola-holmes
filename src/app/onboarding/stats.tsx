import { router } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StatsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>Enola</Text>
        <Text style={styles.settingsButton}>⚙️</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.iconsRow}>
          <Text style={styles.platformIcon}>🐝</Text>
          <Text style={styles.platformIcon}>🔥</Text>
          <Text style={styles.platformIcon}>💬</Text>
        </View>

        <Text style={styles.mainTitle}>The Reality of Online Dating...</Text>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>1 in 3</Text>
          <Text style={styles.statDescription}>
            people have met someone online who wasn't who they claimed to be.
          </Text>
          <Text style={styles.statSource}>Pew Research Center</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>53%</Text>
          <Text style={styles.statDescription}>
            of online daters admit to lying on their profiles about age, appearance, or relationship status.
          </Text>
          <Text style={styles.statSource}>Journal of Communication</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>63%</Text>
          <Text style={styles.statDescription}>
            of users don't research their dates before meeting them in person.
          </Text>
          <Text style={styles.statSource}>Social Catfish Survey</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/onboarding/privacy')}
        >
          <Text style={styles.buttonText}>Next</Text>
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
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'center',
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
  scrollView: {
    backgroundColor: '#FAFAFA',
  },
  logo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    fontSize: 20,
  },
  content: {
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 20,
  },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  platformIcon: {
    fontSize: 40,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  statCard: {
    marginBottom: 32,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: -0.9,
  },
  statDescription: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 24,
    marginBottom: 8,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  statSource: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
    letterSpacing: -0.2,
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
