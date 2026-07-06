import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Image, Linking } from 'react-native';
import { HapticTouchable } from '@/components/haptic-touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { EnolaHeading } from '@/components/enola-heading';

interface FaceCheckResult {
  score: number;
  url: string;
  base64?: string;
}

interface CategorizedResult extends FaceCheckResult {
  platform: string;
  platformColor: string;
  platformIcon: string;
  username?: string;
}

const detectPlatform = (url: string): { platform: string; color: string; icon: string; username?: string } => {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('instagram.com')) {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return { platform: 'Instagram', color: '#E4405F', icon: 'logo-instagram', username: match?.[1] };
  }
  if (urlLower.includes('tiktok.com')) {
    const match = url.match(/tiktok\.com\/@([^/?]+)/);
    return { platform: 'TikTok', color: '#000000', icon: 'logo-tiktok', username: match?.[1] };
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { platform: 'YouTube', color: '#FF0000', icon: 'logo-youtube', username: undefined };
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    const match = url.match(/(?:twitter|x)\.com\/([^/?]+)/);
    return { platform: 'X (Twitter)', color: '#000000', icon: 'logo-twitter', username: match?.[1] };
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.com')) {
    return { platform: 'Facebook', color: '#1877F2', icon: 'logo-facebook', username: undefined };
  }
  if (urlLower.includes('onlyfans.com')) {
    const match = url.match(/onlyfans\.com\/([^/?]+)/);
    return { platform: 'OnlyFans', color: '#00AFF0', icon: 'diamond', username: match?.[1] };
  }
  if (urlLower.includes('linkedin.com')) {
    return { platform: 'LinkedIn', color: '#0A66C2', icon: 'logo-linkedin', username: undefined };
  }
  if (urlLower.includes('snapchat.com')) {
    return { platform: 'Snapchat', color: '#FFFC00', icon: 'logo-snapchat', username: undefined };
  }
  if (urlLower.includes('reddit.com')) {
    return { platform: 'Reddit', color: '#FF4500', icon: 'logo-reddit', username: undefined };
  }
  if (urlLower.includes('twitch.tv')) {
    const match = url.match(/twitch\.tv\/([^/?]+)/);
    return { platform: 'Twitch', color: '#9146FF', icon: 'logo-twitch', username: match?.[1] };
  }

  return { platform: 'Other', color: '#8E8E93', icon: 'globe-outline', username: undefined };
};

const ResultCard = ({ result }: { result: CategorizedResult }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <HapticTouchable
      style={styles.resultCard}
      onPress={() => Linking.openURL(result.url)}
      activeOpacity={0.7}
    >
      {result.base64 && !imageError ? (
        <Image
          source={{ uri: result.base64 }}
          style={styles.resultThumbnail}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.resultThumbnail, styles.placeholderThumbnail]}>
          <Ionicons name={result.platformIcon as any} size={44} color={result.platformColor} />
        </View>
      )}

      <View style={styles.resultInfo}>
        <View style={styles.matchScoreRow}>
          <LinearGradient
            colors={
              result.score > 80
                ? ['#34C759', '#30B350']
                : result.score > 60
                ? ['#FF9500', '#FF8000']
                : ['#8E8E93', '#7E7E83']
            }
            style={styles.matchBadge}
          >
            <Text style={styles.matchScore}>{Math.round(result.score)}%</Text>
          </LinearGradient>
          <Text style={styles.matchLabel}>Match Confidence</Text>
        </View>

        {result.username && (
          <Text style={styles.username}>@{result.username}</Text>
        )}

        <Text
          style={styles.resultUrl}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {result.url}
        </Text>
      </View>

      <View style={styles.arrowContainer}>
        <Text style={styles.arrowIcon}>→</Text>
      </View>
    </HapticTouchable>
  );
};

