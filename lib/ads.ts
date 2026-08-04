import { Platform } from 'react-native';

const TEST_BANNER_IDS = {
  ios: 'ca-app-pub-3940256099942544/2934735716',
  android: 'ca-app-pub-3940256099942544/6300978111',
};

const TEST_INTERSTITIAL_IDS = {
  ios: 'ca-app-pub-3940256099942544/4411468910',
  android: 'ca-app-pub-3940256099942544/1033173712',
};

const ADMOB_ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED !== 'false';
const ALLOW_TEST_ADS = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_ALLOW_TEST_ADS === 'true';

export function isAdMobRuntimeSupported(): boolean {
  return ADMOB_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android');
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

export async function initializeAds(): Promise<void> {
  return;
}

export async function showInterstitialAfterSession(): Promise<boolean> {
  return false;
}
