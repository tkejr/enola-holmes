import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Image as RNImage, Animated, Dimensions, Alert, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { uploadAsync } from 'expo-file-system/legacy';
import { getCoinBalance, recordSearchAndDeductCoin } from '@/utils/searchService';
import { Image } from 'expo-image';
import { Canvas, Circle as SkiaCircle, Group, useImage, Image as SkiaImage, Line as SkiaLine, Path, Skia } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');
const FACECHECK_API_TOKEN = 'UFSWdOlDdSa5BCOV6U3OpIi28UIjIO4tkYmOUVYNN4s1h3EQ956npx43IcU6qfdqiNjSPL3gz7Y=';
const FACECHECK_SITE = 'https://facecheck.id';
const TESTING_MODE = true; // Set to false for real results (uses API credits)

// Face detection service URL
// iOS Simulator: http://localhost:8000
// Android Emulator: http://10.0.2.2:8000
// Physical Device: http://YOUR_COMPUTER_IP:8000 (e.g., http://192.168.1.10:8000)
const FACE_DETECTION_SERVICE_URL = 'http://localhost:8000';

export default function ScanningScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [searchStatus, setSearchStatus] = useState('Analyzing image...');
  const [actualProgress, setActualProgress] = useState(0);
  const [facialPoints, setFacialPoints] = useState<Array<{ x: number; y: number; type: string }>>([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [displayImageUri, setDisplayImageUri] = useState(imageUri); // Image with dots drawn on it
  const [drawProgress, setDrawProgress] = useState(0); // 0 to 1, controls how many dots are shown
  const skiaImage = useImage(imageUri); // Load image for Skia
  const scanProgress = useRef(new Animated.Value(0)).current;
  const scanProgress2 = useRef(new Animated.Value(0)).current;
  const pointsOpacity = useRef<Animated.Value[]>([]);
  const glowPulse = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const radialPulse = useRef(new Animated.Value(0)).current;
  const cornerScale = useRef(new Animated.Value(0)).current;

  const detectFace = async () => {
    try {
      console.log('🔍 Detecting facial landmarks using MediaPipe service');
      console.log('📷 Image URI:', imageUri);

      console.log('📤 Sending image to face detection service...');

      // Use expo-file-system uploadAsync for proper multipart upload in React Native
      // uploadType: 1 = MULTIPART
      const uploadResponse = await uploadAsync(
        `${FACE_DETECTION_SERVICE_URL}/detect-face`,
        imageUri,
        {
          httpMethod: 'POST',
          uploadType: 1,
          fieldName: 'file',
          mimeType: imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        }
      );

      if (uploadResponse.status !== 200) {
        throw new Error(`Face detection service error: ${uploadResponse.status}`);
      }

      const detectionData = JSON.parse(uploadResponse.body);
      console.log('✅ Face detection response:', detectionData);
      console.log('📊 Sample points:', JSON.stringify(detectionData.facialPoints.slice(0, 5), null, 2));

      if (detectionData.faceDetected && detectionData.facialPoints.length > 0) {
        console.log('🎯 Face detected! Found', detectionData.totalLandmarks, 'landmarks');

        // Use the real detected landmarks
        setFacialPoints(detectionData.facialPoints);
        pointsOpacity.current = detectionData.facialPoints.map(() => new Animated.Value(0));

        console.log('✅ Real facial landmarks loaded');
        console.log('📍 First 3 points:', detectionData.facialPoints.slice(0, 3));
      } else {
        console.log('⚠️ No face detected, using fallback points');

        // Fallback to default points if no face detected
        const fallbackPoints = [
          { x: 0.35, y: 0.3, type: 'eye' },
          { x: 0.65, y: 0.3, type: 'eye' },
          { x: 0.5, y: 0.45, type: 'nose' },
          { x: 0.41, y: 0.58, type: 'mouth' },
          { x: 0.59, y: 0.58, type: 'mouth' },
          { x: 0.5, y: 0.62, type: 'mouth' },
          { x: 0.32, y: 0.25, type: 'eyebrow' },
          { x: 0.68, y: 0.25, type: 'eyebrow' },
        ];

        setFacialPoints(fallbackPoints);
        pointsOpacity.current = fallbackPoints.map(() => new Animated.Value(0));
      }

    } catch (error) {
      console.error('❌ Face detection error:', error);

      // Use fallback points on error
      const fallbackPoints = [
        { x: 0.35, y: 0.3, type: 'eye' },
        { x: 0.65, y: 0.3, type: 'eye' },
        { x: 0.5, y: 0.45, type: 'nose' },
        { x: 0.41, y: 0.58, type: 'mouth' },
        { x: 0.59, y: 0.58, type: 'mouth' },
        { x: 0.5, y: 0.62, type: 'mouth' },
        { x: 0.32, y: 0.25, type: 'eyebrow' },
        { x: 0.68, y: 0.25, type: 'eyebrow' },
      ];

      setFacialPoints(fallbackPoints);
      pointsOpacity.current = fallbackPoints.map(() => new Animated.Value(0));
    }
  };

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

      let uploadData;
      try {
        uploadData = JSON.parse(uploadResponse.body);
      } catch (parseError) {
        console.error('Failed to parse upload response:', uploadResponse.body);
        throw new Error('Invalid response from server');
      }

      if (uploadData?.error) {
        // Handle specific API errors with user-friendly messages
        if (uploadData?.code === 'IMAGE_ERROR') {
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

      const id_search = uploadData?.id_search;
      if (!id_search) {
        throw new Error('No search ID returned from server');
      }
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

        if (searchData?.error) {
          throw new Error(`${searchData.error} (${searchData.code || 'UNKNOWN'})`);
        }

        if (searchData?.output?.items) {
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

        // Round progress and ensure it only increases
        const newProgress = Math.round(searchData.progress || 0);
        console.log(`Progress: ${newProgress}% - ${searchData.message}`);
        setSearchStatus(`Searching... ${newProgress}%`);
        setActualProgress(prev => Math.max(prev, newProgress));

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
    // Get actual image dimensions to calculate proper offset for facial points
    RNImage.getSize(
      imageUri,
      (imgWidth, imgHeight) => {
        const containerSize = width - 80;
        const imageAspect = imgWidth / imgHeight;
        const containerAspect = 1; // square container

        let renderedWidth, renderedHeight, offsetX, offsetY;

        if (imageAspect > containerAspect) {
          // Image is wider - will have top/bottom letterboxing
          renderedWidth = containerSize;
          renderedHeight = containerSize / imageAspect;
          offsetX = 0;
          offsetY = (containerSize - renderedHeight) / 2;
        } else {
          // Image is taller - will have left/right pillarboxing
          renderedWidth = containerSize * imageAspect;
          renderedHeight = containerSize;
          offsetX = (containerSize - renderedWidth) / 2;
          offsetY = 0;
        }

        const scale = renderedWidth / imgWidth;

        console.log('📐 Image dimensions:', { imgWidth, imgHeight });
        console.log('📐 Rendered dimensions:', { renderedWidth, renderedHeight });
        console.log('📐 Offset:', { offsetX, offsetY });
        console.log('📐 Scale:', scale);

        setImageDimensions({ width: renderedWidth, height: renderedHeight });
        setImageOffset({ x: offsetX, y: offsetY });
        setImageScale(scale);
      },
      (error) => {
        console.error('Failed to get image dimensions:', error);
      }
    );

    // Detect face first
    detectFace();

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

  }, []);

  // Animate facial points when detected - draw from top to bottom
  useEffect(() => {
    console.log('🎬 Facial points useEffect triggered');
    console.log('📊 facialPoints.length:', facialPoints.length);

    if (facialPoints.length > 0) {
      console.log('✨ Starting top-to-bottom draw animation');
      // Animate from 0 to 1 over 6.5 seconds
      const startTime = Date.now();
      const duration = 6500; // 6.5 seconds

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setDrawProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [facialPoints]);

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

  console.log('🎨 Rendering ScanningScreen');
  console.log('📐 imageSize (container):', imageSize);
  console.log('📐 imageDimensions:', imageDimensions);
  console.log('📐 imageOffset:', imageOffset);
  console.log('📐 Skia Image will render at: x=' + imageOffset.x + ', y=' + imageOffset.y + ', w=' + imageDimensions.width + ', h=' + imageDimensions.height);

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
              {/* Use Skia Canvas to draw image AND dots together */}
              {skiaImage && imageDimensions.width > 0 && (
                <Canvas style={{ width: '100%', height: '100%', backgroundColor: 'black' }}>
                  <SkiaImage
                    image={skiaImage}
                    x={imageOffset.x}
                    y={imageOffset.y}
                    width={imageDimensions.width}
                    height={imageDimensions.height}
                  />
                  <Group>
                    {/* Draw connection lines first (so dots appear on top) */}
                    {facialPoints.map((point, index) => {
                      // Only draw if point is within draw progress
                      if (point.y > drawProgress) return null;

                      const x1 = point.x * imageDimensions.width + imageOffset.x;
                      const y1 = point.y * imageDimensions.height + imageOffset.y;

                      // Connect to next point of same type
                      const nextIndex = facialPoints.findIndex((p, i) =>
                        i > index && p.type === point.type
                      );

                      if (nextIndex !== -1 && nextIndex === index + 1) {
                        const nextPoint = facialPoints[nextIndex];
                        // Only draw line if next point is also visible
                        if (nextPoint.y > drawProgress) return null;

                        const x2 = nextPoint.x * imageDimensions.width + imageOffset.x;
                        const y2 = nextPoint.y * imageDimensions.height + imageOffset.y;

                        return (
                          <SkiaLine
                            key={`line-${index}`}
                            p1={{ x: x1, y: y1 }}
                            p2={{ x: x2, y: y2 }}
                            color="rgba(14, 165, 233, 0.4)"
                            strokeWidth={1}
                          />
                        );
                      }
                      return null;
                    })}

                    {/* Draw facial points with glow effect */}
                    {facialPoints.map((point, index) => {
                      // Only draw if point is within draw progress (top to bottom)
                      if (point.y > drawProgress) return null;

                      const x = point.x * imageDimensions.width + imageOffset.x;
                      const y = point.y * imageDimensions.height + imageOffset.y;
                      return (
                        <Group key={`dot-${index}`}>
                          {/* Outer glow */}
                          <SkiaCircle
                            cx={x}
                            cy={y}
                            r={4}
                            color="rgba(14, 165, 233, 0.3)"
                          />
                          {/* Main dot */}
                          <SkiaCircle
                            cx={x}
                            cy={y}
                            r={2.5}
                            color="#0EA5E9"
                          />
                          {/* Inner highlight */}
                          <SkiaCircle
                            cx={x}
                            cy={y}
                            r={1}
                            color="rgba(255, 255, 255, 0.8)"
                          />
                        </Group>
                      );
                    })}
                  </Group>
                </Canvas>
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

              </View>

              {/* Glow Effect */}
              <Animated.View style={[styles.imageGlow, { opacity: glowOpacity }]} />
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Scanning Progress</Text>
              <Text style={styles.progressPercent}>
                {Math.round(actualProgress)}%
              </Text>
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
    alignSelf: 'center',
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
    zIndex: 9999,
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
    zIndex: 9999,
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
  facialDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red',
    borderWidth: 3,
    borderColor: 'yellow',
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
