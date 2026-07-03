import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, Alert, Linking } from 'react-native';
// expo-image decodes the large (1.8MB) headshot PNG reliably on device; RN's Image
// rendered it in the simulator but left it blank on physical devices.
import { Image } from 'expo-image';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { EnolaHeading } from '@/components/enola-heading';
import { LEGAL_URLS } from '@/components/subscription-disclosure';

export default function HomeScreen() {
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<{ code: string; count: number } | null>(null);

  // Reload coins every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserCoins();
    }, [])
  );

  const loadUserCoins = async () => {
    try {
      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('No session found - using default coins');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('coins, referral_code, referral_count')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error loading coins:', error);
      } else if (data) {
        setCoins(data.coins);
        setReferral({ code: data.referral_code ?? '', count: data.referral_count ?? 0 });
      }
    } catch (error) {
      console.error('Error loading coins:', error);
    }
  };

  // Coins are deducted only in scanning.tsx via record_search_and_deduct_coin, tied to a
  // completed search. This screen only displays the balance — no spend here, or it would
  // double-charge (two coins per scan).

  const pickImageFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/scanning',
        params: { imageUri: result.assets[0].uri },
      });
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/scanning',
        params: { imageUri: result.assets[0].uri },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftIcons}>
          <HapticTouchable
            style={styles.iconButton}
            onPress={() =>
              router.push({
                pathname: '/settings',
                params: referral ? { code: referral.code, count: String(referral.count) } : {},
              })
            }
          >
            <Ionicons name="settings-outline" size={18} color="#1C1C1E" />
          </HapticTouchable>
          <HapticTouchable
            style={styles.iconButton}
            onPress={() => router.push('/history')}
          >
            <Ionicons name="time-outline" size={18} color="#1C1C1E" />
          </HapticTouchable>
        </View>

        <EnolaHeading style={styles.logo} />

        <HapticTouchable
          style={styles.coinBadge}
          onPress={() => router.push('/coins')}
        >
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinText}>{coins ?? '–'}</Text>
        </HapticTouchable>
      </View>

      <View style={styles.content}>
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>
            Upload their photo,{'\n'}
            <Text style={styles.speechTextAccent}>I'll do the digging</Text>
          </Text>
          <View style={styles.bubbleTail} />
        </View>

        <View style={styles.characterContainer}>
          <Image
            source={require('../../../assets/images/enola-headhshot.png')}
            style={styles.character}
            contentFit="contain"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <HapticTouchable
          style={styles.cameraButton}
          onPress={takePhoto}
        >
          <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
          <Text style={styles.cameraButtonText}>Use Camera</Text>
        </HapticTouchable>

        <HapticTouchable
          style={styles.libraryButton}
          onPress={pickImageFromGallery}
        >
          <Ionicons name="images-outline" size={20} color="#1C1C1E" />
          <Text style={styles.libraryButtonText}>Photo Library</Text>
        </HapticTouchable>

        <Text style={styles.disclosureText}>
          The photo you choose is sent to a third-party face-search service to look for
          matching public profiles. See our{' '}
          <Text
            style={styles.disclosureLink}
            onPress={() => Linking.openURL(LEGAL_URLS.privacy).catch(() => {})}
          >
            Privacy Policy
          </Text>
          .
        </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  leftIcons: {
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconText: {
    fontSize: 18,
  },
  logo: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    top: 12,
    pointerEvents: 'none',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  coinIcon: {
    fontSize: 18,
  },
  coinText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 18,
    marginBottom: 20,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  speechText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  speechTextAccent: {
    color: '#8E7654',
    fontWeight: '600',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  characterContainer: {
    marginTop: 20,
  },
  character: {
    width: 180,
    height: 180,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 12,
  },
  cameraButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cameraButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  libraryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  libraryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  buttonIcon: {
    fontSize: 20,
  },
  trustText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  disclosureText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  disclosureLink: {
    textDecorationLine: 'underline',
  },
});
