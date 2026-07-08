import { StyleSheet, View } from 'react-native';

// Onboarding progress dots. `step` is 1-based; a single source of truth for TOTAL means
// removing/adding a screen no longer leaves the counts out of sync across every file.
export const ONBOARDING_TOTAL = 6;

export function Pagination({ step, total = ONBOARDING_TOTAL }: { step: number; total?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i + 1 !== step && styles.dotInactive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Top strip under the header. Opaque bg + it lives above the ScrollView in flex flow,
  // so content scrolls beneath the header/bars rather than showing through them.
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
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
});
