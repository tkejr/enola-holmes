import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Image, Animated, Dimensions, Alert, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { uploadAsync } from 'expo-file-system/legacy';
import { getCoinBalance, recordSearchAndDeductCoin } from '@/utils/searchService';

const { width, height } = Dimensions.get('window');
const FACECHECK_API_TOKEN = 'UFSWdOlDdSa5BCOV6U3OpIi28UIjIO4tkYmOUVYNN4s1h3EQ956npx43IcU6qfdqiNjSPL3gz7Y=';
const FACECHECK_SITE = 'https://facecheck.id';
const TESTING_MODE = true; // Set to false for real results (uses API credits)

// Mock facial points for biometric overlay
const facialPoints = [
  { x: 0.3, y: 0.25 }, // Left eye
  { x: 0.7, y: 0.25 }, // Right eye
  { x: 0.5, y: 0.4 },  // Nose
  { x: 0.35, y: 0.6 }, // Left mouth
  { x: 0.65, y: 0.6 }, // Right mouth
  { x: 0.5, y: 0.65 }, // Chin
  { x: 0.2, y: 0.3 },  // Left eyebrow
  { x: 0.8, y: 0.3 },  // Right eyebrow
];

export default function ScanningScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [searchStatus, setSearchStatus] = useState('Analyzing image...');
  const [actualProgress, setActualProgress] = useState(0);
  const scanProgress = useRef(new Animated.Value(0)).current;
  const scanProgress2 = useRef(new Animated.Value(0)).current;
  const pointsOpacity = useRef(facialPoints.map(() => new Animated.Value(0))).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const radialPulse = useRef(new Animated.Value(0)).current;
  const cornerScale = useRef(new Animated.Value(0)).current;

  const searchByFace = async () => {
    try {
      // Check coin balance first
      const balance = await getCoinBalance();
      console.log('Current coin balance:', balance);

      if (balance < 1) {
        Alert.alert(
          'Insufficient Coins',
          'You need at least 1 coin to perform a search. Please purchase more coins.',
          [
            {
              text: 'Buy Coins',
              onPress: () => router.replace('/coins'),
              style: 'default',
            },
            {
              text: 'Cancel',
              onPress: () => router.back(),
              style: 'cancel',
            },
          ]
        );
        return;
      }

      if (TESTING_MODE) {
        console.log('****** TESTING MODE search, results are inaccurate, and queue wait is long, but credits are NOT deducted ******');
      }

      setSearchStatus('Uploading image...');
      setActualProgress(5);

      // Step 1: Upload image to FaceCheck.id using multipart form-data
      // uploadType: 1 = MULTIPART (0 = BINARY)
      const uploadResponse = await uploadAsync(
        `${FACECHECK_SITE}/api/upload_pic`,
        imageUri,
        {
          httpMethod: 'POST',
          uploadType: 1,
          fieldName: 'images',
          mimeType: imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
          headers: {
            'accept': 'application/json',
            'Authorization': FACECHECK_API_TOKEN,
          },
        }
      );

      const uploadData = JSON.parse(uploadResponse.body);

      if (uploadData.error) {
        // Handle specific API errors with user-friendly messages
        if (uploadData.code === 'IMAGE_ERROR') {
          // Show user-friendly alert for no face detected
          Alert.alert(
            'No Face Detected',
            'Please upload a clear photo with a visible face. Make sure the face is well-lit and not blurry.',
            [
              {
                text: 'Try Another Photo',
                onPress: () => router.replace('/(tabs)'),
                style: 'default',
              },
            ]
          );
          return; // Exit the function early
        }
        // For other errors, throw to be caught by the catch block
        throw new Error(uploadData.error);
      }

      const id_search = uploadData.id_search;
      console.log('Upload successful. id_search=' + id_search);

      setSearchStatus('Searching faces...');
      setActualProgress(10);

      // Step 2: Poll for search results
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max

      while (attempts < maxAttempts) {
        attempts++;

        const searchResponse = await fetch(`${FACECHECK_SITE}/api/search`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Authorization': FACECHECK_API_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id_search: id_search,
            with_progress: true,
            status_only: false,
            demo: TESTING_MODE,
          }),
        });

        const searchData = await searchResponse.json();

        if (searchData.error) {
          throw new Error(`${searchData.error} (${searchData.code})`);
        }

        if (searchData.output && searchData.output.items) {
          console.log(`Search complete! Found ${searchData.output.items.length} results`);
          setSearchStatus('Found matches!');
          setActualProgress(100);

          // Record search and deduct coin
          const recordResult = await recordSearchAndDeductCoin(
            imageUri,
            searchData.output.items.length,
            searchData.output.items
          );

          if (!recordResult.success) {
            console.error('Failed to record search:', recordResult.message);
            // Still show results even if recording failed
          } else {
            console.log('Search recorded. New balance:', recordResult.new_balance);
          }

          // Navigate to results with real data
          setTimeout(() => {
            router.replace({
              pathname: '/results',
              params: {
                imageUri,
                resultsData: JSON.stringify(searchData.output.items),
              },
            });
          }, 500);
          return;
        }

        console.log(`Progress: ${searchData.progress}% - ${searchData.message}`);
        setSearchStatus(`Searching... ${searchData.progress}%`);
        setActualProgress(prev => Math.max(prev, searchData.progress || 0));

        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new Error('Search timed out after 2 minutes');

    } catch (error: any) {
      console.error('Face search error:', error);
      setSearchStatus('Search failed');

      // Show user-friendly error message
      const errorMessage = error.message || 'Unable to complete face search. Please try again.';

      Alert.alert(
        'Unable to Search',
        errorMessage,
        [
          {
            text: 'Try Another Photo',
            onPress: () => router.replace('/(tabs)'),
            style: 'default',
          },
          {
            text: 'Cancel',
            onPress: () => router.back(),
            style: 'cancel',
          },
        ]
      );
    }
  };

  useEffect(() => {
    // Start the face search
    searchByFace();
    // Corner brackets scale in
    Animated.spring(cornerScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Primary scanning wave - smooth, continuous
    Animated.loop(
      Animated.timing(scanProgress, {
        toValue: 1,
        duration: 2500,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      })
    ).start();

    // Secondary scan line (follows primary with delay)
    setTimeout(() => {
      Animated.loop(
        Animated.timing(scanProgress2, {
          toValue: 1,
          duration: 2500,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        })
      ).start();
    }, 300);

    // Radial pulse from center
    Animated.loop(
      Animated.sequence([
        Animated.timing(radialPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(radialPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow pulse animation - more dramatic
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Staggered facial points animation - each point appears one by one
    const pointAnimations = pointsOpacity.map((anim, index) =>
      Animated.spring(anim, {
        toValue: 1,
        delay: 600 + index * 100,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      })
    );

    Animated.stagger(100, pointAnimations).start();
  }, []);

  // Animate progress bar when actualProgress changes
  useEffect(() => {
    Animated.timing(progressValue, {
      toValue: actualProgress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [actualProgress]);

  const scanTranslateY = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 80],
  });

  const scanTranslateY2 = scanProgress2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 80],
  });

  const scanOpacity = scanProgress.interpolate({
    inputRange: [0, 0.05, 0.95, 1],
    outputRange: [0, 1, 1, 0],
  });

  const scanOpacity2 = scanProgress2.interpolate({
    inputRange: [0, 0.05, 0.95, 1],
    outputRange: [0, 0.6, 0.6, 0],
  });

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  const radialScale = radialPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  const radialOpacity = radialPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.2, 0],
  });

  const imageSize = width - 80;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#FAFAFA', '#F5F5F5', '#FFFFFF']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Enola</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Scanning</Text>
            </View>
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Analyzing Image</Text>
            <Text style={styles.subtitle}>Identifying facial features and patterns</Text>
          </View>

          {/* Image Container */}
          <View style={styles.imageContainer}>
            <View style={styles.imageCard}>
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.image}
                  resizeMode="cover"
                />
              )}

              {/* Scanning Overlay */}
              <View style={styles.scanOverlay}>
                {/* Radial Pulse from Center */}
                <Animated.View
                  style={[
                    styles.radialPulse,
                    {
                      transform: [{ scale: radialScale }],
                      opacity: radialOpacity,
                    },
                  ]}
                />

                {/* Corner Indicators */}
                <Animated.View style={[styles.cornerTL, { transform: [{ scale: cornerScale }] }]} />
                <Animated.View style={[styles.cornerTR, { transform: [{ scale: cornerScale }] }]} />
                <Animated.View style={[styles.cornerBL, { transform: [{ scale: cornerScale }] }]} />
                <Animated.View style={[styles.cornerBR, { transform: [{ scale: cornerScale }] }]} />

                {/* Primary Scan Line */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [{ translateY: scanTranslateY }],
                      opacity: scanOpacity,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(14, 165, 233, 0)', 'rgba(14, 165, 233, 0.3)', '#0EA5E9', 'rgba(14, 165, 233, 0.3)', 'rgba(14, 165, 233, 0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.scanLineGradient}
                  />
                </Animated.View>

                {/* Secondary Scan Line (trailing) */}
                <Animated.View
                  style={[
                    styles.scanLine2,
                    {
                      transform: [{ translateY: scanTranslateY2 }],
                      opacity: scanOpacity2,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(14, 165, 233, 0)', '#0EA5E9', 'rgba(14, 165, 233, 0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.scanLineGradient}
                  />
                </Animated.View>

                {/* Facial Points with individual animations */}
                {facialPoints.map((point, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.facialPoint,
                      {
                        left: `${point.x * 100}%`,
                        top: `${point.y * 100}%`,
                        opacity: pointsOpacity[index],
                        transform: [{ scale: pointsOpacity[index] }],
                      },
                    ]}
                  >
                    <View style={styles.pointOuter}>
                      <View style={styles.pointInner} />
                    </View>
                  </Animated.View>
                ))}

                {/* Connection Lines - animate based on first and last points */}
                <Animated.View style={[styles.connectionLines, { opacity: pointsOpacity[pointsOpacity.length - 1] }]}>
                  <View style={[styles.connectionLine, { top: '25%', left: '30%', width: '40%', height: 2 }]} />
                  <View style={[styles.connectionLine, { top: '40%', left: '49%', width: 2, height: '20%' }]} />
                  <View style={[styles.connectionLine, { top: '60%', left: '35%', width: '30%', height: 2 }]} />
                </Animated.View>
              </View>

              {/* Glow Effect */}
              <Animated.View style={[styles.imageGlow, { opacity: glowOpacity }]} />
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Scanning Progress</Text>
              <Animated.Text style={styles.progressPercent}>
                {progressValue.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                })}
              </Animated.Text>
            </View>
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressValue.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              >
                <LinearGradient
                  colors={['#0EA5E9', '#0284C7', '#0369A1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
              </Animated.View>
            </View>
            <Text style={styles.progressStatus}>{searchStatus}</Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9500',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  imageCard: {
    width: width - 80,
    height: width - 80,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 28,
    backgroundColor: '#0EA5E9',
    opacity: 0.2,
    zIndex: -1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 165, 233, 0.03)',
  },
  radialPulse: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    marginLeft: -50,
    marginTop: -50,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
  },
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#0EA5E9',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#0EA5E9',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#0EA5E9',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#0EA5E9',
    borderBottomRightRadius: 4,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    top: 0,
  },
  scanLine2: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    top: 0,
  },
  scanLineGradient: {
    width: '100%',
    height: '100%',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  facialPoint: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  pointInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  connectionLines: {
    ...StyleSheet.absoluteFillObject,
  },
  connectionLine: {
    position: 'absolute',
    backgroundColor: '#0EA5E9',
    opacity: 0.5,
  },
  progressSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  progressPercent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0EA5E9',
    letterSpacing: -0.3,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressGradient: {
    width: '100%',
    height: '100%',
  },
  progressStatus: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});
