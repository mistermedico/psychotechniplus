import mobileAds, {
  AdEventType,
  InterstitialAd,
} from 'react-native-google-mobile-ads';
import {
  canShowAdsForUser,
  getBannerAdUnitId,
  getInterstitialAdUnitId,
  getRewardedAdUnitId,
  isAdMobRuntimeSupported,
} from './ads';
import { logger } from '../utils/logger';

export {
  canShowAdsForUser,
  getBannerAdUnitId,
  getInterstitialAdUnitId,
  getRewardedAdUnitId,
  isAdMobRuntimeSupported,
};

let initialized = false;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let interstitialLoading = false;
let cleanupInterstitialListeners: (() => void) | null = null;

function prepareInterstitial(): void {
  if (!isAdMobRuntimeSupported()) return;
  const unitId = getInterstitialAdUnitId();
  if (!unitId || interstitialLoaded || interstitialLoading) return;

  cleanupInterstitialListeners?.();
  interstitialLoading = true;
  interstitial = InterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    interstitialLoading = false;
  });
  const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitialLoading = false;
    prepareInterstitial();
  });
  const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, error => {
    interstitialLoaded = false;
    interstitialLoading = false;
    logger.warn('ads', `Interstitial failed: ${error.message}`);
  });

  cleanupInterstitialListeners = () => {
    unsubscribeLoaded();
    unsubscribeClosed();
    unsubscribeError();
    cleanupInterstitialListeners = null;
  };

  interstitial.load();
}

export async function initializeAds(): Promise<void> {
  if (!isAdMobRuntimeSupported() || initialized) return;
  try {
    await mobileAds().initialize();
    initialized = true;
    prepareInterstitial();
  } catch (error: any) {
    logger.warn('ads', `AdMob initialization failed: ${error?.message ?? String(error)}`);
  }
}

export async function showInterstitialAfterSession(): Promise<boolean> {
  if (!isAdMobRuntimeSupported()) return false;
  if (!initialized) await initializeAds();
  if (!interstitialLoaded || !interstitial) {
    prepareInterstitial();
    return false;
  }

  const ad = interstitial;
  interstitialLoaded = false;
  try {
    await ad.show();
    return true;
  } catch (error: any) {
    logger.warn('ads', `Interstitial show failed: ${error?.message ?? String(error)}`);
    prepareInterstitial();
    return false;
  }
}

// Rewarded ads are intentionally disabled until a product flow and
// server-verifiable reward path are defined.
export async function showRewardedAdForBonus(): Promise<boolean> {
  return false;
}
