/**
 * RevenueCat integration layer.
 *
 * DEV MODE: all functions are mocked — purchases always succeed, checkStatus returns false.
 *
 * TO GO LIVE:
 *  1. npx expo install react-native-purchases
 *  2. Set REVENUECAT_API_KEY_IOS / ANDROID below (from RevenueCat dashboard)
 *  3. Set USE_REAL_PURCHASES = true
 *  4. In RevenueCat dashboard, create an "Offering" called "default" with 3 packages:
 *       - identifier: "weekly"    → product: com.psychotechniplus.premium.weekly  (1-week sub)
 *       - identifier: "monthly"   → product: com.psychotechniplus.premium.monthly (1-month sub)
 *       - identifier: "lifetime"  → product: com.psychotechniplus.premium.lifetime (non-renewing)
 *  5. Create an Entitlement called "premium" and attach all 3 products to it.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

export const USE_REAL_PURCHASES = false; // flip to true after installing react-native-purchases

export const REVENUECAT_API_KEY_IOS     = 'YOUR_REVENUECAT_IOS_API_KEY';
export const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY';

export const PREMIUM_ENTITLEMENT = 'premium';

// Product identifiers — must match exactly in App Store Connect & RevenueCat
export const PRODUCT_IDS = {
  weekly:   'com.psychotechniplus.premium.weekly',
  monthly:  'com.psychotechniplus.premium.monthly',
  lifetime: 'com.psychotechniplus.premium.lifetime',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchasePackage {
  identifier: 'weekly' | 'monthly' | 'lifetime';
  productIdentifier: string;
  /** Localised price in ₪ */
  price: number;
  /** Formatted price string shown to user */
  priceString: string;
  /** Short user-facing label */
  description: string;
  offeringIdentifier: string;
  /** True for auto-renewing subscriptions */
  isSubscription: boolean;
}

export interface CustomerInfo {
  entitlements: {
    active: Record<string, { identifier: string; isActive: boolean; expirationDate: string | null }>;
  };
  activeSubscriptions: string[];
}

// ─── Mock data (shown in dev / simulator) ────────────────────────────────────

const MOCK_PACKAGES: PurchasePackage[] = [
  {
    identifier: 'weekly',
    productIdentifier: PRODUCT_IDS.weekly,
    price: 49.90,
    priceString: '₪49.90',
    description: 'פרמיום שבועי',
    offeringIdentifier: 'default',
    isSubscription: true,
  },
  {
    identifier: 'monthly',
    productIdentifier: PRODUCT_IDS.monthly,
    price: 99.90,
    priceString: '₪99.90',
    description: 'פרמיום חודשי',
    offeringIdentifier: 'default',
    isSubscription: true,
  },
  {
    identifier: 'lifetime',
    productIdentifier: PRODUCT_IDS.lifetime,
    price: 199.00,
    priceString: '₪199',
    description: 'גישה לצמיתות',
    offeringIdentifier: 'default',
    isSubscription: false,
  },
];

// ─── Real RevenueCat implementation (uncomment when USE_REAL_PURCHASES=true) ──
//
// import Purchases, { LOG_LEVEL } from 'react-native-purchases';
// import { Platform } from 'react-native';
//
// function mapPackage(pkg: any): PurchasePackage {
//   return {
//     identifier: pkg.packageType === 'LIFETIME' ? 'lifetime'
//       : pkg.packageType === 'WEEKLY' ? 'weekly' : 'monthly',
//     productIdentifier: pkg.product.identifier,
//     price: pkg.product.price,
//     priceString: pkg.product.priceString,
//     description: pkg.product.localizedTitle,
//     offeringIdentifier: pkg.offeringIdentifier,
//     isSubscription: pkg.packageType !== 'LIFETIME',
//   };
// }

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initializePurchases(userId: string): Promise<void> {
  if (!USE_REAL_PURCHASES) return;
  // Real:
  // const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  // Purchases.setLogLevel(LOG_LEVEL.ERROR);
  // Purchases.configure({ apiKey, appUserID: userId });
}

export async function identifyUser(userId: string): Promise<void> {
  if (!USE_REAL_PURCHASES) return;
  // Real: await Purchases.logIn(userId);
}

export async function getOfferings(): Promise<PurchasePackage[]> {
  if (!USE_REAL_PURCHASES) return MOCK_PACKAGES;
  // Real:
  // const offerings = await Purchases.getOfferings();
  // return (offerings.current?.availablePackages ?? []).map(mapPackage);
  return MOCK_PACKAGES;
}

export async function purchasePackage(
  pkg: PurchasePackage,
): Promise<{ success: boolean; customerInfo?: CustomerInfo; cancelled?: boolean; error?: string }> {
  if (!USE_REAL_PURCHASES) {
    // Mock: always succeeds after short delay
    await new Promise(r => setTimeout(r, 800));
    return {
      success: true,
      customerInfo: {
        entitlements: {
          active: {
            [PREMIUM_ENTITLEMENT]: {
              identifier: PREMIUM_ENTITLEMENT,
              isActive: true,
              expirationDate: pkg.isSubscription
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                : null,
            },
          },
        },
        activeSubscriptions: pkg.isSubscription ? [pkg.productIdentifier] : [],
      },
    };
  }
  // Real:
  // try {
  //   const rcPkg = (await Purchases.getOfferings()).current?.availablePackages
  //     .find(p => p.product.identifier === pkg.productIdentifier);
  //   if (!rcPkg) return { success: false, error: 'מוצר לא נמצא' };
  //   const { customerInfo } = await Purchases.purchasePackage(rcPkg);
  //   return { success: true, customerInfo: customerInfo as any };
  // } catch (e: any) {
  //   if (e.userCancelled) return { success: false, cancelled: true };
  //   return { success: false, error: e.message };
  // }
  return { success: false, error: 'Not implemented' };
}

export async function restorePurchases(): Promise<{ isPremium: boolean; error?: string }> {
  if (!USE_REAL_PURCHASES) return { isPremium: false };
  // Real:
  // try {
  //   const info = await Purchases.restorePurchases();
  //   return { isPremium: !!info.entitlements.active[PREMIUM_ENTITLEMENT]?.isActive };
  // } catch (e: any) {
  //   return { isPremium: false, error: e.message };
  // }
  return { isPremium: false };
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (!USE_REAL_PURCHASES) return false;
  // Real:
  // try {
  //   const info = await Purchases.getCustomerInfo();
  //   return !!info.entitlements.active[PREMIUM_ENTITLEMENT]?.isActive;
  // } catch {
  //   return false;
  // }
  return false;
}

export async function logOutPurchases(): Promise<void> {
  if (!USE_REAL_PURCHASES) return;
  // Real: await Purchases.logOut().catch(() => null);
}
