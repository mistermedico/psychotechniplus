import { create } from 'zustand';
import {
  initializePurchases,
  identifyUser,
  getOfferings,
  purchasePackage as rcPurchase,
  restorePurchases,
  checkPremiumStatus,
  canSyncPremiumWithPurchases,
  getCustomerInfo,
  logOutPurchases,
  presentRevenueCatPaywall,
  presentCustomerCenter,
  DEFAULT_PURCHASE_PACKAGES,
  type CustomerInfo,
  type PurchasePackage,
} from '../lib/purchases';
import { logger } from '../utils/logger';
import { useUserStore } from './userStore';
import { notifyPurchase } from '../lib/adminEmail';

interface PurchaseState {
  isInitialized: boolean;
  packages: PurchasePackage[];
  isPurchasing: boolean;
  isRestoring: boolean;
  loadError: string | null;
  customerInfo: CustomerInfo | null;

  initialize: (userId?: string) => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchase: (pkg: PurchasePackage) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  restore: () => Promise<{ isPremium: boolean; error?: string }>;
  checkStatus: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  showRevenueCatPaywall: () => Promise<{ purchased: boolean; restored: boolean; error?: string }>;
  showCustomerCenter: () => Promise<{ success: boolean; error?: string }>;
  logOut: () => Promise<void>;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function syncUserPremium(isPremium: boolean) {
  if (canSyncPremiumWithPurchases()) {
    useUserStore.getState().setPremium(isPremium);
  } else if (isPremium) {
    useUserStore.getState().setPremium(true);
  }
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  isInitialized: false,
  packages: [],
  isPurchasing: false,
  isRestoring: false,
  loadError: null,
  customerInfo: null,

  initialize: async (userId) => {
    try {
      await initializePurchases(userId);
      if (userId) await identifyUser(userId);
      const customerInfo = await getCustomerInfo();
      set({ isInitialized: true, customerInfo, loadError: null });
      logger.info('purchaseStore:initialize', 'RevenueCat initialized');

      const isPremium = await checkPremiumStatus();
      syncUserPremium(isPremium);
      if (isPremium) {
        logger.info('purchaseStore:initialize', 'Active entitlement found');
      }

      get().fetchOfferings();
    } catch (error: unknown) {
      const msg = messageFrom(error);
      logger.error('purchaseStore:initialize', 'RevenueCat initialization failed', msg);
      set({ loadError: msg });
    }
  },

  fetchOfferings: async () => {
    try {
      const packages = await getOfferings();
      set({ packages, loadError: null });
    } catch (error: unknown) {
      const msg = messageFrom(error);
      logger.error('purchaseStore:fetchOfferings', 'Failed loading RevenueCat offerings', msg);
      set({ packages: DEFAULT_PURCHASE_PACKAGES, loadError: msg });
    }
  },

  purchase: async (pkg) => {
    if (get().isPurchasing) return { success: false, error: 'רכישה כבר בתהליך' };
    set({ isPurchasing: true });
    try {
      const result = await rcPurchase(pkg);
      if (result.success) {
        syncUserPremium(true);
        set({ customerInfo: result.customerInfo ?? null });
        const user = useUserStore.getState();
        notifyPurchase({
          userId: user.userId,
          email: user.email,
          name: user.name,
          packageId: pkg.identifier,
          productIdentifier: pkg.productIdentifier,
          price: pkg.price,
          priceString: pkg.priceString,
          isSubscription: pkg.isSubscription,
          source: 'direct_package_purchase',
          customerInfo: result.customerInfo,
        });
        logger.success('purchaseStore:purchase', `Purchase completed: ${pkg.identifier}`);
      }
      return result;
    } catch (error: unknown) {
      const msg = messageFrom(error);
      logger.error('purchaseStore:purchase', 'Purchase failed', msg);
      return { success: false, error: msg };
    } finally {
      set({ isPurchasing: false });
    }
  },

  restore: async () => {
    set({ isRestoring: true });
    try {
      const result = await restorePurchases();
      const customerInfo = await getCustomerInfo();
      set({ customerInfo });
      syncUserPremium(result.isPremium);
      if (result.isPremium) {
        logger.info('purchaseStore:restore', 'Purchase restored');
      }
      return result;
    } catch (error: unknown) {
      const msg = messageFrom(error);
      logger.error('purchaseStore:restore', 'Restore failed', msg);
      return { isPremium: false, error: msg };
    } finally {
      set({ isRestoring: false });
    }
  },

  checkStatus: async () => {
    try {
      const isPremium = await checkPremiumStatus();
      const customerInfo = await getCustomerInfo();
      set({ customerInfo });
      syncUserPremium(isPremium);
      return isPremium;
    } catch {
      return false;
    }
  },

  refreshCustomerInfo: async () => {
    try {
      const customerInfo = await getCustomerInfo();
      const isPremium = await checkPremiumStatus();
      syncUserPremium(isPremium);
      set({ customerInfo, loadError: null });
      return customerInfo;
    } catch (error: unknown) {
      const msg = messageFrom(error);
      set({ loadError: msg });
      return null;
    }
  },

  showRevenueCatPaywall: async () => {
    const result = await presentRevenueCatPaywall();
    if (result.purchased || result.restored) {
      await get().checkStatus();
      if (result.purchased) {
        const user = useUserStore.getState();
        notifyPurchase({
          userId: user.userId,
          email: user.email,
          name: user.name,
          source: 'revenuecat_paywall',
          customerInfo: get().customerInfo,
        });
      }
    }
    return result;
  },

  showCustomerCenter: async () => {
    const result = await presentCustomerCenter();
    await get().refreshCustomerInfo();
    return result;
  },

  logOut: async () => {
    await logOutPurchases();
    set({ isInitialized: false, packages: [], customerInfo: null });
  },
}));
