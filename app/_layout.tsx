import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
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

// Force RTL for Hebrew
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
  if (Platform.OS !== 'web') {
    // Reload needed on device; on Expo Go it applies immediately
  }
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useUserStore(s => s.initialize);

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
      initialize(); // stable zustand action reference, safe to omit from deps
    }
  }, [fontsLoaded, fontError]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
