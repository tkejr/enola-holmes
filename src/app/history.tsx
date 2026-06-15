import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getRecentSearches, getSearchById } from '@/utils/searchService';

type SearchRecord = {
  id: string;
  image_url: string;
  results_count: number;
  created_at: string;
};

export default function HistoryScreen() {
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const data = await getRecentSearches();
      setSearches(data);
    } catch (error) {
      console.error('Error loading search history:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewSearchDetails = async (searchId: string) => {
    try {
      const search = await getSearchById(searchId);
      if (!search) {
        Alert.alert('Error', 'Could not load search details');
        return;
      }

      // Navigate to results with the stored data
      router.push({
        pathname: '/results',
        params: {
          imageUri: search.image_url,
          resultsData: JSON.stringify(search.results || []),
        },
      });
    } catch (error) {
      console.error('Error viewing search:', error);
      Alert.alert('Error', 'Failed to load search details');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#FAFAFA', '#F5F5F5', '#FFFFFF']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>Search History</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : searches.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
              </View>
              <Text style={styles.emptyTitle}>No Searches Yet</Text>
              <Text style={styles.emptyText}>Your search history will appear here</Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.replace('/(tabs)')}
              >
                <LinearGradient
                  colors={['#1C1C1E', '#000000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.startButtonText}>Start Searching</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            searches.map((search) => (
              <TouchableOpacity
                key={search.id}
                style={styles.historyItem}
                onPress={() => viewSearchDetails(search.id)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: search.image_url }}
                  style={styles.historyThumbnail}
                  resizeMode="cover"
                />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>Face Search</Text>
                  <Text style={styles.historyDate}>{formatDate(search.created_at)}</Text>
                  <View style={styles.resultsBadge}>
                    <Text style={styles.resultsText}>
                      {search.results_count} {search.results_count === 1 ? 'match' : 'matches'}
                    </Text>
                  </View>
                </View>
                <View style={styles.arrowContainer}>
                  <Text style={styles.arrowIcon}>→</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.6,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '400',
    letterSpacing: -0.3,
    marginBottom: 32,
  },
  startButton: {
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  historyThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
    gap: 6,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  historyDate: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  resultsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
    letterSpacing: -0.2,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
  },
  arrowIcon: {
    fontSize: 18,
    color: '#0EA5E9',
    fontWeight: '600',
  },
});
