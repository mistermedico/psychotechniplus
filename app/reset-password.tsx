import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Haptics from '../utils/haptics';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

const MIN_PASSWORD_LENGTH = 6; // same rule as registration in auth.tsx

type Phase = 'verifying' | 'ready' | 'saving' | 'done' | 'invalid';

function readParam(url: string | null | undefined, key: string): string | null {
  if (!url) return null;
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const parts = [
    queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined) : '',
    hashIndex >= 0 ? url.slice(hashIndex + 1) : '',
  ].filter(Boolean);
  for (const part of parts) {
    const value = new URLSearchParams(part).get(key);
    if (value) return value;
  }
  return null;
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('password should be at least')) return `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
  if (m.includes('same') && m.includes('password')) return 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הקודמת';
  if (m.includes('expired') || m.includes('invalid')) return 'הקישור לאיפוס הסיסמה פג תוקף או אינו תקין. בקש קישור חדש.';
  return msg;
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [phase, setPhase] = useState<Phase>('verifying');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const confirmRef = useRef<TextInput>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    let mounted = true;

    const verify = async () => {
      try {
        const url = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.href
          : await Linking.getInitialURL();

        const linkError = readParam(url, 'error_description') ?? params.error_description ?? readParam(url, 'error');
        if (linkError) throw new Error(decodeURIComponent(String(linkError).replace(/\+/g, ' ')));

        const code = readParam(url, 'code') ?? (typeof params.code === 'string' ? params.code : null);
        const accessToken = readParam(url, 'access_token');
        const refreshToken = readParam(url, 'refresh_token');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // The code may already have been exchanged (e.g. page refresh) — accept an existing session.
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw exchangeError;
          }
        } else if (accessToken && refreshToken) {
          // Implicit-flow recovery link (#access_token=...&type=recovery).
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          throw new Error('הקישור לאיפוס הסיסמה אינו תקין או שפג תוקפו. בקש קישור חדש ממסך ההתחברות.');
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined' && (code || accessToken)) {
          window.history.replaceState({}, document.title, '/reset-password');
        }
        if (mounted) setPhase('ready');
      } catch (err: any) {
        if (!mounted) return;
        setError(translateError(err?.message ?? 'לא ניתן לאמת את קישור האיפוס.'));
        setPhase('invalid');
      }
    };

    verify();
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setPhase('saving');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(translateError(updateError.message));
      setPhase('ready');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('done');
  };

  return (
    <LinearGradient colors={['#080A12', '#0D1020', '#14102A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.emoji}>{phase === 'done' ? '✅' : phase === 'invalid' ? '⚠️' : '🔐'}</Text>
              <Text style={styles.title}>
                {phase === 'done' ? 'הסיסמה עודכנה' : phase === 'invalid' ? 'הקישור אינו תקין' : 'איפוס סיסמה'}
              </Text>

              {phase === 'verifying' && (
                <View style={styles.center}>
                  <ActivityIndicator color={Colors.primary} size="large" />
                  <Text style={styles.body}>מאמת את קישור האיפוס...</Text>
                </View>
              )}

              {(phase === 'ready' || phase === 'saving') && (
                <View style={styles.form}>
                  <Text style={styles.body}>בחר סיסמה חדשה לחשבון שלך.</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={v => { setPassword(v); setError(''); }}
                    placeholder={`סיסמה חדשה (מינימום ${MIN_PASSWORD_LENGTH} תווים)`}
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry
                    textAlign="right"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    accessibilityLabel="סיסמה חדשה"
                  />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); setError(''); }}
                    placeholder="אימות סיסמה חדשה"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry
                    textAlign="right"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    returnKeyType="go"
                    onSubmitEditing={handleSave}
                    accessibilityLabel="אימות סיסמה חדשה"
                  />
                </View>
              )}

              {phase === 'done' && (
                <Text style={styles.body}>הסיסמה החדשה נשמרה בהצלחה. אפשר להמשיך לאפליקציה.</Text>
              )}

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              {(phase === 'ready' || phase === 'saving') && (
                <Pressable
                  onPress={handleSave}
                  disabled={phase === 'saving'}
                  accessibilityRole="button"
                  accessibilityLabel="שמירת סיסמה חדשה"
                  accessibilityState={{ disabled: phase === 'saving' }}
                  style={({ pressed }) => [styles.submitBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.submitGrad}
                  >
                    {phase === 'saving'
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.submitText}>שמירת סיסמה ←</Text>}
                  </LinearGradient>
                </Pressable>
              )}

              {phase === 'done' && (
                <Pressable
                  onPress={() => router.replace('/')}
                  accessibilityRole="button"
                  accessibilityLabel="המשך לאפליקציה"
                  style={({ pressed }) => [styles.submitBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.submitGrad}
                  >
                    <Text style={styles.submitText}>המשך לאפליקציה ←</Text>
                  </LinearGradient>
                </Pressable>
              )}

              {phase === 'invalid' && (
                <Pressable
                  onPress={() => router.replace({ pathname: '/auth', params: { mode: 'login' } })}
                  accessibilityRole="button"
                  accessibilityLabel="חזרה למסך ההתחברות"
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryText}>חזרה להתחברות</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.22)',
    borderRadius: Radius['3xl'],
    padding: 24,
    gap: 14,
  },
  center: { alignItems: 'center', gap: 12 },
  emoji: { fontSize: 52, textAlign: 'center' },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    writingDirection: 'rtl',
  },
  form: { gap: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 52,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dangerGlow,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'right',
  },
  submitBtn: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitGrad: {
    paddingVertical: 17,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
  },
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
});
