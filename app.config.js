const appJson = require('./app.json');

const TEST_ADMOB_APP_IDS = {
  ios: 'ca-app-pub-3940256099942544~1458002511',
  android: 'ca-app-pub-3940256099942544~3347511713',
};

const requireProductionAdMobId = (platform, value) => {
  if (process.env.EAS_BUILD_PROFILE === 'production' && !value) {
    throw new Error(`Missing EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_APP_ID for production build`);
  }
};

const withEnvAdMobAppIds = (config) => {
  const iosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;
  const androidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;

  requireProductionAdMobId('ios', iosAppId);

  const plugins = config.expo.plugins.map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
      return [
        plugin[0],
        {
          ...plugin[1],
          iosAppId: iosAppId || TEST_ADMOB_APP_IDS.ios,
          androidAppId: androidAppId || TEST_ADMOB_APP_IDS.android,
        },
      ];
    }

    return plugin;
  });

  return {
    ...config,
    expo: {
      ...config.expo,
      plugins,
    },
  };
};

module.exports = ({ config }) => withEnvAdMobAppIds(appJson);
