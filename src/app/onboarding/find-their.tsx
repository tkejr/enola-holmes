import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const items = [
  { text: 'Criminal Record', icon: '👮' },
  { text: 'OnlyFans', icon: '💙' },
  { text: 'LinkedIn', icon: '💼' },
  { text: 'Hidden TikToks', icon: '🎵' },
];

export default function FindTheirScreen() {
  const [visibleItems, setVisibleItems] = useState<number>(0);

  useEffect(() => {
    if (visibleItems < items.length) {
      const timer = setTimeout(() => {
        setVisibleItems(visibleItems + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        router.push('/onboarding/one-photo');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visibleItems]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../../assets/images/enola-body.png')}
          style={styles.mascot}
          resizeMode="contain"
        />

        <Text style={styles.title}>Find their...</Text>

        <View style={styles.itemsList}>
          {items.slice(0, visibleItems).map((item, index) => (
            <View key={index} style={styles.item}>
              <Text style={styles.itemText}>{item.text}</Text>
              <Text style={styles.itemIcon}>{item.icon}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mascot: {
    width: 200,
    height: 200,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 40,
  },
  itemsList: {
    alignItems: 'flex-start',
    gap: 20,
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
  itemIcon: {
    fontSize: 24,
  },
});
