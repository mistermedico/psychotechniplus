import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { I18nManager, Platform, StyleSheet } from 'react-native';
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
import ScreenGuide from '../components/ScreenGuide';

// Force RTL for Hebrew
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
      }

      input, textarea, [contenteditable="true"] {
        direction: rtl !important;
        text-align: right !important;
      }

      [data-testid], [role="button"], [role="link"] {
        direction: rtl;
      }

      [class*="css-text"] {
        text-align: right;
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
  const loadQuestionsFromSupabase = useAdminStore(s => s.loadQuestionsFromSupabase);
  const initializePurchases = usePurchaseStore(s => s.initialize);

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
        const { email, userId } = useUserStore.getState();
        // Ensure targets+topics exist in Supabase for all users (FK prerequisite)
        ensureDbSeeded().then(() => {
          if (email.toLowerCase() === ADMIN_EMAIL) {
            setIsAdmin(true);
            loadAdminData();
          } else {
            loadQuestionsFromSupabase();
          }
        });
        // Initialize RevenueCat and restore premium status (no-op in dev)
        if (userId) {
          initializePurchases(userId).catch(() => null);
        }
      });
    }
  }, [fontsLoaded, fontError]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="landing" options={{ animation: 'fade' }} />
          <Stack.Screen name="auth" options={{ animation: 'slide_from_bottom' }} />
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
          <Stack.Screen name="terms" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="privacy" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="maintenance" />
        </Stack>
        <ScreenGuide />
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
