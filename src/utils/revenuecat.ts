import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export const ENTITLEMENT_ID = 'pro';

export const OFFERING_ID = 'default';
export const COIN_OFFERING_ID = 'coins';

// The coin-store offering (consumables). Separate from the subscription paywall.
export const getCoinOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all[COIN_OFFERING_ID] ?? null;
  } catch (error) {
    console.error('❌ Error fetching coin offerings:', error);
    return null;
  }
};

// The subscription offering (monthly + yearly auto-renewables) in the `default` offering.
export const getSubscriptionOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all[OFFERING_ID] ?? offerings.current ?? null;
  } catch (error) {
    console.error('❌ Error fetching subscription offerings:', error);
    return null;
  }
};

export const initializeRevenueCat = async (userId?: string): Promise<void> => {
  try {
    if (userId) {
      await Purchases.logIn(userId);
      console.log('✅ RevenueCat initialized with user:', userId);
    }
  } catch (error) {
    console.error('❌ RevenueCat initialization error:', error);
  }
};

export const identifyUser = async (userId: string): Promise<void> => {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    console.log('✅ User identified:', userId, customerInfo);
  } catch (error) {
    console.error('❌ Error identifying user:', error);
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('❌ Error fetching customer info:', error);
    return null;
  }
};

export const hasProEntitlement = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const hasEntitlement = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
    console.log('🔍 Pro entitlement status:', hasEntitlement);
    return hasEntitlement;
  } catch (error) {
    console.error('❌ Error checking entitlement:', error);
    return false;
  }
};

// Reliable Pro check for the buy-again GATES (onboarding paywall). On a fresh reinstall
// the SDK's first getCustomerInfo can return before StoreKit has re-synced the Apple
// receipt, so a live subscriber briefly reads as NOT Pro and gets shown a buy-again
// paywall. If the first read says not-Pro, force a restore (re-attaches the receipt) and
// re-check. A true non-subscriber just pays one extra round-trip and still sees the paywall.
// No password prompt on iOS for a silent restore of an existing receipt.
export const hasProEntitlementSynced = async (): Promise<boolean> => {
  if (await hasProEntitlement()) return true;
  try {
    const info = await Purchases.restorePurchases();
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
  } catch (error) {
    console.error('❌ Error syncing entitlement:', error);
    return false; // fail open to the paywall — never trap a real non-subscriber
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      console.log('✅ Current offering:', offerings.current);
      return offerings.current;
    }
    console.log('⚠️ No current offering found');
    return null;
  } catch (error) {
    console.error('❌ Error fetching offerings:', error);
    return null;
  }
};

export const purchasePackage = async (pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; productIdentifier: string } | null> => {
  try {
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
    console.log('✅ Purchase successful:', productIdentifier);
    return { customerInfo, productIdentifier };
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error('❌ Purchase error:', error);
    } else {
      console.log('🚫 User cancelled purchase');
    }
    return null;
  }
};

// Opens Apple's native offer-code redemption sheet (iOS only). After the user
// redeems, RevenueCat fires the purchase webhook, which credits coins server-side
// exactly like a normal purchase — nothing to do app-side beyond opening the sheet.
export const redeemCode = async (): Promise<void> => {
  try {
    await Purchases.presentCodeRedemptionSheet();
  } catch (error) {
    console.error('❌ Error presenting code redemption sheet:', error);
  }
};

export const restorePurchases = async (): Promise<CustomerInfo | null> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('✅ Purchases restored');
    return customerInfo;
  } catch (error) {
    console.error('❌ Error restoring purchases:', error);
    return null;
  }
};

export const getSubscriptionStatus = async (): Promise<{
  isPro: boolean;
  expirationDate: string | null;
  willRenew: boolean;
  productIdentifier: string | null;
}> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement) {
      return {
        isPro: true,
        expirationDate: entitlement.expirationDate,
        willRenew: entitlement.willRenew,
        productIdentifier: entitlement.productIdentifier,
      };
    }

    return {
      isPro: false,
      expirationDate: null,
      willRenew: false,
      productIdentifier: null,
    };
  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    return {
      isPro: false,
      expirationDate: null,
      willRenew: false,
      productIdentifier: null,
    };
  }
};

export const logoutRevenueCat = async (): Promise<void> => {
  try {
    await Purchases.logOut();
    console.log('✅ User logged out from RevenueCat');
  } catch (error) {
    console.error('❌ Error logging out:', error);
  }
};

export const addCustomerInfoUpdateListener = (callback: (customerInfo: CustomerInfo) => void): void => {
  Purchases.addCustomerInfoUpdateListener(callback);
};

export const removeCustomerInfoUpdateListener = (callback: (customerInfo: CustomerInfo) => void): void => {
  Purchases.removeCustomerInfoUpdateListener(callback);
};

export const getProductInfo = async (productId: string): Promise<any> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      const product = offerings.current.availablePackages.find(
        pkg => pkg.product.identifier === productId
      );
      return product?.product || null;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting product info:', error);
    return null;
  }
};

export const checkEligibility = async (productIds: string[]): Promise<Record<string, boolean>> => {
  // RevenueCat handles eligibility automatically
  // Return true for all products as a default
  const eligibility: Record<string, boolean> = {};
  productIds.forEach(id => {
    eligibility[id] = true;
  });
  return eligibility;
};
