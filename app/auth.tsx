import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initialize = useUserStore(s => s.initialize);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) { setError('נא למלא מייל וסיסמה'); return; }

    if (mode === 'register') {
      if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
      if (password !== confirmPassword) { setError('הסיסמאות אינן תואמות'); return; }
    }

    setLoading(true);

    if (mode === 'login') {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      setLoading(false);
      if (err || !data.user) {
        setError('מייל או סיסמה שגויים');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await initialize(data.user.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { hasCompletedOnboarding } = useUserStore.getState();
      router.replace(hasCompletedOnboarding ? '/(tabs)' : '/onboarding');
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { display_name: displayName.trim() || undefined } },
      });
      setLoading(false);
      if (err || !data.user) {
        const msg = err?.message ?? '';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
          setError('מייל זה כבר רשום — נסה להתחבר');
        } else {
          setError(msg || 'שגיאת הרשמה');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await initialize(data.user.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🧠</Text>
            <Text style={styles.logoTitle}>PsychoTechniPlus</Text>
            <Text style={styles.logoSub}>הכנה חכמה למבחנים פסיכוטכניים ופסיכומטריים</Text>
          </View>

          {/* Mode tabs */}
          <View style={styles.tabs}>
            <Pressable
              onPress={() => switchMode('login')}
              style={[styles.tab, mode === 'login' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>התחברות</Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('register')}
              style={[styles.tab, mode === 'register' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>הרשמה</Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'register' && (
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="שם מלא (אופציונלי)"
                placeholderTextColor="#475569"
                textAlign="right"
                autoCorrect={false}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={v => { setEmail(v); setError(''); }}
              placeholder="כתובת מייל"
              placeholderTextColor="#475569"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={v => { setPassword(v); setError(''); }}
              placeholder="סיסמה (מינימום 6 תווים)"
              placeholderTextColor="#475569"
              secureTextEntry
              textAlign="right"
              onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
            />
            {mode === 'register' && (
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setError(''); }}
                placeholder="אימות סיסמה"
                placeholderTextColor="#475569"
                secureTextEntry
                textAlign="right"
                onSubmitEditing={handleSubmit}
              />
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, (pressed || loading) && { opacity: 0.85 }]}
            >
              <LinearGradient colors={Colors.gradients.primary} style={styles.submitGrad}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitText}>{mode === 'login' ? 'כניסה ←' : 'יצירת חשבון ←'}</Text>
                }
              </LinearGradient>
            </Pressable>

            <Text style={styles.hint}>
              {mode === 'login'
                ? 'אין לך חשבון? עבור ל"הרשמה" למעלה'
                : 'כבר יש לך חשבון? עבור ל"התחברות" למעלה'
              }
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  content: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 60,
  },

  logo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoEmoji: { fontSize: 72, marginBottom: 14 },
  logoTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    marginBottom: 8,
  },
  logoSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },

  tabs: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.xl,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: '#64748B',
  },
  tabTextActive: { color: '#fff' },

  form: { gap: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },

  errorBox: {
    backgroundColor: Colors.danger + '20',
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.danger + '50',
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
    ...Shadow.primary,
  },
  submitGrad: { paddingVertical: 18, alignItems: 'center' },
  submitText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
  },

  hint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
  },
});
