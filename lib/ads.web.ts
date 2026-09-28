export function isAdMobRuntimeSupported(): boolean {
  return false;
}

export function canShowAdsForUser(_isPremium: boolean, _isAdmin = false): boolean {
  return false;
}

export function getBannerAdUnitId(): string {
  return '';
}

export function getInterstitialAdUnitId(): string {
  return '';
}

export function getRewardedAdUnitId(): string {
  return '';
}

export async function initializeAds(): Promise<void> {
  return;
}

export async function showInterstitialAfterSession(): Promise<boolean> {
  return false;
}

export async function showRewardedAdForBonus(): Promise<boolean> {
  return false;
}
