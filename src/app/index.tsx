import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, Animated, Easing, Image } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import Reanimated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MagnifyingGlass } from '../components/magnifying-glass';
import { OnlyFansIcon } from '../components/onlyfans-icon';
import { hasCompletedOnboarding, resetOnboarding } from '../utils/storage';
import { supabase } from '../utils/supabase';

// The three intro "pages" are now phases of one screen. The mascot stays put;
// only the block below it swaps.
const findItems = [
  { text: 'Criminal Record', icon: 'shield-checkmark-outline' },
  { text: 'OnlyFans', icon: 'onlyfans' },
  { text: 'LinkedIn', icon: 'briefcase-outline' },
  { text: 'Hidden TikToks', icon: 'logo-tiktok' },
];
const ITEM_STAGGER = 400; // ms between each band appearing

// Mascot + glass geometry, measured from the 1106px source `enola-nolens.png`, in which
// Enola's raised fist grips a short VERTICAL handle stub with no lens (grip column x~638,
// handle visible y~353..405 px). The hand-free vector glass supplies lens + full handle;
// we sink its handle into that same fist so HER fingers wrap it, lens resting above.
const MASCOT = 260;
const SRC = 1106;
const S = MASCOT / SRC; // source px -> display px
// Where the vector lens should rest, and the grip column it must line up with (source px).
const LENS_CX = 634 * S; // centered on the dark handle-stub she actually grips (src x~628-644)
const LENS_CY = 250 * S; // lens rests above the raised hand; handle runs down through her fist
const LENS_R = 40 * S;   // natural glass size relative to the mascot
// MagnifyingGlass viewBox is 100x195: lens center (50,50) r32, handle vertical on x=50.
// Scale so the SVG lens radius (32/100 of width) equals LENS_R, then align lens center.
const GLASS_W = LENS_R / 0.32;
const GLASS_H = GLASS_W * 1.95;
const GLASS_LEFT = LENS_CX - 0.50 * GLASS_W;        // SVG lens/handle at x=50 (0.50 of width)
const GLASS_TOP = LENS_CY - (50 / 195) * GLASS_H;   // SVG lens center at y=50 of 195
// At t=0 the glass is lifted up and slightly out, then eases down into her fist.
const GLASS_FLY_X = 10;
const GLASS_FLY_Y = -40;
// Bounding box of her raised fist in source px, used to re-draw just the fist on top of the
// settled handle so her fingers occlude it. Measured from enola-nolens.png.
const FIST_X = 600 * S;
const FIST_Y = 352 * S;
const FIST_W = 58 * S;
const FIST_H = 62 * S;

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  // 'landing' -> 'find' -> 'photo' -> navigate to onboarding. The mascot never moves.
  const [phase, setPhase] = useState<'landing' | 'find' | 'photo'>('landing');
  // Magnifying glass zooms out from big-and-centered into its resting place above the title.
  const glass = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAuthAndOnboarding();
  }, []);

  // Once the landing shows: hold the big magnifying glass over the whole page for half a
  // second, then smoothly zoom it out until it submerges into Enola's (empty) hand.
  useEffect(() => {
    if (isLoading) return;
    glass.setValue(0);
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(glass, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
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
        // No session -> show welcome screen
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    console.log('Get Started pressed');
    setPhase('find');
  };

  // Drive the intro phases on a timer; the mascot stays fixed the whole time.
  useEffect(() => {
    if (phase === 'find') {
      // Wait for all bands to stagger in, then move on.
      const total = 400 + findItems.length * ITEM_STAGGER + 900;
      const t = setTimeout(() => setPhase('photo'), total);
      return () => clearTimeout(t);
    }
    if (phase === 'photo') {
      const t = setTimeout(() => router.replace('/onboarding/stats'), 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

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
        <View style={styles.mascotBox}>
          {/* The mascot with an EMPTY hand — no glass in it while the animation plays,
              so there's never a double glass. The flying vector glass below becomes the
              one she holds once it settles. */}
          <Image
            source={require('../../assets/images/enola-nolens.png')}
            resizeMode="contain"
            style={styles.mascot}
          />
          {/* A hand-free glass: lens + full handle only. Starts lifted & a bit bigger, then
              eases down until its full handle sinks into her fist and stays gripped. */}
          <Animated.View
            style={[
              styles.glass,
              {
                transform: [
                  { translateX: glass.interpolate({ inputRange: [0, 1], outputRange: [GLASS_FLY_X, 0] }) },
                  { translateY: glass.interpolate({ inputRange: [0, 1], outputRange: [GLASS_FLY_Y, 0] }) },
                  { scale: glass.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) },
                  { rotate: glass.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
                ],
              },
            ]}
          >
            <MagnifyingGlass size={GLASS_W} />
          </Animated.View>
          {/* Her fist, drawn again ON TOP of the settled glass so her fingers occlude the
              handle passing through them — the grip looks continuous, not cut off. Fades in
              only once the glass has landed, so it never covers the big flying glass. */}
          <Animated.View style={[styles.handClip, { opacity: glass }]} pointerEvents="none">
            <Image
              source={require('../../assets/images/enola-nolens.png')}
              resizeMode="contain"
              style={styles.handImage}
            />
          </Animated.View>
        </View>

        {/* Everything below the mascot swaps per phase; the mascot above never moves.
            A fixed-height box reserves the space so nothing re-centers between phases. */}
        <View style={styles.phaseBox}>
          {phase === 'landing' && (
            <Reanimated.View
              key="landing"
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
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
          )}

          {phase === 'find' && (
            <Reanimated.View
              key="find"
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.phaseCenter}
            >
              <Text style={styles.title}>Find their...</Text>
              <View style={styles.itemsList}>
                {findItems.map((item, index) => (
                  <Reanimated.View
                    key={index}
                    entering={FadeInDown.delay(400 + index * ITEM_STAGGER).duration(450)}
                    style={styles.item}
                  >
                    <Text style={styles.itemText}>{item.text}</Text>
                    {item.icon === 'onlyfans' ? (
                      <OnlyFansIcon size={24} color="#1C1C1E" />
                    ) : (
                      <Ionicons name={item.icon as any} size={24} color="#1C1C1E" />
                    )}
                  </Reanimated.View>
                ))}
              </View>
            </Reanimated.View>
          )}

          {phase === 'photo' && (
            <Reanimated.View
              key="photo"
              entering={FadeIn.duration(400)}
              style={styles.phaseCenter}
            >
              <Text style={styles.title}>
                Find their entire{'\n'}online presence
              </Text>
              <Text style={styles.photoSubtitle}>
                all from <Text style={styles.accent}>ONE</Text> photo.
              </Text>
            </Reanimated.View>
          )}
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
  },
  mascotBox: {
    width: MASCOT,
    height: MASCOT,
    marginBottom: 16,
  },
  // Fixed-height area under the mascot so swapping phase content never shifts the mascot.
  phaseBox: {
    height: 260,
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 24,
  },
  itemsList: {
    alignSelf: 'center',
    alignItems: 'flex-start',
    gap: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#9E9E9E',
  },
  photoSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    textAlign: 'center',
  },
  accent: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  mascot: {
    position: 'absolute',
    width: MASCOT,
    height: MASCOT,
  },
  glass: {
    position: 'absolute',
    left: GLASS_LEFT,
    top: GLASS_TOP,
    width: GLASS_W,
    height: GLASS_H,
  },
  // A window over just her fist; the mascot inside is offset so only the fist shows through.
  handClip: {
    position: 'absolute',
    left: FIST_X,
    top: FIST_Y,
    width: FIST_W,
    height: FIST_H,
    overflow: 'hidden',
  },
  handImage: {
    position: 'absolute',
    left: -FIST_X,
    top: -FIST_Y,
    width: MASCOT,
    height: MASCOT,
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
