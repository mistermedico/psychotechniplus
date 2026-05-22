import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView, Animated, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { useAdminStore, ADMIN_EMAIL } from '../store/adminStore';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [emailPending, setEmailPending] = useState(false);

  const initialize = useUserStore(s => s.initialize);
  const setIsAdmin = useAdminStore(s => s.setIsAdmin);

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();
  }, []);

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

      if (!data.session) {
        setEmailPending(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

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

  if (emailPending) {
    return (
      <LinearGradient colors={['#080A12', '#0D1020', '#14102A']} style={{ flex: 1 }}>
        <SafeAreaView style={styles.pendingContainer} edges={['top', 'bottom']}>
          <Animated.View style={[styles.pendingCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <View style={styles.pendingGlow} />
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
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.pendingBtnGrad}
              >
                <Text style={styles.pendingBtnText}>עבור להתחברות ←</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={async () => {
                setResending(true);
                try {
                  await supabase.auth.resend({ type: 'signup', email });
                  Alert.alert('נשלח!', 'בדוק את תיבת הדואר שלך שוב.');
                } catch {
                  // fall back: let user change email
                  setEmailPending(false);
                  setMode('register');
                } finally {
                  setResending(false);
                }
              }}
              disabled={resending}
              accessibilityRole="button"
              accessibilityLabel="שלח שוב או שנה מייל"
              style={styles.pendingBack}
            >
              <Text style={styles.pendingBackText}>{resending ? 'שולח...' : 'שלח שוב / שנה מייל'}</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#080A12', '#0D1020', '#14102A']}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient orbs */}
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <Animated.View style={[styles.logoSection, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
              <View style={styles.logoOrb}>
                <LinearGradient
                  colors={[Colors.primary, Colors.accent]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.logoGrad}
                >
                  <Text style={styles.logoEmoji}>🧠</Text>
                </LinearGradient>
              </View>
              <Text style={styles.appName}>פסיכוטכניPlus</Text>
              <Text style={styles.logoSub}>הכנה חכמה למבחן הפסיכוטכני</Text>
            </Animated.View>

            {/* Form Card */}
            <Animated.View style={[styles.formCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
              <View style={styles.cardGlow} />

              {/* Mode tabs */}
              <View style={styles.tabs}>
                {(['login', 'register'] as AuthMode[]).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    style={[styles.tab, mode === m && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}
                    accessibilityLabel={m === 'login' ? 'התחברות' : 'הרשמה'}
                  >
                    {mode === m && (
                      <LinearGradient
                        colors={[Colors.primaryLighter, 'rgba(124,111,247,0.08)']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                      {m === 'login' ? 'התחברות' : 'הרשמה'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Inputs */}
              <View style={styles.form}>
                {mode === 'register' && (
                  <TextInput
                    ref={nameRef}
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="שם מלא (אופציונלי)"
                    placeholderTextColor={Colors.textTertiary}
                    textAlign="right"
                    autoCorrect={false}
                    autoCapitalize="words"
                    textContentType="name"
                    autoComplete="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    accessibilityLabel="שם מלא"
                  />
                )}
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                  placeholder="כתובת מייל"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="right"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="כתובת מייל"
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={v => { setPassword(v); setError(''); }}
                  placeholder="סיסמה (מינימום 6 תווים)"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                  textAlign="right"
                  onSubmitEditing={mode === 'login' ? handleSubmit : () => confirmRef.current?.focus()}
                  textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  returnKeyType={mode === 'login' ? 'go' : 'next'}
                  accessibilityLabel="סיסמה"
                />
                {mode === 'register' && (
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); setError(''); }}
                    placeholder="אימות סיסמה"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry
                    textAlign="right"
                    onSubmitEditing={handleSubmit}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    returnKeyType="go"
                    accessibilityLabel="אימות סיסמה"
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
                  accessibilityRole="button"
                  accessibilityLabel={mode === 'login' ? 'כניסה לחשבון' : 'יצירת חשבון'}
                  accessibilityState={{ disabled: loading }}
                  style={({ pressed }) => [styles.submitBtn, { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: loading ? 0.85 : 1 }]}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.submitGrad}
                  >
                    <View style={styles.submitShimmer} />
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.submitText}>{mode === 'login' ? 'כניסה ←' : 'יצירת חשבון ←'}</Text>
                    }
                  </LinearGradient>
                </Pressable>

                <Text style={styles.hint}>
                  {mode === 'login'
                    ? 'אין לך חשבון? לחץ על "הרשמה" למעלה'
                    : 'יש לך חשבון? לחץ על "התחברות" למעלה'}
                </Text>
              </View>

              {/* Legal */}
              <View style={styles.legalRow}>
                <Text style={styles.legalText}>בהרשמה אתה מסכים ל</Text>
                <Pressable onPress={() => router.push('/terms')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.legalLink}>תנאי שימוש</Text>
                </Pressable>
                <Text style={styles.legalText}> ו</Text>
                <Pressable onPress={() => router.push('/privacy')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.legalLink}>מדיניות פרטיות</Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  // Orbs
  orb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.10,
    pointerEvents: 'none',
  },
  orbTop: {
    top: -60, right: -50,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
  },
  orbBottom: {
    bottom: 80, left: -80,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
  },

  // Logo
  logoSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 32 },
  logoOrb: {
    marginBottom: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  logoGrad: {
    width: 80, height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 40 },
  appName: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  logoSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Card
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.22)',
    borderRadius: Radius['3xl'],
    padding: 22,
    overflow: 'hidden',
    shadowColor: '#7C6FF7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,111,247,0.03)',
  },

  // Tabs
  tabs: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.xl,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radius.lg,
    minHeight: 44,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    borderColor: 'rgba(124,111,247,0.40)',
  },
  tabText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.semiBold,
  },

  // Form
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
    marginTop: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 14,
  },
  submitGrad: {
    paddingVertical: 17,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  submitShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  submitText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
    letterSpacing: 0.3,
  },

  hint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Legal
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
  legalText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  legalLink: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    textDecorationLine: 'underline',
  },

  // Email pending
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  pendingCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(124,111,247,0.22)',
    borderRadius: Radius['3xl'],
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.30,
    shadowRadius: 32,
    elevation: 16,
  },
  pendingGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,111,247,0.04)',
  },
  pendingEmoji: { fontSize: 68, marginBottom: 18 },
  pendingTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    marginBottom: 14,
    textAlign: 'center',
  },
  pendingBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 28,
  },
  pendingEmail: { fontFamily: FontFamily.bold, color: Colors.primaryLight },
  pendingBtn: {
    width: '100%',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.50,
    shadowRadius: 16,
    elevation: 10,
  },
  pendingBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  pendingBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
  pendingBack: { padding: 12 },
  pendingBackText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textTertiary },
});
