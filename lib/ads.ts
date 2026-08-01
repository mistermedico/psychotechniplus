import { Platform } from 'react-native';

const TEST_BANNER_IDS = {
  ios: 'ca-app-pub-3940256099942544/2934735716',
  android: 'ca-app-pub-3940256099942544/6300978111',
};

const ADMOB_ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED !== 'false';

export function isAdMobRuntimeSupported(): boolean {
  return ADMOB_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android');
}

export function getBannerAdUnitId(): string {
  const configured = Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID,
  });
  return configured || Platform.select(TEST_BANNER_IDS) || TEST_BANNER_IDS.ios;
}

export async function initializeAds(): Promise<void> {
  return;
}
