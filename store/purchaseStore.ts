import { create } from 'zustand';
import {
  initializePurchases, identifyUser, getOfferings,
  purchasePackage as rcPurchase, restorePurchases,
  checkPremiumStatus, logOutPurchases,
  PurchasePackage,
} from '../lib/purchases';
import { logger } from '../utils/logger';
import { useUserStore } from './userStore';

interface PurchaseState {
  isInitialized: boolean;
  packages: PurchasePackage[];
  isPurchasing: boolean;
  isRestoring: boolean;
  loadError: string | null;

  initialize: (userId: string) => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchase: (pkg: PurchasePackage) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  restore: () => Promise<{ isPremium: boolean; error?: string }>;
  checkStatus: () => Promise<boolean>;
  logOut: () => Promise<void>;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  isInitialized: false,
  packages: [],
  isPurchasing: false,
  isRestoring: false,
  loadError: null,

  initialize: async (userId) => {
    try {
      await initializePurchases(userId);
      await identifyUser(userId);
      set({ isInitialized: true, loadError: null });
      logger.info('purchaseStore:initialize', 'RevenueCat אותחל');

      // Check and restore premium status on every launch
      const isPremium = await checkPremiumStatus();
      if (isPremium) {
        useUserStore.getState().setPremium(true);
        logger.info('purchaseStore:initialize', 'מנוי פעיל — isPremium=true');
      }

      // Pre-fetch offerings so paywall opens instantly
      get().fetchOfferings();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('purchaseStore:initialize', 'שגיאה באתחול RevenueCat', msg);
      set({ loadError: msg });
    }
  },

  fetchOfferings: async () => {
    try {
      const packages = await getOfferings();
      set({ packages, loadError: null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('purchaseStore:fetchOfferings', 'שגיאה בטעינת מחירים', msg);
      set({ loadError: msg });
    }
  },

  purchase: async (pkg) => {
    if (get().isPurchasing) return { success: false, error: 'רכישה בתהליך' };
    set({ isPurchasing: true });
    try {
      const result = await rcPurchase(pkg);
      if (result.success) {
        useUserStore.getState().setPremium(true);
        logger.success('purchaseStore:purchase', `רכישה הצליחה: ${pkg.identifier}`);
      }
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('purchaseStore:purchase', 'שגיאת רכישה', msg);
      return { success: false, error: msg };
    } finally {
      set({ isPurchasing: false });
    }
  },

  restore: async () => {
    set({ isRestoring: true });
    try {
      const result = await restorePurchases();
      if (result.isPremium) {
        useUserStore.getState().setPremium(true);
        logger.info('purchaseStore:restore', 'מנוי שוחזר בהצלחה');
      }
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('purchaseStore:restore', 'שגיאת שחזור', msg);
      return { isPremium: false, error: msg };
    } finally {
      set({ isRestoring: false });
    }
  },

  checkStatus: async () => {
    try {
      const isPremium = await checkPremiumStatus();
      if (isPremium) useUserStore.getState().setPremium(true);
      return isPremium;
    } catch {
      return false;
    }
  },

  logOut: async () => {
    await logOutPurchases();
    set({ isInitialized: false, packages: [] });
  },
}));
