// RevenueCat has been disabled - native module not available in Expo Go
// To enable: add expo-dev-client and build custom development build

export const ENTITLEMENT_ID = 'Enola Pro';

export const PRODUCT_IDS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CONSUMABLE: 'consumable',
};

export const initializeRevenueCat = async (userId?: string): Promise<void> => {
  console.log('RevenueCat disabled - native module not available');
};

export const identifyUser = async (userId: string): Promise<void> => {
  console.log('RevenueCat disabled');
};

export const getCustomerInfo = async (): Promise<any> => {
  return null;
};

export const hasProEntitlement = async (): Promise<boolean> => {
  return false;
};

export const getOfferings = async (): Promise<any> => {
  return null;
};

export const purchasePackage = async (pkg: any): Promise<any> => {
  throw new Error('Purchases not available');
};

export const restorePurchases = async (): Promise<any> => {
  throw new Error('Purchases not available');
};

export const getSubscriptionStatus = async (): Promise<{
  isPro: boolean;
  expirationDate: string | null;
  willRenew: boolean;
  productIdentifier: string | null;
}> => {
  return {
    isPro: false,
    expirationDate: null,
    willRenew: false,
    productIdentifier: null,
  };
};

export const logoutRevenueCat = async (): Promise<void> => {
  console.log('RevenueCat disabled');
};

export const addCustomerInfoUpdateListener = (callback: any): void => {
  console.log('RevenueCat disabled');
};

export const removeCustomerInfoUpdateListener = (callback: any): void => {
  console.log('RevenueCat disabled');
};

export const getProductInfo = async (productId: string): Promise<any> => {
  return null;
};

export const checkEligibility = async (productIds: string[]): Promise<Record<string, boolean>> => {
  return {};
};
