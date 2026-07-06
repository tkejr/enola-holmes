import { router, useLocalSearchParams } from 'expo-router';
import { uploadAsync } from 'expo-file-system/legacy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, Image as RNImage, Animated, Dimensions, Alert, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getCoinBalance, recordSearch } from '@/utils/searchService';
import { searchFace } from '@/utils/faceSearch';
import { Image } from 'expo-image';
import { Canvas, Circle as SkiaCircle, Group, useImage, Image as SkiaImage, Line as SkiaLine, Path, Skia } from '@shopify/react-native-skia';
import { EnolaHeading } from '@/components/enola-heading';

const { width, height } = Dimensions.get('window');

// Cosmetic scanning overlay: decorative facial-landmark dots shown over the photo while
// the real search runs server-side. Used as the initial state and as the fallback when
// the face-detect service is unavailable, so dots always render.
const FALLBACK_POINTS = [
  { x: 0.35, y: 0.3, type: 'eye' },
  { x: 0.65, y: 0.3, type: 'eye' },
  { x: 0.5, y: 0.45, type: 'nose' },
  { x: 0.41, y: 0.58, type: 'mouth' },
  { x: 0.59, y: 0.58, type: 'mouth' },
  { x: 0.5, y: 0.62, type: 'mouth' },
  { x: 0.32, y: 0.25, type: 'eyebrow' },
  { x: 0.68, y: 0.25, type: 'eyebrow' },
];

