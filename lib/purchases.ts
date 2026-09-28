import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo as RevenueCatCustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { supabase } from './supabase';

export const USE_REAL_PURCHASES = true;

export const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
export const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

export const PREMIUM_ENTITLEMENT = 'psychotechniplus Pro';
export const LEGACY_PREMIUM_ENTITLEMENTS = ['premium'];
export const DEFAULT_OFFERING_ID = 'default';

export const PRODUCT_IDS = {
  weekly: 'com.psychotechniplus.premium.weekly',
  monthly: 'com.psychotechniplus.premium.monthly',
  lifetime: 'com.psychotechniplus.premium.lifetime',
} as const;

export type PurchasePackageId = keyof typeof PRODUCT_IDS;

export interface PurchasePackage {
  identifier: PurchasePackageId;
  productIdentifier: string;
  price: number;
  priceString: string;
  description: string;
  offeringIdentifier: string;
  isSubscription: boolean;
}

export type CustomerInfo = RevenueCatCustomerInfo;

const PACKAGE_DESCRIPTIONS: Record<PurchasePackageId, string> = {
  weekly: 'פרימיום שבועי',
  monthly: 'פרימיום חודשי',
  lifetime: 'גישה לצמיתות',
};

let configured = false;
let latestCustomerInfo: RevenueCatCustomerInfo | null = null;
let currentAppUserId = '';

const isRevenueCatSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function getApiKey(): string {
  return Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
}

function hasRevenueCatApiKey(): boolean {
  return getApiKey().trim().length > 0;
}

export function canSyncPremiumWithPurchases(): boolean {
  return USE_REAL_PURCHASES && isRevenueCatSupported && hasRevenueCatApiKey();
}

function ensurePurchasesConfigured(userId?: string): boolean {
  if (!USE_REAL_PURCHASES || !isRevenueCatSupported || !hasRevenueCatApiKey()) return false;
  if (configured) return true;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);
  Purchases.configure({
    apiKey: getApiKey(),
    ...(userId ? { appUserID: userId } : {}),
    preferredUILocaleOverride: 'he-IL',
  });
  Purchases.addCustomerInfoUpdateListener(info => {
    latestCustomerInfo = info;
  });
  configured = true;
  return true;
}

function normalizePackageIdentifier(pkg: PurchasesPackage): PurchasePackageId | null {
  const raw = `${pkg.identifier} ${pkg.packageType} ${pkg.product.identifier}`.toLowerCase();
  if (raw.includes('lifetime')) return 'lifetime';
  if (raw.includes('monthly')) return 'monthly';
  if (raw.includes('week')) return 'weekly';
  return null;
}

function hasPremiumEntitlement(customerInfo: RevenueCatCustomerInfo | null | undefined): boolean {
  if (!customerInfo) return false;
  const hasEntitlement = [PREMIUM_ENTITLEMENT, ...LEGACY_PREMIUM_ENTITLEMENTS].some(
    entitlement => !!customerInfo.entitlements.active[entitlement],
  );
  if (hasEntitlement) return true;

  const activeSubscriptions = new Set((customerInfo.activeSubscriptions ?? []) as string[]);
  if (activeSubscriptions.has(PRODUCT_IDS.weekly) || activeSubscriptions.has(PRODUCT_IDS.monthly)) {
    return true;
  }

  const purchasedProducts = new Set(((customerInfo as any).allPurchasedProductIdentifiers ?? []) as string[]);
  return purchasedProducts.has(PRODUCT_IDS.lifetime);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message?: unknown }).message);
  return String(error);
}

function isUserCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'userCancelled' in error && Boolean((error as { userCancelled?: boolean }).userCancelled);
}

function mapPackage(pkg: PurchasesPackage): PurchasePackage | null {
  const identifier = normalizePackageIdentifier(pkg);
  if (!identifier) return null;

  return {
    identifier,
    productIdentifier: pkg.product.identifier,
    price: pkg.product.price,
    priceString: pkg.product.priceString,
    description: pkg.product.title || PACKAGE_DESCRIPTIONS[identifier],
    offeringIdentifier: pkg.offeringIdentifier,
    isSubscription: identifier !== 'lifetime',
  };
}

function sortPackages(packages: PurchasePackage[]): PurchasePackage[] {
  const order: PurchasePackageId[] = ['weekly', 'monthly', 'lifetime'];
  return [...packages].sort((a, b) => order.indexOf(a.identifier) - order.indexOf(b.identifier));
}

export async function initializePurchases(userId?: string): Promise<void> {
  if (userId) currentAppUserId = userId;
  ensurePurchasesConfigured(userId);
}

export async function identifyUser(userId: string): Promise<void> {
  currentAppUserId = userId;
  if (!ensurePurchasesConfigured()) return;
  const result = await Purchases.logIn(userId);
  latestCustomerInfo = result.customerInfo;
}

export async function getCustomerInfo(): Promise<RevenueCatCustomerInfo | null> {
  if (!ensurePurchasesConfigured()) return latestCustomerInfo;
  latestCustomerInfo = await Purchases.getCustomerInfo();
  return latestCustomerInfo;
}

