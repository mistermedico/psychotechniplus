import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { useAdminStore, ADMIN_EMAIL } from '../store/adminStore';
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
  const [emailPending, setEmailPending] = useState(false);

  const initialize = useUserStore(s => s.initialize);
  const setIsAdmin = useAdminStore(s => s.setIsAdmin);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError('');
    setEmailPending(false);
    setPassword('');
    setConfirmPassword('');
  };

  const translateError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'מייל או סיסמה שגויים';
    if (m.includes('email not confirmed')) return 'עליך לאשר את כתובת המייל לפני הכניסה. בדוק את תיבת הדואר שלך.';
    if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already registered')) return 'כתובת מייל זו כבר רשומה — עבור להתחברות';
    if (m.includes('password should be at least')) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
    if (m.includes('unable to validate email address')) return 'כתובת מייל לא תקינה';
    if (m.includes('signup disabled')) return 'ההרשמה מושבתת זמנית';
    if (m.includes('email rate limit')) return 'יותר מדי ניסיונות — נסה שוב בעוד מספר דקות';
    return msg;
  };

  const handleSubmit = async () => {
    setError('');
    setEmailPending(false);

    if (!email.trim()) { setError('נא להזין כתובת מייל'); return; }
    if (!password) { setError('נא להזין סיסמה'); return; }

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

      if (err) {
        setError(translateError(err.message));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!data.session || !data.user) {
        setError('שגיאת התחברות — נסה שוב');
        return;
      }

      await initialize(data.user.id);
      if (data.user.email?.toLowerCase() === ADMIN_EMAIL) setIsAdmin(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { hasCompletedOnboarding } = useUserStore.getState();
      router.replace(hasCompletedOnboarding ? '/(tabs)' : '/onboarding');

    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: displayName.trim() || undefined },
        },
      });
      setLoading(false);

      if (err) {
        setError(translateError(err.message));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // No session = email confirmation required
      if (!data.session) {
        setEmailPending(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // Auto-confirmed (email confirmation disabled in Supabase)
      if (!data.user) {
        setError('שגיאת הרשמה — נסה שוב');
        return;
      }

      await initialize(data.user.id);
      if (data.user.email?.toLowerCase() === ADMIN_EMAIL) setIsAdmin(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding');
    }
  };

  // Email confirmation pending screen
  if (emailPending) {
    return (
      <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
        <View style={styles.pendingContainer}>
          <View style={styles.pendingCard}>
            <Text style={styles.pendingEmoji}>📧</Text>
            <Text style={styles.pendingTitle}>בדוק את המייל שלך</Text>
            <Text style={styles.pendingBody}>
              שלחנו לך קישור אישור ל-{'\n'}
              <Text style={styles.pendingEmail}>{email}</Text>
              {'\n\n'}לחץ על הקישור ואז חזור לכאן להתחברות.
            </Text>
            <Pressable
              onPress={() => { setEmailPending(false); setMode('login'); }}
              style={styles.pendingBtn}
            >
              <LinearGradient colors={['#6366F1', '#A855F7']} style={styles.pendingBtnGrad}>
                <Text style={styles.pendingBtnText}>עבור להתחברות ←</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setEmailPending(false)} style={styles.pendingBack}>
              <Text style={styles.pendingBackText}>שלח שוב / שנה מייל</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🧠</Text>
            <LinearGradient
              colors={['#818CF8', '#C4B5FD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoTitleGrad}
            >
              <Text style={styles.logoTitle}>PsychoTechniPlus</Text>
            </LinearGradient>
            <Text style={styles.logoSub}>הכנה חכמה למבחנים פסיכוטכניים ופסיכומטריים</Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
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
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  textAlign="right"
                  autoCorrect={false}
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                  returnKeyType="next"
                />
              )}
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={v => { setEmail(v); setError(''); }}
                placeholder="כתובת מייל"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textAlign="right"
                textContentType="emailAddress"
                autoComplete="email"
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={v => { setPassword(v); setError(''); }}
                placeholder="סיסמה (מינימום 6 תווים)"
                placeholderTextColor="rgba(255,255,255,0.35)"
                secureTextEntry
                textAlign="right"
                onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                returnKeyType={mode === 'login' ? 'go' : 'next'}
              />
              {mode === 'register' && (
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={v => { setConfirmPassword(v); setError(''); }}
                  placeholder="אימות סיסמה"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  secureTextEntry
                  textAlign="right"
                  onSubmitEditing={handleSubmit}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="go"
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
                <LinearGradient colors={['#6366F1', '#A855F7']} style={styles.submitGrad}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitText}>{mode === 'login' ? 'כניסה ←' : 'יצירת חשבון ←'}</Text>
                  }
                </LinearGradient>
              </Pressable>

              <Text style={styles.hint}>
                {mode === 'login'
                  ? 'אין לך חשבון? לחץ על "הרשמה" למעלה'
                  : 'יש לך חשבון? לחץ על "התחברות" למעלה'
                }
              </Text>
            </View>

            {/* Legal links */}
            <View style={styles.legalRow}>
              <Text style={styles.legalIntro}>בהרשמה אתה מסכים ל</Text>
              <Pressable onPress={() => router.push('/terms')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.legalLink}>תנאי שימוש</Text>
              </Pressable>
              <Text style={styles.legalSep}> ו</Text>
              <Pressable onPress={() => router.push('/privacy')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.legalLink}>מדיניות פרטיות</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  content: { padding: 24, paddingTop: 64, paddingBottom: 60 },

  logo: { alignItems: 'center', marginBottom: 36 },
  logoEmoji: { fontSize: 72, marginBottom: 14 },
  logoTitleGrad: {
    borderRadius: 8,
    marginBottom: 8,
  },
  logoTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: '#fff',
    paddingHorizontal: 2,
  },
  logoSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },

  tabs: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.xl,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: Radius.lg, minHeight: 44 },
  tabActive: {
    backgroundColor: 'rgba(99,102,241,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.5)',
  },
  tabText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: 'rgba(255,255,255,0.35)' },
  tabTextActive: { color: '#F1F5F9' },

  form: { gap: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#F1F5F9',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  errorBox: {
    backgroundColor: Colors.danger + '20',
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.danger, textAlign: 'right' },

  submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  submitGrad: { paddingVertical: 18, alignItems: 'center', borderRadius: 14 },
  submitText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  hint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 4 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', gap: 2 },
  legalIntro: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)' },
  legalLink: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#818CF8', textDecorationLine: 'underline' },
  legalSep: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)' },

  // Email pending state
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  pendingCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  pendingEmoji: { fontSize: 72, marginBottom: 20 },
  pendingTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#F1F5F9', marginBottom: 16, textAlign: 'center' },
  pendingBody: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 26, marginBottom: 32 },
  pendingEmail: { fontFamily: FontFamily.bold, color: '#818CF8' },
  pendingBtn: { width: '100%', borderRadius: Radius.xl, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8, marginBottom: 16 },
  pendingBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  pendingBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
  pendingBack: { padding: 12 },
  pendingBackText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.35)' },
});
