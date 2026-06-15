# RevenueCat Integration - Complete Setup Guide

## ✅ Installation Complete

The following packages have been installed:
- `react-native-purchases@10.3.0` - Core SDK
- `react-native-purchases-ui@10.3.0` - Paywall UI components

---

## 📁 Files Created

### 1. **Core Service** - `/src/utils/revenuecat.ts`
Centralized RevenueCat service with:
- ✅ SDK initialization
- ✅ User identification
- ✅ Customer info retrieval
- ✅ Entitlement checking ("Enola Pro")
- ✅ Purchase handling
- ✅ Restore purchases
- ✅ Subscription status checks
- ✅ Real-time update listeners

### 2. **Custom Hooks** - `/src/hooks/useProStatus.ts`
React hooks for easy subscription checking:
- `useProStatus()` - Real-time Pro status with auto-updates
- `useProCheck()` - One-time Pro status check

### 3. **Paywall Screen** - `/src/app/paywall.tsx`
Full-featured paywall screen:
- ✅ RevenueCatUI integration
- ✅ Automatic paywall presentation
- ✅ Purchase result handling
- ✅ Restore purchases
- ✅ Error handling

### 4. **Modified Files**
- `src/app/_layout.tsx` - RevenueCat initialization on app start
- `src/app/coins.tsx` - Pro user detection and unlimited access UI
- `src/app/settings.tsx` - Customer Center integration and subscription management

---

## 🔑 Configuration

### API Keys
**Test Key (Currently Configured):** `test_oiKinqnTvLpPTIMdzcuDacNWBmh`

**Location:** `/src/utils/revenuecat.ts`

```typescript
const API_KEYS = {
  apple: 'test_oiKinqnTvLpPTIMdzcuDacNWBmh',
  google: 'test_oiKinqnTvLpPTIMdzcuDacNWBmh',
};
```

**Before Production:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to your project
3. Get production API keys for iOS and Android
4. Replace test keys with production keys

---

## 📦 Products Configuration

### Products to Create in RevenueCat Dashboard

#### 1. **Monthly Subscription**
- **Product ID:** `monthly`
- **Type:** Auto-renewable subscription
- **Duration:** 1 month
- **Entitlement:** Enola Pro

#### 2. **Yearly Subscription**
- **Product ID:** `yearly`
- **Type:** Auto-renewable subscription
- **Duration:** 1 year
- **Entitlement:** Enola Pro

#### 3. **Consumable (Coins)**
- **Product ID:** `consumable`
- **Type:** Consumable
- **Description:** One-time coin purchase

### Steps to Configure Products:

1. **Go to RevenueCat Dashboard** → Your Project → Products
2. **Click "Add Product"**
3. **Enter Product ID** (must match App Store Connect / Play Console)
4. **Link to Entitlement:** "Enola Pro"
5. **Save**

---

## 🎁 Entitlement Configuration

### Primary Entitlement: "Enola Pro"

**What it unlocks:**
- ✅ Unlimited face searches (no coin deduction)
- ✅ Priority support
- ✅ Ad-free experience
- ✅ All premium features

**Where it's checked:**
- `src/utils/revenuecat.ts` - `hasProEntitlement()`
- `src/hooks/useProStatus.ts` - `useProStatus()`
- `src/app/coins.tsx` - Shows unlimited access instead of coin packages
- `src/app/settings.tsx` - Shows Pro badge and manage subscription

---

## 🚀 Usage Examples

### Check if User is Pro

```typescript
import { useProStatus } from '@/hooks/useProStatus';

function MyComponent() {
  const { isPro, loading } = useProStatus();

  if (loading) return <LoadingSpinner />;

  return (
    <View>
      {isPro ? (
        <Text>You're a Pro user! Enjoy unlimited access.</Text>
      ) : (
        <Button title="Upgrade to Pro" onPress={() => router.push('/paywall')} />
      )}
    </View>
  );
}
```

### Present Paywall

```typescript
import { router } from 'expo-router';

// Navigate to paywall screen
router.push('/paywall');

// Paywall automatically presents with RevenueCatUI
```

### Check Entitlement Programmatically

```typescript
import { hasProEntitlement } from '@/utils/revenuecat';

async function checkAccess() {
  const isPro = await hasProEntitlement();

  if (isPro) {
    // Allow unlimited searches
    performSearch();
  } else {
    // Check coin balance
    checkCoins();
  }
}
```