export default function ScanningScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [searchStatus, setSearchStatus] = useState('Analyzing image...');
  const [actualProgress, setActualProgress] = useState(0);
  // Detected landmarks (null until resolved). Dots wander until this is set, then lock onto them.
  const [facialPoints, setFacialPoints] = useState<Array<{ x: number; y: number; type: string }> | null>(null);
  const [clockTick, setClockTick] = useState(0);   // 0→1 looping clock, drives the wander
  const [lockProgress, setLockProgress] = useState(0); // 0→1 once, dots ease onto landmarks
  const clockAnim = useRef(new Animated.Value(0)).current;
  const lockAnim = useRef(new Animated.Value(0)).current;
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [displayImageUri, setDisplayImageUri] = useState(imageUri); // Image with dots drawn on it
  const skiaImage = useImage(imageUri); // Load image for Skia
  const scanProgress = useRef(new Animated.Value(0)).current;
  const scanProgress2 = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const radialPulse = useRef(new Animated.Value(0)).current;
  const cornerScale = useRef(new Animated.Value(0)).current;

  const showScanningOverlay = async () => {
    let points = FALLBACK_POINTS;
    const baseUrl = process.env.EXPO_PUBLIC_FACE_DETECT_URL;
    if (baseUrl) {
      try {
        // RN FormData/Blob don't work in this runtime; expo-file-system uploadAsync
        // streams the local file directly (same pattern as utils/faceSearch.ts).
        const res = await uploadAsync(`${baseUrl}/detect-face`, imageUri, {
          httpMethod: 'POST',
          uploadType: 1, // MULTIPART
          fieldName: 'file',
          mimeType: imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
          headers: { accept: 'application/json' },
        });
        const data = JSON.parse(res.body);
        if (data?.faceDetected && Array.isArray(data.facialPoints) && data.facialPoints.length > 0) {
          points = data.facialPoints;
        }
      } catch (e) {
        console.warn('Face-detect service failed, using fallback dots:', e);
      }
    }
    setFacialPoints(points);
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

      setSearchStatus('Uploading image...');
      setActualProgress(10);

      // Search runs entirely server-side (Edge Function holds the FaceCheck token and
      // polls for results). We just await the final match list.
      setSearchStatus('Searching faces...');
      setActualProgress(40);

      const result = await searchFace(imageUri);

      if (result.error) {
        if (result.code === 'IMAGE_ERROR') {
          Alert.alert(
            'No Face Detected',
            'Please upload a clear photo with a visible face. Make sure the face is well-lit and not blurry.',
            [{ text: 'Try Another Photo', onPress: () => router.replace('/(tabs)'), style: 'default' }]
          );
          return;
        }
        // The Edge Function charges the coin server-side; it returns this if the balance
        // is 0 (a scripted caller can't bypass it). Send the user to buy coins.
        if (result.error === 'insufficient_coins') {
          Alert.alert(
            'Insufficient Coins',
            'You need at least 1 coin to perform a search. Please purchase more coins.',
            [
              { text: 'Buy Coins', onPress: () => router.replace('/coins'), style: 'default' },
              { text: 'Cancel', onPress: () => router.back(), style: 'cancel' },
            ]
          );
          return;
        }
        throw new Error(result.error);
      }

      const items = result.items ?? [];
      console.log(`Search complete! Found ${items.length} results`);
      setSearchStatus('Found matches!');
      setActualProgress(100);

      // Save to history only — the coin was already deducted server-side by the function.
      await recordSearch(imageUri, items.length, items);

      setTimeout(() => {
        router.replace({
          pathname: '/results',
          params: { imageUri, resultsData: JSON.stringify(items) },
        });
      }, 500);

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
        // Fall back to a square fit (the crop is square) so the Canvas + dots still render.
        console.error('Failed to get image dimensions:', error);
        const s = width - 80;
        setImageDimensions({ width: s, height: s });
        setImageOffset({ x: 0, y: 0 });
        setImageScale(1);
      }
    );

    // Show the cosmetic scanning overlay
    showScanningOverlay();

    // Start the face search
    searchByFace();

    // Free-running clock (loops forever). Sampled to state so the wandering dots re-render each
    // frame. useNativeDriver:false is required because Skia reads the JS value, not the anim node.
    const clockId = clockAnim.addListener(({ value }) => setClockTick(value));
    Animated.loop(
      Animated.timing(clockAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

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

    return () => clockAnim.removeListener(clockId);
  }, []);

  // Animate progress bar when actualProgress changes
  useEffect(() => {
    Animated.timing(progressValue, {
      toValue: actualProgress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [actualProgress]);

  // Once landmarks resolve, ease every dot from its wandering position onto its target (lock-on).
  useEffect(() => {
    if (!facialPoints) return;
    const id = lockAnim.addListener(({ value }) => setLockProgress(value));
    Animated.timing(lockAnim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => lockAnim.removeListener(id);
  }, [facialPoints]);

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
  // Circular clip for the whole scan (image + dots + lines): inscribed circle of the square card.
  const circleClip = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(imageSize / 2, imageSize / 2, imageSize / 2);
    return p;
  }, [imageSize]);

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
            <EnolaHeading style={styles.logo} />
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
                <Canvas style={{ width: '100%', height: '100%' }}>
                  {/* Clip everything to a circle so the black letterbox corners disappear and the
                      whole scan reads as a circular lens. Image covers the full square (no
                      letterbox), the circle trims the overflow. */}
                  <Group clip={circleClip}>
                    <SkiaImage
                      image={skiaImage}
                      x={0}
                      y={0}
                      width={imageSize}
                      height={imageSize}
                      fit="cover"
                    />
                    <Group>
                    {(() => {
                      // Map over the full square (image now covers it), matching the covered image.
                      const W = imageSize;
                      const H = imageSize;
                      const cx0 = 0;
                      const cy0 = 0;
                      const t = clockTick * Math.PI * 2; // 0→2π each loop

                      // Dots wander (Lissajous around a seeded home) until landmarks resolve, then
                      // ease onto their targets as lockProgress 0→1. Pool size = landmark count once
                      // known, otherwise 40 searching dots. Seeds are deterministic (index-based).
                      const count = facialPoints ? facialPoints.length : 40;
                      const dots = Array.from({ length: count }, (_, i) => {
                        const seed = i * 12.9898;
                        const home = { x: (Math.sin(seed) * 0.5 + 0.5), y: (Math.sin(seed * 1.7) * 0.5 + 0.5) };
                        // wandering position (normalized 0..1)
                        let wx = home.x + 0.12 * Math.sin(t + i);
                        let wy = home.y + 0.12 * Math.cos(t * 1.3 + i * 0.7);
                        // Keep wanderers inside the circle (center 0.5, radius 0.46) so no dot lands
                        // in the clipped-off corners — pull any stray point back onto the circle.
                        const dx = wx - 0.5, dy = wy - 0.5;
                        const dist = Math.hypot(dx, dy);
                        if (dist > 0.46) {
                          wx = 0.5 + (dx / dist) * 0.46;
                          wy = 0.5 + (dy / dist) * 0.46;
                        }
                        const target = facialPoints?.[i] ?? { x: wx, y: wy, type: 'wander' };
                        const nx = wx + (target.x - wx) * lockProgress;
                        const ny = wy + (target.y - wy) * lockProgress;
                        return {
                          type: target.type,
                          px: nx * W + cx0,
                          py: ny * H + cy0,
                        };
                      });

                      // Connection lines only make sense once locked onto real landmarks; fade in
                      // over the back half of the lock so wandering dots stay unconnected.
                      const lineAlpha = facialPoints ? Math.max(0, (lockProgress - 0.5) / 0.5) * 0.5 : 0;

                      return (
                        <>
                          {facialPoints && dots.map((point, index) => {
                            const next = dots[index + 1];
                            if (next && next.type === point.type) {
                              return (
                                <SkiaLine
                                  key={`line-${index}`}
                                  p1={{ x: point.px, y: point.py }}
                                  p2={{ x: next.px, y: next.py }}
                                  color={`rgba(10, 132, 255, ${lineAlpha})`}
                                  strokeWidth={1}
                                />
                              );
                            }
                            return null;
                          })}

                          {dots.map((point, index) => (
                            <Group key={`dot-${index}`}>
                              <SkiaCircle cx={point.px} cy={point.py} r={4} color="rgba(10, 132, 255, 0.35)" />
                              <SkiaCircle cx={point.px} cy={point.py} r={2.5} color="#0A84FF" />
                              <SkiaCircle cx={point.px} cy={point.py} r={1} color="rgba(255, 255, 255, 0.8)" />
                            </Group>
                          ))}
                        </>
                      );
                    })()}
                    </Group>
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
                    colors={['rgba(10, 132, 255, 0)', 'rgba(10, 132, 255, 0.4)', '#0A84FF', 'rgba(10, 132, 255, 0.4)', 'rgba(10, 132, 255, 0)']}
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
                    colors={['rgba(10, 132, 255, 0)', '#0A84FF', 'rgba(10, 132, 255, 0)']}
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
                  colors={['#000000', '#000000', '#000000']}
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
    borderRadius: (width - 80) / 2, // circle
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
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
    borderRadius: (width - 80) / 2 + 4, // circular halo
    backgroundColor: '#000000',
    opacity: 0.2,
    zIndex: -1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: (width - 80) / 2, // clip scan lines to the circle
    overflow: 'hidden',
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
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#000000',
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
    borderColor: '#000000',
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
    borderColor: '#000000',
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
    borderColor: '#000000',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  progressSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E5EA',
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
    color: '#000000',
    letterSpacing: -0.3,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E5EA',
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
