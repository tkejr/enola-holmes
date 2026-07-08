import { router } from 'expo-router';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { StaggerIn } from '../../components/stagger-in';

export default function PhotoUploadScreen() {
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
      // Complete onboarding and go to main app
      router.replace('/(tabs)');
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
      // Complete onboarding and go to main app
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftIcons}>
          <HapticTouchable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </HapticTouchable>
        </View>

        <Text style={styles.logo}>Enola</Text>

        <View style={styles.coinBadge}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinText}>14</Text>
        </View>
      </View>

      <StaggerIn style={styles.content}>
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>
            Upload the image,{'\n'}
            <Text style={styles.speechTextAccent}>I'll find for you</Text>
          </Text>
          <View style={styles.bubbleTail} />
        </View>

        <View style={styles.characterContainer}>
          <Ionicons name="search" size={40} color="#1C1C1E" />
        </View>
      </StaggerIn>

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

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <Ionicons name="lock-closed" size={12} color="#8E8E93" />
          <Text style={[styles.trustText, { marginTop: 0 }]}>Trusted for image search</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  leftIcons: {
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#2C1810',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    top: 15,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  coinIcon: {
    fontSize: 20,
  },
  coinText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 20,
    marginBottom: 20,
    position: 'relative',
  },
  speechText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 28,
  },
  speechTextAccent: {
    color: '#8B6F47',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  characterContainer: {
    marginTop: 20,
  },
  character: {
    fontSize: 200,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    gap: 12,
  },
  cameraButton: {
    backgroundColor: '#E8DCC8',
    borderRadius: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cameraButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  libraryButton: {
    backgroundColor: '#FFF9E6',
    borderRadius: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  libraryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  buttonIcon: {
    fontSize: 20,
  },
  trustText: {
    fontSize: 14,
    color: '#B8B8B8',
    textAlign: 'center',
    marginTop: 8,
  },
});