### Get Customer Info

```typescript
import { getCustomerInfo } from '@/utils/revenuecat';

async function getSubscriptionDetails() {
  const customerInfo = await getCustomerInfo();

  // Check specific entitlement
  const proEntitlement = customerInfo.entitlements.active['Enola Pro'];

  if (proEntitlement) {
    console.log('Pro until:', proEntitlement.expirationDate);
    console.log('Will renew:', proEntitlement.willRenew);
  }
}
```

### Restore Purchases

```typescript
import { restorePurchases } from '@/utils/revenuecat';

async function handleRestore() {
  try {
    const customerInfo = await restorePurchases();
    const isPro = customerInfo.entitlements.active['Enola Pro'] !== undefined;

    if (isPro) {
      Alert.alert('Success', 'Your Pro subscription has been restored!');
    } else {
      Alert.alert('No Purchases', 'No purchases found to restore.');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to restore purchases.');
  }
}
```

---

## 🎨 UI Implementation

### 1. **Coins Screen** (`/coins`)

**Free Users See:**
- Upgrade to Pro banner (prominent CTA)
- Coin packages for purchase
- Referral section

**Pro Users See:**
- "ENOLA PRO" badge
- "Unlimited Searches" message
- List of Pro benefits
- "Manage Subscription" button

### 2. **Settings Screen** (`/settings`)

**Free Users See:**
- "Upgrade to Pro" card at top
- Upgrade button → Opens paywall

**Pro Users See:**
- "Enola Pro Active" status card
- "Manage Subscription" button → Opens Customer Center

### 3. **Paywall Screen** (`/paywall`)

- Auto-presents RevenueCatUI paywall
- Handles purchase results
- Restore purchases option
- Redirects after successful purchase

---

## 🔄 User Flow

### First-Time User
1. Downloads app
2. Signs up (anonymous user)
3. Gets 1 free coin
4. Performs 1 search
5. Out of coins → Sees upgrade banner
6. Taps "Upgrade" → Paywall presents
7. Subscribes → Becomes Pro
8. Unlimited searches unlocked

### Existing User
1. Opens app
2. RevenueCat checks subscription status
3. If Pro: Unlimited access
4. If not Pro: Coin-based system

### Subscription Management
1. Pro user opens Settings
2. Taps "Manage Subscription"
3. Customer Center opens
4. Can cancel, change plan, etc.

---

## 🧪 Testing

### Test Purchase Flow

1. **Run app in development**
2. **Navigate to paywall:** `/paywall`
3. **Test purchase with sandbox account:**
   - iOS: Sandbox Apple ID
   - Android: Test license account
4. **Verify entitlement:** Check if Pro badge appears

### Test Restoration

1. **Delete app**
2. **Reinstall**
3. **Tap "Restore Purchases"**
4. **Verify Pro status restored**

### Test Customer Center

1. **Open Settings as Pro user**
2. **Tap "Manage Subscription"**
3. **Verify Customer Center opens**
4. **Test cancel/refund flows**

---

## 🔐 Security Best Practices

### ✅ Implemented

1. **Server-side validation** - RevenueCat validates all purchases
2. **Secure entitlement checking** - Done server-side by RevenueCat
3. **User identification** - App users tied to RevenueCat customer IDs
4. **Receipt validation** - Automatic via RevenueCat

### ⚠️ Important Notes

1. **Never** store subscription status locally without verification
2. **Always** check entitlements server-side (RevenueCat handles this)
3. **Use** RevenueCat's customer info as source of truth
4. **Test** with sandbox accounts before production

---

## 📊 RevenueCat Dashboard Setup

