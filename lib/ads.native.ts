import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
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
const INTERSTITIAL_STATE_KEY = '@psychotechniplus/ads/interstitialState';
const INTERSTITIAL_MIN_INTERVAL_MS = 1000 * 60 * 3;
const INTERSTITIAL_EVERY_COMPLETED_SESSIONS = 2;

let initialized = false;

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

export async function initializeAds(): Promise<void> {
  if (initialized || !isAdMobRuntimeSupported()) return;

  try {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      testDeviceIdentifiers: ['EMULATOR'],
    });
    await mobileAds().initialize();
    initialized = true;
    logger.info('ads', 'AdMob initialized');
  } catch (error: any) {
    logger.warn('ads', `AdMob initialization skipped: ${error?.message ?? 'unknown error'}`);
  }
}

async function shouldShowSessionInterstitial(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(INTERSTITIAL_STATE_KEY).catch(() => null);
  let state: { completedSessions?: number; lastShownAt?: number } = {};
  try {
    state = raw ? JSON.parse(raw) : {};
  } catch {
    state = {};
  }
  const completedSessions = (state.completedSessions ?? 0) + 1;
  const lastShownAt = state.lastShownAt ?? 0;
  const now = Date.now();
  const dueByCount = completedSessions % INTERSTITIAL_EVERY_COMPLETED_SESSIONS === 0;
  const dueByTime = now - lastShownAt >= INTERSTITIAL_MIN_INTERVAL_MS;

  await AsyncStorage.setItem(
    INTERSTITIAL_STATE_KEY,
    JSON.stringify({
      completedSessions,
      lastShownAt: dueByCount && dueByTime ? now : lastShownAt,
    }),
  ).catch(() => null);

  return dueByCount && dueByTime;
}

export async function showInterstitialAfterSession(): Promise<boolean> {
  if (!isAdMobRuntimeSupported()) return false;
  const adUnitId = getInterstitialAdUnitId();
  if (!adUnitId) return false;
  if (!(await shouldShowSessionInterstitial().catch(() => false))) return false;

  await initializeAds();

  return new Promise(resolve => {
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    let settled = false;
    let loaded = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeLoaded();
      unsubscribeError();
      unsubscribeClosed();
      resolve(value);
    };

    const timeout = setTimeout(() => {
      logger.warn('ads', 'Interstitial timed out before loading');
      settle(false);
    }, 7000);

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, async () => {
      loaded = true;
      clearTimeout(timeout);
      try {
        await interstitial.show();
      } catch (error: any) {
        logger.warn('ads', `Interstitial failed to show: ${error?.message ?? 'unknown error'}`);
        settle(false);
      }
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, error => {
      clearTimeout(timeout);
      logger.warn('ads', `Interstitial failed to load: ${error.message}`);
      settle(false);
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      clearTimeout(timeout);
      settle(loaded);
    });

    interstitial.load();
  });
}

export async function showRewardedAdForBonus(): Promise<boolean> {
  if (!isAdMobRuntimeSupported()) return false;
  const adUnitId = getRewardedAdUnitId();
  if (!adUnitId) return false;

  await initializeAds();

  return new Promise(resolve => {
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    let settled = false;
    let earnedReward = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeLoaded();
      unsubscribeError();
      unsubscribeClosed();
      unsubscribeEarned();
      resolve(value);
    };

    const timeout = setTimeout(() => {
      logger.warn('ads', 'Rewarded ad timed out before loading');
      settle(false);
    }, 8000);

    const unsubscribeLoaded = rewarded.addAdEventListener(AdEventType.LOADED, async () => {
      clearTimeout(timeout);
      try {
        await rewarded.show();
      } catch (error: any) {
        logger.warn('ads', `Rewarded ad failed to show: ${error?.message ?? 'unknown error'}`);
        settle(false);
      }
    });

    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, error => {
      clearTimeout(timeout);
      logger.warn('ads', `Rewarded ad failed to load: ${error.message}`);
      settle(false);
    });

    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedReward = true;
    });

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      clearTimeout(timeout);
      settle(earnedReward);
    });

    rewarded.load();
  });
}