export default function ResultsScreen() {
  const params = useLocalSearchParams<{ imageUri: string; resultsData?: string }>();
  const { imageUri, resultsData } = params;
  const [categorizedResults, setCategorizedResults] = useState<Record<string, CategorizedResult[]>>({});
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    if (resultsData) {
      try {
        const parsed: FaceCheckResult[] = JSON.parse(resultsData);
        // Keep only high-confidence matches, capped at the top 50; drop the irrelevant long tail.
        // ponytail: fixed 70% threshold + 50 cap, make them params if product wants them tunable
        const relevant = parsed
          .filter((r) => r.score >= 70)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);
        setTotalResults(relevant.length);

        // Categorize by platform
        const categorized: Record<string, CategorizedResult[]> = {};

        relevant.forEach((result) => {
          const { platform, color, icon, username } = detectPlatform(result.url);
          const categorizedResult: CategorizedResult = {
            ...result,
            platform,
            platformColor: color,
            platformIcon: icon,
            username,
          };

          if (!categorized[platform]) {
            categorized[platform] = [];
          }
          categorized[platform].push(categorizedResult);
        });

        // Sort each platform's results by score (highest first)
        Object.keys(categorized).forEach(platform => {
          categorized[platform].sort((a, b) => b.score - a.score);
        });

        setCategorizedResults(categorized);
      } catch (error) {
        console.error('Error parsing results:', error);
      }
    }
  }, [resultsData]);

  const platformOrder = ['Instagram', 'TikTok', 'YouTube', 'X (Twitter)', 'Facebook', 'OnlyFans', 'LinkedIn', 'Twitch', 'Snapchat', 'Reddit', 'Other'];
  const sortedPlatforms = platformOrder.filter(platform => categorizedResults[platform]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#FAFAFA', '#F5F5F5', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <HapticTouchable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>✕</Text>
          </HapticTouchable>
          <EnolaHeading style={styles.logo} />
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Profile Image */}
          <View style={styles.profileImageContainer}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            )}
          </View>

          {/* Results Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Search Complete</Text>
            <Text style={styles.summaryCount}>
              {totalResults} {totalResults === 1 ? 'Match' : 'Matches'} Found
            </Text>
            {sortedPlatforms.length > 0 && (
              <View style={styles.platformTags}>
                {sortedPlatforms.map((platform) => (
                  <View key={platform} style={styles.platformTag}>
                    <Ionicons name={categorizedResults[platform][0].platformIcon as any} size={16} color={categorizedResults[platform][0].platformColor} />
                    <Text style={styles.platformTagText}>
                      {categorizedResults[platform].length}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Results by Platform */}
          {totalResults > 0 ? (
            sortedPlatforms.map((platform) => (
              <View key={platform} style={styles.platformSection}>
                <View style={styles.platformHeader}>
                  <View style={styles.platformTitleRow}>
                    <Ionicons name={categorizedResults[platform][0].platformIcon as any} size={24} color={categorizedResults[platform][0].platformColor} />
                    <Text style={styles.platformTitle}>{platform}</Text>
                  </View>
                  <View style={[styles.platformBadge, { backgroundColor: '#F0F0F0' }]}>
                    <Text style={[styles.platformCount, { color: '#000000' }]}>
                      {categorizedResults[platform].length}
                    </Text>
                  </View>
                </View>

                {categorizedResults[platform].map((result, index) => (
                  <ResultCard key={index} result={result} />
                ))}
              </View>
            ))
          ) : (
            <View style={styles.noResultsCard}>
              <View style={styles.noResultsIconContainer}>
                <Ionicons name="search" size={40} color="#1C1C1E" />
              </View>
              <Text style={styles.noResultsTitle}>No Matches Found</Text>
              <Text style={styles.noResultsText}>
                We couldn't find any matches for this photo. Try with a different image or ensure the face is clear and well-lit.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <HapticTouchable
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#000000', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.primaryButtonText}>New Search</Text>
              </LinearGradient>
            </HapticTouchable>
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 20,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  logo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileImageContainer: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 24,
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FAFAFA',
  },
  verifiedIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  summaryCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    letterSpacing: -1,
  },
  platformTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  platformTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  platformTagIcon: {
    fontSize: 16,
  },
  platformTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  platformSection: {
    marginBottom: 24,
  },
  platformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  platformTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  platformIcon: {
    fontSize: 24,
  },
  platformTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  platformBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  platformCount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  placeholderIcon: {
    fontSize: 44,
  },
  resultInfo: {
    flex: 1,
    gap: 6,
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  matchScore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  matchLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },
  resultUrl: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  arrowIcon: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
  },
  noResultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  noResultsIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noResultsIcon: {
    fontSize: 40,
  },
  noResultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.6,
  },
  noResultsText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