export async function getOfferings(): Promise<PurchasePackage[]> {
  if (!USE_REAL_PURCHASES || !isRevenueCatSupported) return [];
  if (!hasRevenueCatApiKey()) throw new Error('רכישות בתוך האפליקציה לא הוגדרו עבור גרסת ההפצה.');
  ensurePurchasesConfigured();
  const offerings = await Purchases.getOfferings();
  const availablePackages = offerings.current?.availablePackages ?? offerings.all[DEFAULT_OFFERING_ID]?.availablePackages ?? [];
  const mapped = availablePackages.map(mapPackage).filter((pkg): pkg is PurchasePackage => Boolean(pkg));
  if (mapped.length === 0) {
    throw new Error(`לא נמצאו מוצרי רכישה פעילים ב-${Platform.OS === 'android' ? 'Google Play' : 'App Store'}. נסה שוב מאוחר יותר.`);
  }
  return sortPackages(mapped);
}

export async function purchasePackage(
  pkg: PurchasePackage,
): Promise<{ success: boolean; customerInfo?: RevenueCatCustomerInfo; cancelled?: boolean; error?: string }> {
  if (!USE_REAL_PURCHASES || !isRevenueCatSupported) {
    return { success: false, error: 'רכישות זמינות רק באפליקציית iOS או Android.' };
  }
  if (!hasRevenueCatApiKey()) return { success: false, error: 'רכישות בתוך האפליקציה לא הוגדרו עבור גרסת ההפצה.' };
  ensurePurchasesConfigured();

  try {
    const offerings = await Purchases.getOfferings();
    const availablePackages = [
      ...(offerings.current?.availablePackages ?? []),
      ...(offerings.all[DEFAULT_OFFERING_ID]?.availablePackages ?? []),
    ];
    const rcPackage = availablePackages.find(item => {
      const normalized = normalizePackageIdentifier(item);
      return normalized === pkg.identifier || item.product.identifier === pkg.productIdentifier;
    });

    if (!rcPackage) {
      return { success: false, error: 'המוצר שבחרת אינו זמין כרגע לרכישה. נסה שוב מאוחר יותר.' };
    }

    const result = await Purchases.purchasePackage(rcPackage);
    latestCustomerInfo = result.customerInfo;
    return {
      success: hasPremiumEntitlement(result.customerInfo),
      customerInfo: result.customerInfo,
      error: hasPremiumEntitlement(result.customerInfo) ? undefined : 'הרכישה הושלמה אך הגישה עדיין לא הופעלה. נסה לשחזר רכישה או פנה לתמיכה.',
    };
  } catch (error: unknown) {
    if (isUserCancelled(error)) return { success: false, cancelled: true };
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function restorePurchases(): Promise<{ isPremium: boolean; error?: string }> {
  if (!USE_REAL_PURCHASES || !isRevenueCatSupported) return { isPremium: false };
  if (!hasRevenueCatApiKey()) return { isPremium: false, error: 'רכישות בתוך האפליקציה לא הוגדרו עבור גרסת ההפצה.' };
  ensurePurchasesConfigured();
  try {
    const info = await Purchases.restorePurchases();
    latestCustomerInfo = info;
    return { isPremium: hasPremiumEntitlement(info) };
  } catch (error: unknown) {
    return { isPremium: false, error: getErrorMessage(error) };
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (!currentAppUserId || !REVENUECAT_API_KEY_IOS.trim()) return false;
    const { data, error } = await supabase.functions.invoke('revenuecat-entitlement', {
      body: { apiKey: REVENUECAT_API_KEY_IOS },
    });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return Boolean(data?.isPremium);
  }

  const info = await getCustomerInfo();
  return hasPremiumEntitlement(info);
}

export async function presentRevenueCatPaywall(): Promise<{ purchased: boolean; restored: boolean; error?: string }> {
  if (!USE_REAL_PURCHASES || !isRevenueCatSupported) {
    return { purchased: false, restored: false, error: 'מסך הרכישה זמין רק באפליקציית iOS או Android.' };
  }
  if (!hasRevenueCatApiKey()) return { purchased: false, restored: false, error: 'רכישות בתוך האפליקציה לא הוגדרו עבור גרסת ההפצה.' };
  ensurePurchasesConfigured();

  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT,
      displayCloseButton: true,
    });
    await getCustomerInfo();
    return {
      purchased: result === PAYWALL_RESULT.PURCHASED,
      restored: result === PAYWALL_RESULT.RESTORED,
    };
  } catch (error: unknown) {
    return { purchased: false, restored: false, error: getErrorMessage(error) };
  }
}

export async function presentCustomerCenter(): Promise<{ success: boolean; error?: string }> {
  if (!USE_REAL_PURCHASES || !isRevenueCatSupported) {
    return { success: false, error: 'ניהול מנוי זמין רק באפליקציית iOS או Android.' };
  }
  if (!hasRevenueCatApiKey()) return { success: false, error: 'רכישות בתוך האפליקציה לא הוגדרו עבור גרסת ההפצה.' };
  ensurePurchasesConfigured();

  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }) => {
          latestCustomerInfo = customerInfo;
        },
      },
    });
    await getCustomerInfo();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function logOutPurchases(): Promise<void> {
  currentAppUserId = '';
  if (!ensurePurchasesConfigured()) {
    latestCustomerInfo = null;
    return;
  }
  await Purchases.logOut().catch(() => null);
  latestCustomerInfo = null;
}
