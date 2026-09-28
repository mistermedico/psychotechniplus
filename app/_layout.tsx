import { Stack, router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, I18nManager, Platform, StyleSheet, View, Text, Pressable } from 'react-native';
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
  document.body.setAttribute('dir', 'rtl');
  document.body.style.direction = 'rtl';
  document.body.style.backgroundColor = '#080A12';
  document.body.style.color = '#F0F4FF';

  const styleId = 'psychotechniplus-global-rtl';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      *, *::before, *::after {
        box-sizing: border-box;
      }

      html, body, #root {
        direction: rtl;
        min-height: 100%;
        width: 100%;
        max-width: 100%;
      }

      body {
        margin: 0;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      input:not([dir="ltr"]),
      textarea:not([dir="ltr"]),
      [contenteditable="true"]:not([dir="ltr"]) {
        direction: rtl;
      }

      [dir="ltr"] {
        direction: ltr !important;
        unicode-bidi: isolate;
      }

      ::selection {
        background: rgba(124,111,247,0.35);
        color: #fff;
      }

      :where(a, input, textarea, select, [role="button"], [role="tab"], [role="radio"]):focus-visible {
        outline: 3px solid rgba(158,153,250,0.95);
        outline-offset: 3px;
      }

      @media (pointer: fine) {
        :where(a, [role="button"], [role="tab"], [role="radio"]):not([aria-disabled="true"]) {
          cursor: pointer;
        }

        [aria-disabled="true"] {
          cursor: not-allowed;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          scroll-behavior: auto !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

SplashScreen.preventAutoHideAsync();

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View
      accessibilityRole="alert"
      style={errorStyles.root}
    >
      <View style={errorStyles.card}>
        <Text style={errorStyles.icon}>⚠️</Text>
        <Text style={errorStyles.title}>משהו השתבש</Text>
        <Text style={errorStyles.text}>
          נתקלנו בשגיאה לא צפויה. אפשר לנסות לטעון את המסך מחדש או לחזור למסך הראשי.
        </Text>
        <Pressable
          onPress={() => retry().catch(() => null)}
          accessibilityRole="button"
          accessibilityLabel="נסה לטעון מחדש"
          style={({ pressed }) => [errorStyles.primaryBtn, pressed && { opacity: 0.82 }]}
        >
          <Text style={errorStyles.primaryText}>נסה שוב</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="חזרה למסך הראשי"
          style={({ pressed }) => [errorStyles.secondaryBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={errorStyles.secondaryText}>חזרה למסך הראשי</Text>
        </Pressable>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080A12',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 22,
    padding: 24,
    backgroundColor: '#121727',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  icon: { fontSize: 36, marginBottom: 10 },
  title: {
    color: '#F0F4FF',
    fontFamily: 'Heebo_700Bold',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  text: {
    color: '#A5B2CC',
    fontFamily: 'Heebo_400Regular',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C6FF7',
    marginBottom: 10,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: 'Heebo_700Bold',
    fontSize: 16,
  },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#AFA8FF',
    fontFamily: 'Heebo_600SemiBold',
    fontSize: 14,
  },
});

export default function RootLayout() {
  const initialize = useUserStore(s => s.initialize);
  const refreshUserFromServer = useUserStore(s => s.refreshFromServer);
  const startUserRealtimeSync = useUserStore(s => s.startRealtimeSync);
  const stopUserRealtimeSync = useUserStore(s => s.stopRealtimeSync);
  const setIsAdmin = useAdminStore(s => s.setIsAdmin);
  const loadPublicData = useAdminStore(s => s.loadPublicData);
  const loadAdminData = useAdminStore(s => s.loadAdminData);
  const startRealtimeSync = useAdminStore(s => s.startRealtimeSync);
  const stopRealtimeSync = useAdminStore(s => s.stopRealtimeSync);
  const startPublicRealtimeSync = useAdminStore(s => s.startPublicRealtimeSync);
  const stopPublicRealtimeSync = useAdminStore(s => s.stopPublicRealtimeSync);
  const initializePurchases = usePurchaseStore(s => s.initialize);
  const checkPurchaseStatus = usePurchaseStore(s => s.checkStatus);
  const maintenanceMode = useAdminStore(s => s.appConfig.maintenanceMode);
  const isAdmin = useAdminStore(s => s.isAdmin);
  const pathname = usePathname();

  const [bootstrapReady, setBootstrapReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    SuezOne_400Regular,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    let cancelled = false;
    const bootstrap = async () => {
      try {
        await initialize();
        const { email, userId, isGuest } = useUserStore.getState();

        await ensureDbSeeded();
        await loadPublicData(true);
        startPublicRealtimeSync();

        if (userId && !isGuest) {
          startUserRealtimeSync();
        } else {
          stopUserRealtimeSync();
        }

        if (email.toLowerCase() === ADMIN_EMAIL) {
          setIsAdmin(true);
          await loadAdminData();
          startRealtimeSync();
        } else {
          setIsAdmin(false);
          stopRealtimeSync();
        }

        notifyFirstOpenOnce(userId, isGuest ? null : email).catch(() => null);

        // Premium entitlement affects routing/gating, so authenticated native
        // users must finish RevenueCat identification before the UI is released.
        if (userId && !isGuest) {
          await initializePurchases(userId).catch(() => null);
        } else {
          initializePurchases(undefined).catch(() => null);
        }
        initializeAds().catch(() => null);
      } finally {
        if (!cancelled) {
          setBootstrapReady(true);
          SplashScreen.hideAsync().catch(() => null);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, fontError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    stopRealtimeSync();
    stopPublicRealtimeSync();
    stopUserRealtimeSync();
  }, [stopRealtimeSync, stopPublicRealtimeSync, stopUserRealtimeSync]);

  useEffect(() => {
    if (!bootstrapReady) return;

    const allowedDuringMaintenance =
      pathname === '/maintenance' ||
      pathname === '/landing' ||
      pathname === '/auth' ||
      pathname === '/auth-callback' ||
      pathname === '/terms' ||
      pathname === '/privacy' ||
      pathname.startsWith('/admin');

    if (maintenanceMode && !isAdmin && !allowedDuringMaintenance) {
      router.replace('/maintenance');
      return;
    }

    if (!maintenanceMode && pathname === '/maintenance') {
      router.replace('/');
    }
  }, [bootstrapReady, maintenanceMode, isAdmin, pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadPublicData(true).catch(() => null);
        const { isAuthenticated, isGuest } = useUserStore.getState();
        if (isAuthenticated && !isGuest) {
          refreshUserFromServer().catch(() => null);
          checkPurchaseStatus().catch(() => null);
          startUserRealtimeSync();
        }
        startPublicRealtimeSync();
      }
    });
    return () => subscription.remove();
  }, [
    checkPurchaseStatus,
    loadPublicData,
    refreshUserFromServer,
    startPublicRealtimeSync,
    startUserRealtimeSync,
  ]);

  if ((!fontsLoaded && !fontError) || !bootstrapReady) return null;

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
