import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/theme';
import { finishOAuthCallback } from '../lib/oauth';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { ADMIN_EMAIL, useAdminStore } from '../store/adminStore';

export default function AuthCallbackScreen() {
  const [message, setMessage] = useState('מסיים התחברות...');
  const initialize = useUserStore(s => s.initialize);
  const setIsAdmin = useAdminStore(s => s.setIsAdmin);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) throw new Error('לא התקבלה כתובת חזרה מההתחברות');
        await finishOAuthCallback(url);
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user?.id) throw new Error('לא נמצא משתמש מחובר');
        await initialize(user.id);
        if (user.email?.toLowerCase() === ADMIN_EMAIL) setIsAdmin(true);
        const { hasCompletedOnboarding } = useUserStore.getState();
        router.replace(hasCompletedOnboarding ? '/(tabs)' : '/onboarding');
      } catch (err: any) {
        if (!mounted) return;
        setMessage(err?.message ?? 'לא ניתן להשלים התחברות');
        setTimeout(() => router.replace('/auth'), 1800);
      }
    };
    run();
    return () => { mounted = false; };
  }, [initialize, setIsAdmin]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.primary} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: Colors.background,
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
