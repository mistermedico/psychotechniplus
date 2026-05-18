// lib/purchases.ts
// RevenueCat integration layer.
// In production (after `eas build`), swap the mock with:
//   import Purchases from 'react-native-purchases';
// and uncomment the real implementations.

export const REVENUECAT_API_KEY_IOS = 'YOUR_REVENUECAT_IOS_API_KEY';
export const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY';

export interface PurchasePackage {
  identifier: string;
  productIdentifier: string;
  price: number;
  priceString: string;
  description: string;
  offeringIdentifier: string;
}

export interface CustomerInfo {
  entitlements: {
    active: Record<string, { identifier: string; isActive: boolean; expirationDate: string | null }>;
  };
  activeSubscriptions: string[];
}

export const PREMIUM_ENTITLEMENT = 'premium';

// Mock offerings for development
const MOCK_PACKAGES: PurchasePackage[] = [
  {
    identifier: 'monthly',
    productIdentifier: 'com.psychotechniplus.premium.monthly',
    price: 29.90,
    priceString: '₪29.90/חודש',
    description: 'מנוי חודשי',
    offeringIdentifier: 'default',
  },
  {
    identifier: 'annual',
    productIdentifier: 'com.psychotechniplus.premium.annual',
    price: 199.90,
    priceString: '₪199.90/שנה',
    description: 'מנוי שנתי — חסכון 44%',
    offeringIdentifier: 'default',
  },
  {
    identifier: 'lifetime',
    productIdentifier: 'com.psychotechniplus.premium.lifetime',
    price: 349.90,
    priceString: '₪349.90 תשלום חד-פעמי',
    description: 'גישה לצמיתות',
    offeringIdentifier: 'default',
  },
];

export async function initializePurchases(userId: string): Promise<void> {
  // Real: await Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
  //       await Purchases.logIn(userId);
  console.log('[Purchases] Mock initialized for user:', userId);
}

export async function getOfferings(): Promise<PurchasePackage[]> {
  // Real: const offerings = await Purchases.getOfferings();
  //       return offerings.current?.availablePackages ?? [];
  return MOCK_PACKAGES;
}

export async function purchasePackage(pkg: PurchasePackage): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  // Real: const { customerInfo } = await Purchases.purchasePackage(rcPackage);
  //       return { success: true, customerInfo };
  // Mock: simulate purchase
  return {
    success: true,
    customerInfo: {
      entitlements: {
        active: {
          [PREMIUM_ENTITLEMENT]: { identifier: PREMIUM_ENTITLEMENT, isActive: true, expirationDate: null },
        },
      },
      activeSubscriptions: [pkg.productIdentifier],
    },
  };
}

export async function restorePurchases(): Promise<{ isPremium: boolean }> {
  // Real: const info = await Purchases.restorePurchases();
  //       return { isPremium: !!info.entitlements.active[PREMIUM_ENTITLEMENT] };
  return { isPremium: false };
}

export async function checkPremiumStatus(): Promise<boolean> {
  // Real: const info = await Purchases.getCustomerInfo();
  //       return !!info.entitlements.active[PREMIUM_ENTITLEMENT]?.isActive;
  return false;
}
