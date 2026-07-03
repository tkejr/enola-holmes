import { EnolaHeading } from "@/components/enola-heading";
import { HapticTouchable } from "@/components/haptic-touchable";
import { SubscriptionDisclosure } from "@/components/subscription-disclosure";
import { getCoins, getReferralInfo } from "@/utils/coins";
import {
  getCoinOfferings,
  getSubscriptionOfferings,
  purchasePackage,
} from "@/utils/revenuecat";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { SafeAreaView } from "react-native-safe-area-context";

// Coin packs (consumables), matched to RC `coins` offering package identifiers.
const COIN_CARDS = [
  { id: "1Coin", coins: 1, fallbackPrice: "$4.99" },
  { id: "5Coins", coins: 5, fallbackPrice: "$19.99", badge: "POPULAR" },
  { id: "10Coins", coins: 10, fallbackPrice: "$29.99" },
  { id: "25Coins", coins: 25, fallbackPrice: "$59.99" },
  { id: "50Coins", coins: 50, fallbackPrice: "$99.99", badge: "BEST VALUE" },
];

export default function CoinsScreen() {
  const [tab, setTab] = useState<"topup" | "subscription">("topup");
  const [trackWidth, setTrackWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const switchTab = (next: "topup" | "subscription") => {
    if (next === tab) return;
    Animated.parallel([
      Animated.timing(pillX, {
        toValue: next === "topup" ? 0 : 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    // Swap content at the fade's midpoint so it changes while invisible.
    setTimeout(() => setTab(next), 110);
  };

  const pillWidth = trackWidth > 0 ? (trackWidth - 8) / 2 : 0; // track padding 4 each side
  const [coins, setCoins] = useState<number | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [referral, setReferral] = useState<{
    code: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    getReferralInfo().then(setReferral); // prefetch so /settings renders instantly
    (async () => {
      setCoins(await getCoins());
      const coinOffering = await getCoinOfferings();
      setPackages(coinOffering?.availablePackages ?? []);
      setOfferingsLoaded(true);
    })();
  }, []);

  const purchaseCoins = async (pkg: PurchasesPackage) => {
    setBuyingId(pkg.identifier);
    try {
      const result = await purchasePackage(pkg);
      if (!result) return; // cancelled or failed (util already logged)

      // Coins are credited server-side by the RevenueCat webhook. Poll the balance
      // until it rises above a FRESH baseline (not stale React state) or we time out.
      const baseline = await getCoins();
      let latest = baseline;
      let credited = false;
      for (let i = 0; i < 8; i++) {
        latest = await getCoins();
        if (latest > baseline) {
          credited = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCoins(latest);

      if (credited) {
        Alert.alert("Success", `You now have ${latest} coins!`);
      } else {
        // Payment went through but the credit hasn't landed yet (webhook latency/outage).
        // Do NOT claim success with an unchanged balance — tell the truth so the user
        // doesn't re-purchase or think it failed.
        Alert.alert(
          "Purchase received",
          "Your payment went through. Coins can take a moment to appear — pull to refresh, and contact support if they don't arrive shortly.",
        );
      }
    } finally {
      setBuyingId(null);
    }
  };

  // Presents the RC-hosted Paywall template for the `default` (subscription) offering.
  const showSubscriptionPaywall = async () => {
    const offering = await getSubscriptionOfferings();
    if (!offering) {
      Alert.alert(
        "Unavailable",
        "Subscriptions are not available right now. Please try again later.",
      );
      return;
    }
    const result = await RevenueCatUI.presentPaywall({ offering });
    if (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED
    ) {
      setCoins(await getCoins()); // entitlement/coins handled server-side; refresh display
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HapticTouchable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </HapticTouchable>
        <EnolaHeading style={styles.logo} />
        <View style={styles.coinBadge}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinText}>{coins ?? "–"}</Text>
        </View>
      </View>

      {/* Segmented toggle: Coin Top-Up vs Subscription */}
      <View
        style={styles.toggleRow}
        onLayout={(e: LayoutChangeEvent) =>
          setTrackWidth(e.nativeEvent.layout.width)
        }
      >
        {pillWidth > 0 && (
          <Animated.View
            style={[
              styles.togglePill,
              {
                width: pillWidth,
                transform: [
                  {
                    translateX: pillX.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, pillWidth],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
        <HapticTouchable
          style={styles.toggleTab}
          onPress={() => switchTab("topup")}
        >
          <Text
            style={[
              styles.toggleText,
              tab === "topup" && styles.toggleTextActive,
            ]}
          >
            Coin Top-Up
          </Text>
        </HapticTouchable>
        <HapticTouchable
          style={styles.toggleTab}
          onPress={() => switchTab("subscription")}
        >
          <Text
            style={[
              styles.toggleText,
              tab === "subscription" && styles.toggleTextActive,
            ]}
          >
            Subscription
          </Text>
        </HapticTouchable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Animated.View style={{ opacity: contentOpacity }}>
          {tab === "topup" ? (
            <>
              <View style={styles.heroSection}>
                <Text style={styles.coinEmoji}>🪙</Text>
                <Text style={styles.title}>Get More Coins</Text>
                <Text style={styles.subtitle}>1 Coin = 1 Face Scan</Text>
              </View>

              <View style={styles.packagesContainer}>
                {COIN_CARDS.map((card) => {
                  const pkg = packages.find((p) => p.identifier === card.id);
                  const busy = buyingId === card.id;
                  return (
                    <HapticTouchable
                      key={card.id}
                      style={styles.packageCard}
                      disabled={!!buyingId}
                      onPress={() => {
                        if (pkg) purchaseCoins(pkg);
                        else
                          Alert.alert(
                            "Unavailable",
                            "Coin packs are not available right now. Please try again later.",
                          );
                      }}
                    >
                      {card.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{card.badge}</Text>
                        </View>
                      )}
                      <Text style={styles.packageCoins}>{card.coins}</Text>
                      <Text style={styles.packageLabel}>
                        Coin{card.coins > 1 ? "s" : ""}
                      </Text>
                      <View style={styles.packagePrice}>
                        {busy || !offeringsLoaded ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.priceText}>
                            {pkg?.product.priceString ?? card.fallbackPrice}
                          </Text>
                        )}
                      </View>
                    </HapticTouchable>
                  );
                })}
              </View>

              <HapticTouchable
                style={styles.inviteButton}
                onPress={() =>
                  router.push({
                    pathname: "/settings",
                    params: referral
                      ? { code: referral.code, count: String(referral.count) }
                      : {},
                  })
                }
              >
                <Text style={styles.inviteButtonText}>
                  Invite Friends & Earn Free Coins
                </Text>
              </HapticTouchable>
            </>
          ) : (
            <View style={styles.subList}>
              <View style={styles.heroSection}>
                <Text style={styles.coinEmoji}>♾️</Text>
                <Text style={styles.title}>Enola Pro</Text>
                <Text style={styles.subtitle}>
                  Monthly coins, best value per scan
                </Text>
              </View>
              <HapticTouchable
                style={styles.subButton}
                onPress={showSubscriptionPaywall}
              >
                <Text style={styles.subButtonText}>
                  View Subscription Plans
                </Text>
              </HapticTouchable>
            </View>
          )}
        </Animated.View>

        <SubscriptionDisclosure />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: "#007AFF",
    fontWeight: "300",
  },
  logo: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
    letterSpacing: -0.5,
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  coinIcon: {
    fontSize: 16,
  },
  coinText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    padding: 4,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },
  togglePill: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.3,
  },
  toggleTextActive: {
    color: "#1C1C1E",
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  coinEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "400",
    letterSpacing: -0.3,
  },
  packagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "space-between",
  },
  packageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "48%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    position: "absolute",
    top: -8,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  packageCoins: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
    letterSpacing: -1,
  },
  packageLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  packagePrice: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  inviteButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inviteButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    letterSpacing: -0.3,
  },
  // Subscription tab
  subList: {
    paddingTop: 8,
    gap: 16,
  },
  subButton: {
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  subButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
});
