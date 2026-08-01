import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, I18nManager, Platform, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
} from '@expo-google-fonts/heebo';
import { SuezOne_400Regular } from '@expo-google-fonts/suez-one';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUserStore } from '../store/userStore';
import { useAdminStore, ADMIN_EMAIL } from '../store/adminStore';
import { usePurchaseStore } from '../store/purchaseStore';
import { ensureDbSeeded } from '../lib/db';
import { notifyFirstOpenOnce } from '../lib/adminEmail';
import { initializeAds } from '../lib/ads';

// Force RTL for Hebrew
I18nManager.allowRTL(true);
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
  if (Platform.OS !== 'web') {
    // Reload needed on device; on Expo Go it applies immediately
  }
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.style.direction = 'rtl';
  document.documentElement.style.backgroundColor = '#080A12';
  document.documentElement.style.textAlign = 'right';
  document.body.setAttribute('dir', 'rtl');
  document.body.style.direction = 'rtl';
  document.body.style.textAlign = 'right';
  document.body.style.backgroundColor = '#080A12';
  document.body.style.color = '#F0F4FF';

  const styleId = 'psychotechniplus-global-rtl';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body, #root {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext !important;
      }

      #root, #root * {
        direction: rtl !important;
        unicode-bidi: plaintext !important;
      }

      input, textarea, [contenteditable="true"] {
        direction: rtl !important;
        text-align: right !important;
      }

      [dir="ltr"], [style*="direction: ltr"], [style*="text-align: left"] {
        direction: rtl !important;
        text-align: right !important;
      }

      button, a, [data-testid], [role="button"], [role="link"] {
        direction: rtl !important;
        text-align: right !important;
      }

      button *, a *, [role="button"] *, [role="link"] * {
        direction: rtl !important;
        text-align: right !important;
      }

      [class*="css-text"], [class*="r-"], div, span, p, h1, h2, h3, h4, h5, h6 {
        text-align: right !important;
        direction: rtl !important;
      }

      svg text {
        direction: rtl !important;
        unicode-bidi: bidi-override !important;
      }
    `;
    document.head.appendChild(style);
  }
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useUserStore(s => s.initialize);
  const setIsAdmin = useAdminStore(s => s.setIsAdmin);
  const loadAdminData = useAdminStore(s => s.loadAdminData);
  const startRealtimeSync = useAdminStore(s => s.startRealtimeSync);
  const stopRealtimeSync = useAdminStore(s => s.stopRealtimeSync);
  const initializePurchases = usePurchaseStore(s => s.initialize);
  const checkPurchaseStatus = usePurchaseStore(s => s.checkStatus);

  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    SuezOne_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      initialize().then(() => {
        const { email, userId, isGuest } = useUserStore.getState();
        notifyFirstOpenOnce(userId, isGuest ? null : email).catch(() => null);
        // Ensure targets+topics exist in Supabase for all users (FK prerequisite)
        ensureDbSeeded().then(() => {
          if (email.toLowerCase() === ADMIN_EMAIL) {
            setIsAdmin(true);
            loadAdminData();
            startRealtimeSync();
          } else {
            setIsAdmin(false);
            stopRealtimeSync();
          }
        });
        // Guests receive an anonymous RevenueCat ID so StoreKit prices and purchase restoration work before sign-in.
        initializePurchases(userId && !isGuest ? userId : undefined).catch(() => null);
        initializeAds().catch(() => null);
      });
    }
  }, [fontsLoaded, fontError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    stopRealtimeSync();
  }, [stopRealtimeSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        const { isAuthenticated, isGuest } = useUserStore.getState();
        if (isAuthenticated && !isGuest) {
          checkPurchaseStatus().catch(() => null);
        }
      }
    });
    return () => subscription.remove();
  }, [checkPurchaseStatus]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="landing" options={{ animation: 'fade' }} />
          <Stack.Screen name="auth" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="auth-callback" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="practice-session"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen
            name="results"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen name="paywall" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="support" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="terms" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="privacy" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="maintenance" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080A12',
    writingDirection: 'rtl',
  },
});
