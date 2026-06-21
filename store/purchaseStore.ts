import { create } from 'zustand';
import {
  initializePurchases,
  identifyUser,
  getOfferings,
  purchasePackage as rcPurchase,
  restorePurchases,
  checkPremiumStatus,
  getCustomerInfo,
  logOutPurchases,
  presentRevenueCatPaywall,
  presentCustomerCenter,
  type CustomerInfo,
  type PurchasePackage,
} from '../lib/purchases';
import { logger } from '../utils/logger';
import { useUserStore } from './userStore';

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
      if (isPremium) {
        useUserStore.getState().setPremium(true);
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
      set({ loadError: msg });
    }
  },

  purchase: async (pkg) => {
    if (get().isPurchasing) return { success: false, error: 'רכישה כבר בתהליך' };
    set({ isPurchasing: true });
    try {
      const result = await rcPurchase(pkg);
      if (result.success) {
        useUserStore.getState().setPremium(true);
        set({ customerInfo: result.customerInfo ?? null });
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
      if (result.isPremium) {
        useUserStore.getState().setPremium(true);
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
      if (isPremium) useUserStore.getState().setPremium(true);
      return isPremium;
    } catch {
      return false;
    }
  },

  refreshCustomerInfo: async () => {
    try {
      const customerInfo = await getCustomerInfo();
      const isPremium = await checkPremiumStatus();
      if (isPremium) useUserStore.getState().setPremium(true);
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
