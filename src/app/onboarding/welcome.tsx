import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, Text, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setOnboardingCompleted } from '../../utils/storage';
import { onboardingAnswers } from '../../utils/onboardingAnswers';
import { supabase } from '../../utils/supabase';
import { identify } from '../../utils/identity';
import { usePostHog } from 'posthog-react-native';
import { StaggerIn } from '../../components/stagger-in';
import { Pagination } from '../../components/pagination';
import { useState, useMemo, useEffect } from 'react';
import * as StoreReview from 'expo-store-review';
import Animated, {
  useSharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

const REVIEWS = [
  { text: 'finally found the information I needed. this app is amazing', author: 'Sarah M.' },
  { text: 'dodged a total catfish thanks to Enola. worth every penny', author: 'Jessica R.' },
  { text: 'super easy to use and the results were spot on', author: 'Megan T.' },
  { text: 'gave me peace of mind before meeting someone new', author: 'Ashley K.' },
  { text: 'wish I had this years ago. genuinely a lifesaver', author: 'Emily D.' },
  { text: 'caught my match lying about their whole profile', author: 'Olivia P.' },
  { text: 'fast, private, and it actually works', author: 'Rachel B.' },
];

const CARD_W = Math.min(Dimensions.get('window').width - 80, 320);
const SPACING = 16;
const SNAP = CARD_W + SPACING;

const STAR_ROLL = 26; // matches the referral CodeBox counter-wheel travel

// A single star that rolls in like the referral-code counter wheel: slides up + fades,
// cubic ease-out, staggered by index so the row cascades left-to-right on mount.
function Star({ index }: { index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(200 + index * 90, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * -STAR_ROLL },
      { scale: 0.6 + progress.value * 0.4 },
    ],
  }));
  return (
    <Animated.View style={style}>
      <Ionicons name="star" size={36} color="#F5B301" style={styles.star} />
    </Animated.View>
  );
}

