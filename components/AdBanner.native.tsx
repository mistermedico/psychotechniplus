import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';
import { getBannerAdUnitId, isAdMobRuntimeSupported } from '../lib/ads';
import { logger } from '../utils/logger';

interface AdBannerProps {
  isPremium: boolean;
  isAdmin?: boolean;
  placement?: 'practice' | 'profile' | 'session' | 'tabs';
}

export function AdBanner({ isPremium, isAdmin = false, placement = 'practice' }: AdBannerProps) {
  const adUnitId = useMemo(() => getBannerAdUnitId(), []);

  if (isPremium || isAdmin || !isAdMobRuntimeSupported()) return null;

  if (!adUnitId) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad will load here</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        placement === 'session' && styles.sessionContainer,
        placement === 'tabs' && styles.tabsContainer,
      ]}
    >
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) => {
          logger.warn('ads', `Banner failed to load (${placement}): ${error.message}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 56,
    overflow: 'hidden',
  },
  sessionContainer: {
    marginTop: 10,
    marginBottom: 4,
  },
  tabsContainer: {
    marginHorizontal: 0,
    marginTop: 0,
    minHeight: 50,
    backgroundColor: 'rgba(8,10,18,0.96)',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  placeholderText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