### Step 1: Create Project
1. Go to [app.revenuecat.com](https://app.revenuecat.com)
2. Create new project: "Enola"
3. Get API keys (already configured)

### Step 2: Configure Products
1. Go to **Products** tab
2. Add products:
   - `monthly` → Link to "Enola Pro"
   - `yearly` → Link to "Enola Pro"
   - `consumable` → Standalone

### Step 3: Create Entitlements
1. Go to **Entitlements** tab
2. Create entitlement: "Enola Pro"
3. Link monthly and yearly products

### Step 4: Design Paywall
1. Go to **Paywalls** tab
2. Create new paywall
3. Design UI:
   - Title: "Upgrade to Enola Pro"
   - Features list
   - Pricing cards
4. Set as default offering

### Step 5: Configure Offerings
1. Go to **Offerings** tab
2. Create default offering
3. Add packages:
   - Monthly subscription
   - Yearly subscription
4. Save

---

## 🐛 Troubleshooting

### Issue: "No offerings available"

**Solution:**
1. Check RevenueCat dashboard has products configured
2. Verify products exist in App Store Connect / Play Console
3. Check API key is correct
4. Wait 5-10 minutes for sync

### Issue: "Purchase not working in test"

**Solution:**
1. Use sandbox Apple ID (iOS) or test account (Android)
2. Sign out of real App Store account
3. Clear app data and reinstall
4. Check RevenueCat logs in dashboard

### Issue: "Entitlement not detected after purchase"

**Solution:**
1. Check product is linked to "Enola Pro" entitlement
2. Verify purchase completed successfully
3. Call `getCustomerInfo()` to refresh
4. Check RevenueCat dashboard for customer

### Issue: "Customer Center not opening"

**Solution:**
1. Ensure user has active subscription
2. Check RevenueCat dashboard has Customer Center enabled
3. Update to latest `react-native-purchases-ui` version
4. Check device/simulator supports Customer Center

---

## 📱 App Store Connect Setup

### iOS Products

1. **Go to App Store Connect** → Your App → In-App Purchases
2. **Create Auto-Renewable Subscription Group:** "Enola Pro Subscriptions"
3. **Add Monthly Subscription:**
   - Product ID: `monthly`
   - Reference Name: Enola Pro Monthly
   - Duration: 1 Month
   - Price: Set your price tier
4. **Add Yearly Subscription:**
   - Product ID: `yearly`
   - Reference Name: Enola Pro Yearly
   - Duration: 1 Year
   - Price: Set your price tier
5. **Add Consumable:**
   - Product ID: `consumable`
   - Reference Name: Coin Pack
   - Type: Consumable
6. **Submit for Review** with app

### Android Products (Google Play Console)

1. **Go to Play Console** → Your App → Monetization → Subscriptions
2. **Create Subscription Products:**
   - Base plan ID: `monthly`
   - Billing period: 1 Month
   - Base plan ID: `yearly`
   - Billing period: 1 Year
3. **Link to RevenueCat:**
   - Copy package names to RevenueCat dashboard
4. **Activate products**

---

## 🚢 Production Checklist

Before launching to production:

- [ ] Replace test API keys with production keys
- [ ] Configure products in App Store Connect / Play Console
- [ ] Link products in RevenueCat dashboard
- [ ] Create "Enola Pro" entitlement
- [ ] Design paywall in RevenueCat dashboard
- [ ] Test purchase flow with sandbox accounts
- [ ] Test restoration flow
- [ ] Test Customer Center
- [ ] Verify entitlement checking works
- [ ] Test on both iOS and Android
- [ ] Set up webhooks (optional, for server notifications)
- [ ] Configure subscription notifications
- [ ] Test cancellation/refund flows
- [ ] Update privacy policy with subscription terms
- [ ] Submit products for App Store review

---

## 💡 Tips & Best Practices

1. **Start with test environment** - Don't use production keys during development
2. **Design great paywall** - Use RevenueCat's templates or customize
3. **Offer free trial** - Increases conversion significantly
4. **Show value clearly** - Explain why Pro is worth it
5. **Test thoroughly** - Test all purchase scenarios before launch
6. **Monitor metrics** - Use RevenueCat dashboard for analytics
7. **Handle errors gracefully** - Always show friendly error messages
8. **Restore is critical** - Make restore purchases easy to find
9. **Customer Center** - Let users manage subscriptions easily
10. **A/B test paywalls** - RevenueCat supports paywall experiments

---

## 📞 Support

**RevenueCat Documentation:** https://docs.revenuecat.com/
**RevenueCat Community:** https://community.revenuecat.com/
**SDK Reference:** https://sdk.revenuecat.com/

---

## 🎉 You're Ready!

Your Enola app now has:
- ✅ Full RevenueCat SDK integration
- ✅ Subscription management
- ✅ Paywall UI
- ✅ Pro entitlement checking
- ✅ Customer Center
- ✅ Restore purchases
- ✅ Real-time subscription updates

**Next Steps:**
1. Test in development with sandbox accounts
2. Configure products in RevenueCat dashboard
3. Design your paywall
4. Test all flows
5. Launch to production!

Good luck with your subscriptions! 🚀
