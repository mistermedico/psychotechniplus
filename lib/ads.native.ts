import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { logger } from '../utils/logger';

const TEST_BANNER_IDS = {
  ios: 'ca-app-pub-3940256099942544/2934735716',
  android: 'ca-app-pub-3940256099942544/6300978111',
};
const TEST_INTERSTITIAL_IDS = {
  ios: 'ca-app-pub-3940256099942544/4411468910',
  android: 'ca-app-pub-3940256099942544/1033173712',
};
const TEST_REWARDED_IDS = {
  ios: 'ca-app-pub-3940256099942544/1712485313',
  android: 'ca-app-pub-3940256099942544/5224354917',
};

const ADMOB_ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED !== 'false';
const ALLOW_TEST_ADS = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_ALLOW_TEST_ADS === 'true';

export function isAdMobRuntimeSupported(): boolean {
  return ADMOB_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android');
}

export function canShowAdsForUser(isPremium: boolean, isAdmin = false): boolean {
  return !isPremium && !isAdmin && isAdMobRuntimeSupported();
}

export function getBannerAdUnitId(): string {
  const configured = Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID,
  });
  if (configured) return configured;
  if (ALLOW_TEST_ADS) return Platform.select(TEST_BANNER_IDS) || TEST_BANNER_IDS.ios;
  return '';
}

export function getInterstitialAdUnitId(): string {
  const configured = Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_AD_UNIT_ID,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_AD_UNIT_ID,
  });
  if (configured) return configured;
  if (ALLOW_TEST_ADS) return Platform.select(TEST_INTERSTITIAL_IDS) || TEST_INTERSTITIAL_IDS.ios;
  return '';
}

export function getRewardedAdUnitId(): string {
  const configured = Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID,
  });
  if (configured) return configured;
  if (ALLOW_TEST_ADS) return Platform.select(TEST_REWARDED_IDS) || TEST_REWARDED_IDS.ios;
  return '';
}

let initialized = false;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let interstitialLoading = false;
let cleanupInterstitialListeners: (() => void) | null = null;
let rewarded: RewardedAd | null = null;
let rewardedLoaded = false;
let rewardedLoading = false;
let cleanupRewardedListeners: (() => void) | null = null;

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

function prepareRewarded(): void {
  if (!isAdMobRuntimeSupported()) return;
  const unitId = getRewardedAdUnitId();
  if (!unitId || rewardedLoaded || rewardedLoading) return;

  cleanupRewardedListeners?.();
  rewardedLoading = true;
  rewarded = RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    rewardedLoading = false;
  });
  const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
    rewardedLoaded = false;
    rewardedLoading = false;
    prepareRewarded();
  });
  const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, error => {
    rewardedLoaded = false;
    rewardedLoading = false;
    logger.warn('ads', `Rewarded failed: ${error.message}`);
  });

  cleanupRewardedListeners = () => {
    unsubscribeLoaded();
    unsubscribeClosed();
    unsubscribeError();
    cleanupRewardedListeners = null;
  };
  rewarded.load();
}

export async function initializeAds(): Promise<void> {
  if (!isAdMobRuntimeSupported() || initialized) return;
  try {
    await mobileAds().initialize();
    initialized = true;
    prepareInterstitial();
    prepareRewarded();
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

export async function showRewardedAdForBonus(): Promise<boolean> {
  if (!isAdMobRuntimeSupported()) return false;
  if (!initialized) await initializeAds();
  if (!rewardedLoaded || !rewarded) {
    prepareRewarded();
    return false;
  }

  const ad = rewarded;
  rewardedLoaded = false;
  return new Promise(resolve => {
    let earned = false;
    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, error => {
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      logger.warn('ads', `Rewarded show failed: ${error.message}`);
      prepareRewarded();
      resolve(false);
    });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      prepareRewarded();
      resolve(earned);
    });
    ad.show().catch(error => {
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      logger.warn('ads', `Rewarded show failed: ${error?.message ?? String(error)}`);
      prepareRewarded();
      resolve(false);
    });
  });
}
