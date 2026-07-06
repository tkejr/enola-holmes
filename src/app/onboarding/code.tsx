import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, Text, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Animated } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { StaggerIn } from '../../components/stagger-in';
import { Pagination } from '../../components/pagination';
import { CodeBox } from '../../components/code-box';
import { supabase } from '@/utils/supabase';

// Referral codes are 6 chars, A-Z0-9 (see supabase/UPDATE-REFERRAL-CODE-LENGTH.sql).
const CODE_LENGTH = 6;
const tickSound = require('../../../assets/sounds/counter-tick.m4a');

export default function CodeScreen() {
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // shown red + reddens boxes
  const [redeemed, setRedeemed] = useState(false); // drives the "Code Redeemed" top toast
  const inputRef = useRef<TextInput>(null);
  const player = useAudioPlayer(tickSound);
  const toastY = useRef(new Animated.Value(-100)).current;
  const insets = useSafeAreaInsets();

  // Validate the code before advancing. A wrong code must NOT let the user through —
  // only Skip does that. FAIL CLOSED: if we can't confirm the code is real (RPC
  // missing, network down, anything), we block and say so — we never advance on an
  // unverified code, or a random string would slip in. Codeless users use Skip.
  const onRedeem = async () => {
    if (code.length !== CODE_LENGTH || checking) return;
    setChecking(true);
    setErrorMsg(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('referral_code_exists', { p_code: code });
      if (rpcError) throw rpcError;
      if (data === true) {
        Keyboard.dismiss();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRedeemed(true);
        // Let the toast land and be seen before moving on.
        setTimeout(() => router.push({ pathname: '/paywall', params: { code } }), 1100);
      } else {
        setErrorMsg("That code isn't valid. Check it, or tap Skip.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {
      // Couldn't verify — block rather than let an unchecked code through.
      console.error('referral_code_exists failed:', e);
      setErrorMsg("Couldn't check that code right now. Try again, or tap Skip.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setChecking(false);
    }
  };

  // Play the tick even when the phone is on silent/vibrate — it's UI feedback, not media.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Slide the toast down when a code is redeemed. We navigate away shortly after, so
  // there's no slide-out — the screen change removes it.
  useEffect(() => {
    if (!redeemed) return;
    Animated.spring(toastY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }).start();
  }, [redeemed, toastY]);

  // One real (hidden) TextInput drives six display boxes. Using a single field means
  // paste, autofill and backspace all "just work" — we only sanitize + cap the value.
  const boxes = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');

  // Normalize any string (typed or pasted) to the code alphabet + length.
  const sanitize = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

  // Long-press the boxes to paste — the invisible input suppresses the native paste
  // callout, so we offer it explicitly by reading the clipboard ourselves.
  const onPaste = async () => {
    const clip = sanitize(await Clipboard.getStringAsync());
    if (!clip) return;
    setErrorMsg(null);
    setCode(clip);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // A box rolled a new character in — play the counter tick + a light haptic. Called
  // once per newly-filled box, so a paste ticks rapidly across all filled boxes.
  const onRoll = () => {
    player.seekTo(0);
    player.play();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container}>
      {redeemed && (
        <Animated.View
          style={[styles.toast, { top: insets.top + 8, transform: [{ translateY: toastY }] }]}
          pointerEvents="none"
        >
          <View style={styles.toastTick}>
            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
          </View>
          <Text style={styles.toastText}>Code Redeemed · 1 Coin added</Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <HapticTouchable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </HapticTouchable>
        <Text style={styles.logo}>Enola</Text>
      </View>

      <Pagination step={6} />

      {/* No KeyboardAvoidingView: lifting the footer made Redeem/Skip overlap the code
          boxes. Instead the footer is hidden while typing and a down-chevron closes the
          keyboard. Tapping the background also dismisses it. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <StaggerIn style={styles.content}>
        <View style={styles.giftIcon}>
          <Ionicons name="gift-outline" size={90} color="#1C1C1E" />
        </View>

        <Text style={styles.title}>Got a Code?</Text>
        <Text style={styles.subtitle}>Redeem it for a free search</Text>
        <Text style={styles.pasteHint}>Tip: press and hold the boxes to paste</Text>

        <Pressable
          style={styles.boxesRow}
          onPress={() => inputRef.current?.focus()}
          onLongPress={onPaste}
          delayLongPress={350}
        >
          {boxes.map((char, i) => {
            // The "active" box is the first empty slot (or the last one when full).
            const isActive = focused && (i === code.length || (code.length === CODE_LENGTH && i === CODE_LENGTH - 1));
            return (
              <CodeBox
                key={i}
                char={char}
                active={isActive}
                error={!!errorMsg}
                flipDown={i % 2 === 0} // alternate roll direction per box
                delay={i * 40} // cascade left-to-right on paste; small enough to not lag typing
                onRoll={onRoll}
              />
            );
          })}
          {/* The real input, stretched invisibly over the boxes so taps focus it and the
              caret/selection stay hidden. maxLength caps paste to 6 chars automatically. */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={(t) => { setErrorMsg(null); setCode(sanitize(t)); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={CODE_LENGTH}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            textContentType="oneTimeCode"
            caretHidden
          />
        </Pressable>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {focused && (
          <HapticTouchable style={styles.dismissButton} onPress={Keyboard.dismiss}>
            <Ionicons name="chevron-down" size={22} color="#1C1C1E" />
            <Text style={styles.dismissText}>Close keyboard</Text>
          </HapticTouchable>
        )}
      </StaggerIn>
      </TouchableWithoutFeedback>

      {/* Hidden while typing so Redeem/Skip never overlap the code boxes. Close the
          keyboard (chevron above, or tap the background) to bring them back. */}
      {!focused && (
        <View style={styles.footer}>
          <HapticTouchable
            style={[styles.button, (code.length !== CODE_LENGTH || checking) && styles.buttonDisabled]}
            onPress={onRedeem}
            disabled={code.length !== CODE_LENGTH || checking}
          >
            {checking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Redeem</Text>
            )}
          </HapticTouchable>

          <HapticTouchable onPress={() => router.push('/paywall')}>
            <Text style={styles.skipText}>Skip</Text>
          </HapticTouchable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  toastTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.3,
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
    marginBottom: 8,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  pasteHint: {
    fontSize: 13,
    color: '#B0B0B5',
    marginBottom: 32,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  dismissButton: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: -0.2,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    // Absolute fill gives the invisible input the full row's hit area so taps focus it.
  },
  footer: {
    paddingHorizontal: 40,
    paddingBottom: 8, // SafeAreaView already adds the bottom inset; this footer flows (not absolute)
    paddingTop: 12,
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