function ReviewCard({ review, index, scrollX }: { review: typeof REVIEWS[number]; index: number; scrollX: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    const pos = scrollX.value / SNAP - index;
    const scale = interpolate(pos, [-1, 0, 1], [0.86, 1, 0.86], Extrapolation.CLAMP);
    const rotateY = interpolate(pos, [-1, 0, 1], [35, 0, -35], Extrapolation.CLAMP);
    const opacity = interpolate(pos, [-1, 0, 1], [0.55, 1, 0.55], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ perspective: 900 }, { scale }, { rotateY: `${rotateY}deg` }],
    };
  });

  return (
    <Animated.View style={[styles.testimonialCard, animatedStyle]}>
      <Text style={styles.testimonial}>"{review.text}"</Text>
      <Text style={styles.author}>— {review.author}</Text>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const posthog = usePostHog();
  const [loading, setLoading] = useState(false);
  const scrollX = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  // Shuffle once per mount so the order feels fresh each time.
  const reviews = useMemo(() => [...REVIEWS].sort(() => Math.random() - 0.5), []);

  // The "Swipe" hint pulses left↔right to invite swiping (cards stay centered).
  const hintX = useSharedValue(0);
  useEffect(() => {
    hintX.value = withDelay(
      1200,
      withRepeat(withSequence(withTiming(6, { duration: 600 }), withTiming(0, { duration: 600 })), -1, false)
    );
  }, []);
  const hintStyle = useAnimatedStyle(() => ({ transform: [{ translateX: hintX.value }] }));

  const handleGetStarted = async () => {
    setLoading(true);
    console.log('Get Started clicked - creating user and profile');

    // Ask for the App Store rating on tap. requestReview resolves once the user
    // rates or dismisses ("Not Now"); either way we then finish onboarding below.
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    }

    try {
      // Anonymous device account: auto-generated credentials on our own domain so the
      // user gets a zero-friction start. Session is persisted by Supabase in AsyncStorage.
      // High-entropy local part keeps addresses unique without collisions.
      const unique = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
      const tempEmail = `user_${unique}@users.enola.app`;
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: tempEmail,
        password: tempPassword,
        options: {
          emailRedirectTo: undefined,
          data: {
            skip_confirmation: true
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        Alert.alert('Error', 'Failed to create account. Please try again.');
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        Alert.alert('Error', 'Failed to create account. Please try again.');
        setLoading(false);
        return;
      }

      console.log('User account created:', userId);

      // Tie this Supabase user to RevenueCat/PostHog/Sentry BEFORE they can reach
      // the paywall or hit an error. Without RC identify, a first purchase maps to
      // RC's anonymous id and the webhook credits coins to nobody; without Sentry
      // setUser, an onboarding error would report as <anonymous>.
      await identify(userId, posthog);

      // Create profile using RPC function
      const { data: profileResult, error: profileError } = await supabase
        .rpc('create_user_profile', {
          user_id: userId,
          user_email: tempEmail,
          referral_code_used: code || null
        });

      if (profileError) {
        console.error('Profile creation error via RPC:', profileError);
        Alert.alert('Error', 'Failed to set up account. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Profile created:', profileResult);

      // An invalid code returns success:true, referral_applied:false (NOT a failure),
      // so key off whether the code was actually applied — not success. Otherwise a
      // bad code is silently ignored and the user is told nothing. already_redeemed is
      // the only case we swallow (their account is fine; re-redeeming isn't allowed).
      if (code && profileResult && profileResult.error !== 'already_redeemed' && !profileResult.referral_applied) {
        Alert.alert('Invalid code', "That referral code didn't work, but your account is ready.");
      }
      // profile still exists (trigger + upsert guarantee it) — continue.

      // Persist the questionnaire selections gathered before the account existed.
      // Non-fatal: a failure here shouldn't block finishing onboarding.
      const { error: answersError } = await supabase
        .from('profiles')
        .update({ onboarding_answers: onboardingAnswers })
        .eq('id', userId);
      if (answersError) console.error('Error saving onboarding answers:', answersError);

      // Mark onboarding complete in database and navigate
      await setOnboardingCompleted(userId);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HapticTouchable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </HapticTouchable>
        <Text style={styles.logo}>Enola</Text>
      </View>

      <Pagination step={7} />

      <View style={styles.content}>
        {/* Stars roll in with the referral counter-wheel animation, so they're rendered
            directly (not inside StaggerIn, which would double up the entry). */}
        <View style={styles.starsContainer}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} index={i} />
          ))}
        </View>

        <StaggerIn delay={600}>
          <Text style={styles.title}>Join 5,000+ Users</Text>
          <Text style={styles.subtitle}>Be one of them — a quick rating helps us grow.</Text>
        </StaggerIn>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        style={styles.carouselWrap}
      >
        {reviews.map((review, i) => (
          <ReviewCard key={review.author} review={review} index={i} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <Animated.View style={[styles.swipeHint, hintStyle]}>
        <Text style={styles.swipeHintText}>Swipe for more</Text>
        <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
      </Animated.View>

      <View style={styles.footer}>
        <HapticTouchable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGetStarted}
          activeOpacity={0.7}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
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
    color: '#000000',
    fontWeight: '300',
  },
  logo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  star: {
    fontSize: 36,
    marginHorizontal: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
    marginBottom: 36,
    fontWeight: '400',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  carouselWrap: {
    flexGrow: 0,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  swipeHintText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  carousel: {
    // Center the first/last card in the viewport so snapping lands them mid-screen.
    paddingHorizontal: (Dimensions.get('window').width - CARD_W) / 2,
    alignItems: 'center',
    paddingVertical: 20,
  },
  testimonialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: CARD_W,
    marginRight: SPACING,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  testimonial: {
    fontSize: 17,
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
    letterSpacing: -0.4,
    fontWeight: '400',
  },
  author: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
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
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
