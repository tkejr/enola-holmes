import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, Animated, Easing, Image, useWindowDimensions } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hasCompletedOnboarding, resetOnboarding } from '../utils/storage';
import { supabase } from '../utils/supabase';
import { restoreAnonSession } from '../utils/anonAuth';
import { identify } from '../utils/identity';
import { usePostHog } from 'posthog-react-native';

// Mascot + glass geometry. `enola-glass-full.png` (87x190) is a pixel crop of
// `enola-body.png` at source (619, 207) with the finger-covered part of the bar synthesized,
// so the flying glass has a complete bar and no severed fingertips. Her hand in
// `enola-nolens.png` is untouched original art (closed fist, knuckles top at source y~333).
// A clip window ending at that knuckle line makes the bar visibly sink INTO the fist as the
// glass descends; once settled we swap the base to `enola-body.png` — fingers wrap the bar,
// and the final frame is untouched original art.
const MASCOT_BASE = 260; // reference size; the real MASCOT scales to screen width at runtime
const SRC = 1106;
const S = MASCOT_BASE / SRC; // source px -> display px (at base size; multiply by `k` for actual)
const GLASS_X = 619 * S;
const GLASS_Y = 207 * S;
const GLASS_W = 87 * S;
const GLASS_H = 190 * S;
const HAND_TOP = 307 * S; // fingertip line: the flying glass is clipped below it (submerge)
const FLY_SPACE = 130;    // base px of headroom above the mascot box for the airborne glass

export default function HomeScreen() {
  const posthog = usePostHog();
  const { width, height } = useWindowDimensions();
  // Scale the whole mascot rig to the device: fill ~62% of width, but never dwarf a short
  // screen or balloon on a tablet. Everything mascot-relative (glass, fist) derives from `k`,
  // so scaling this one number keeps the lens/fist alignment correct on every aspect ratio.
  // Fit the smaller of width/height so it never overflows either dimension, and cap at 360 so
  // it doesn't balloon on a tablet. No 200 floor: `Math.max(200, ...)` defeated the height
  // guard and overflowed short/landscape screens.
  const MASCOT = Math.min(width * 0.62, height * 0.34, 360);
  const k = MASCOT / MASCOT_BASE;
  // phaseBox height also tracks the mascot so the mascot+text block stays vertically centered
  // and never overflows a small screen.
  const phaseBoxHeight = Math.min(260, height * 0.34);

  const [isLoading, setIsLoading] = useState(true);
  // Magnifying glass swoops from big-and-overhead down into her hand; once settled we swap
  // to the original one-piece artwork.
  const [landed, setLanded] = useState(false);
  const glass = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAuthAndOnboarding();
  }, []);

  // Once the landing shows: hold the big magnifying glass overhead for half a second, then
  // swoop it down into Enola's empty hand. Easing.back overshoots at the end — the glass
  // sinks a touch into her grip and settles back, like the hand catching it — and finishes
  // at an exact moment, so the swap to the one-piece artwork is seamless.
  useEffect(() => {
    if (isLoading || landed) return;
    glass.setValue(0);
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(glass, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => finished && setLanded(true));
  }, [isLoading]);

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

        // Check if they've completed onboarding
        const completed = await hasCompletedOnboarding();
        console.log('Onboarding completed:', completed);

        if (completed) {
          // Has session AND completed onboarding -> go to app
          router.replace('/(tabs)');
        } else {
          // Has session but NOT completed onboarding -> show onboarding
          setIsLoading(false);
        }
      } else {
        // No session — but AsyncStorage is wiped on uninstall, so this may be a reinstall
        // of an existing anonymous account. Try restoring it from the iOS Keychain before
        // showing the welcome screen; on success the user's uid (coins/history/subscription)
        // comes back instead of a fresh account.
        const restoredId = await restoreAnonSession();
        if (restoredId) {
          console.log('Anon session restored from Keychain:', restoredId);
          await identify(restoredId, posthog);
          const completed = await hasCompletedOnboarding();
          router.replace(completed ? '/(tabs)' : '/onboarding/welcome');
        } else {
          // Genuinely new user -> show welcome screen
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
    router.replace('/onboarding/stats');
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
        <View style={[styles.mascotBox, { width: MASCOT, height: MASCOT }]}>
          {/* Empty-handed mascot while the glass is airborne; the untouched original artwork
              (glass in hand, fingers wrapping the handle) once it lands. */}
          <Image
            source={
              landed
                ? require('../../assets/images/enola-body.png')
                : require('../../assets/images/enola-nolens.png')
            }
            resizeMode="contain"
            style={[styles.mascot, { width: MASCOT, height: MASCOT }]}
          />
          {/* The real art glass with a full bar, flying into her hand. The window around it
              ends at her knuckle line, so as the glass descends the bar visibly submerges
              into her fist; her fingers wrap it via the enola-body swap once it settles. */}
          {!landed && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: -FLY_SPACE * k,
                width: MASCOT,
                height: (FLY_SPACE + HAND_TOP) * k,
                overflow: 'hidden',
              }}
              pointerEvents="none"
            >
              <Animated.View
                style={[
                  styles.glass,
                  {
                    left: GLASS_X * k,
                    top: (FLY_SPACE + GLASS_Y) * k,
                    width: GLASS_W * k,
                    height: GLASS_H * k,
                    transform: [
                      // Position clamps at the resting point: Easing.back overshoots past 1,
                      // and unclamped translateY would sink the round lens below the HAND_TOP
                      // clip line and flat-cut it. The settle wobble lives on scale/rotate,
                      // which never cross the clip.
                      { translateX: glass.interpolate({ inputRange: [0, 1], outputRange: [-26 * k, 0], extrapolate: 'clamp' }) },
                      { translateY: glass.interpolate({ inputRange: [0, 1], outputRange: [-110 * k, 0], extrapolate: 'clamp' }) },
                      { scale: glass.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) },
                      { rotate: glass.interpolate({ inputRange: [0, 1], outputRange: ['-22deg', '0deg'] }) },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('../../assets/images/enola-glass-full.png')}
                  resizeMode="contain"
                  style={{ width: GLASS_W * k, height: GLASS_H * k }}
                />
              </Animated.View>
            </View>
          )}
        </View>

        <View style={[styles.phaseBox, { height: phaseBoxHeight }]}>
          <Reanimated.View
            key="landing"
            entering={FadeIn.duration(300)}
            style={styles.phaseCenter}
          >
            <HapticTouchable onLongPress={handleResetOnboarding} delayLongPress={2000}>
              <Text style={styles.logo}>
                <Text style={styles.greeting}>Hi, I&apos;m </Text>Enola
              </Text>
            </HapticTouchable>
            <Text style={styles.subtitle}>Your personal search assistant</Text>

            <HapticTouchable style={styles.button} onPress={handleGetStarted} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Get Started</Text>
            </HapticTouchable>
          </Reanimated.View>
        </View>
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
    // Keep the column phone-width and centered on tablets so text/button don't stretch
    // edge-to-edge across a wide screen.
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  // Size set inline (scales with device); see MASCOT in the component.
  mascotBox: {
    marginBottom: 16,
  },
  // Height set inline so it tracks the mascot; reserves space so swapping phase content
  // never shifts the mascot.
  phaseBox: {
    width: '100%',
  },
  phaseCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  // Dimensions set inline (scale with device).
  mascot: {
    position: 'absolute',
  },
  glass: {
    position: 'absolute',
  },
  logo: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  greeting: {
    fontWeight: '400',
    color: '#8E8E93',
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
