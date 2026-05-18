import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, ADMIN_EMAIL } from '../../store/adminStore';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const ADMIN_SECTIONS = [
  { id: 'questions',           icon: '📋', label: 'מאגר שאלות',      desc: 'CRUD, סינון, חיפוש, bulk actions',        color: Colors.primary,  gradient: Colors.gradients.primary,                          route: '/admin/questions' },
  { id: 'validate',            icon: '✅', label: 'תור ולידציה',      desc: 'אישור/דחיית שאלות ממתינות',               color: Colors.success,  gradient: Colors.gradients.success,                          route: '/admin/validate' },
  { id: 'json-import',         icon: '📥', label: 'ייבוא JSON',        desc: 'העלאת שאלות מקובץ JSON',                   color: '#F59E0B',       gradient: Colors.gradients.gold,                             route: '/admin/json-import' },
  { id: 'ai-generator',        icon: '🤖', label: 'מחולל AI',          desc: 'יצירת שאלות חדשות עם AI',                  color: Colors.accent,   gradient: ['#8B5CF6', '#6D28D9'] as [string, string],        route: '/admin/ai-generator' },
  { id: 'simulation-builder',  icon: '🏗️', label: 'בניית סימולציה',   desc: 'תבניות מבחן חכמות עם כללים',              color: Colors.warning,  gradient: Colors.gradients.gold,                             route: '/admin/simulation-builder' },
  { id: 'analytics',           icon: '📊', label: 'אנליטיקס',          desc: 'גרפים, התפלגויות, מגמות',                  color: '#0EA5E9',       gradient: ['#0EA5E9', '#0284C7'] as [string, string],        route: '/admin/analytics' },
  { id: 'session-settings', icon: '🎛️', label: 'הגדרות סשן', desc: 'תרגול, מבחנים, פרמיום, זמנים', color: '#8B5CF6', gradient: ['#8B5CF6', '#6D28D9'] as [string, string], route: '/admin/session-settings' },
  { id: 'topics-admin',        icon: '📚', label: 'ניהול נושאים',      desc: 'הוספה, עריכה, מחיקת Topics',              color: '#10B981',       gradient: Colors.gradients.success,                          route: '/admin/topics-admin' },
  { id: 'display-settings',    icon: '🎨', label: 'הגדרות תצוגה',      desc: 'שליטה בממשק שאלות למשתמש',                color: '#EC4899',       gradient: ['#EC4899', '#BE185D'] as [string, string],        route: '/admin/display-settings' },
  { id: 'users',               icon: '👥', label: 'ניהול משתמשים',     desc: 'צפייה, השהייה, שדרוג תוכניות',            color: '#0EA5E9',       gradient: ['#0EA5E9', '#0284C7'] as [string, string],        route: '/admin/users' },
  { id: 'export',              icon: '📤', label: 'ייצוא שאלות',        desc: 'ייצוא מאגר השאלות כ-JSON',                 color: '#10B981',       gradient: Colors.gradients.success,                          route: '/admin/export' },
  { id: 'app-settings',        icon: '⚙️', label: 'הגדרות אפליקציה',   desc: 'תחזוקה, ניסיון, פרמטרים גלובליים',        color: '#6366F1',       gradient: ['#6366F1', '#4F46E5'] as [string, string],        route: '/admin/app-settings' },
];

export default function AdminDashboard() {
  const { isAdmin, login, logout, setIsAdmin, getStats, getPendingQuestions, seedToSupabase, loadQuestionsFromSupabase } = useAdminStore();
  const [email, setEmail] = useState('mrmedico111@gmail.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Auto-login if already authenticated as admin via regular auth
  useEffect(() => {
    if (isAdmin) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email?.toLowerCase() === ADMIN_EMAIL) {
        setIsAdmin(true);
      }
    });
  }, []);

  if (!isAdmin) {
    return (
      <LoginScreen
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        error={loginError} loading={loggingIn}
        onSubmit={async () => {
          if (!email || !password) { setLoginError('מלא מייל וסיסמה'); return; }
          setLoggingIn(true);
          setLoginError('');
          const result = await login(email, password);
          setLoggingIn(false);
          if (!result.ok) {
            setLoginError(result.error ?? 'שגיאת התחברות');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }}
      />
    );
  }

  const stats = getStats();
  const pendingCount = getPendingQuestions().length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
          <Text style={styles.headerTitle}>🛠️ פאנל ניהול</Text>
          <Text style={styles.headerSub}>PsychoTechniPlus Admin v1.0</Text>
          <Pressable onPress={async () => { await logout(); router.replace('/auth'); }} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>יציאה →</Text>
          </Pressable>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <MiniStat label="שאלות סה״כ" value={stats.totalQuestions} icon="❓" color={Colors.primary} />
          <MiniStat label="ממתינות" value={stats.pendingCount} icon="⏳" color={Colors.warning} alert={pendingCount > 0} />
          <MiniStat label="מאושרות" value={stats.validatedCount} icon="✅" color={Colors.success} />
          <MiniStat label="טיוטות" value={stats.draftCount} icon="📝" color={Colors.textTertiary} />
        </View>
        <View style={styles.statsGrid}>
          <MiniStat label="נושאים" value={stats.totalTopics} icon="📚" color={Colors.accent} />
          <MiniStat label="מסלולים" value={stats.totalTargets} icon="🎯" color='#0EA5E9' />
          <MiniStat label="קושי ממוצע" value={stats.avgDifficulty} icon="⚖️" color={Colors.warning} />
          <MiniStat label="נדחו" value={stats.rejectedCount} icon="❌" color={Colors.danger} />
        </View>

        {/* Pending alert */}
        {pendingCount > 0 && (
          <Pressable onPress={() => router.push('/admin/validate')} style={({ pressed }) => [styles.alertBanner, pressed && { opacity: 0.85 }]}>
            <LinearGradient colors={Colors.gradients.gold} style={styles.alertBannerGrad}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <Text style={styles.alertText}>{pendingCount} שאלות ממתינות לאישור — לחץ לאישור</Text>
              <Text style={styles.alertArrow}>←</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Nav sections */}
        <Text style={styles.sectionTitle}>פעולות ניהול</Text>
        <View style={styles.sectionsGrid}>
          {ADMIN_SECTIONS.map(section => (
            <Pressable
              key={section.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(section.route as any); }}
              style={({ pressed }) => [styles.sectionCard, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <LinearGradient colors={section.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />
              {section.id === 'validate' && pendingCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>
              )}
              <Text style={styles.sectionIcon}>{section.icon}</Text>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <Text style={styles.sectionDesc}>{section.desc}</Text>
            </Pressable>
          ))}
        </View>

        {/* Supabase seed / reload */}
        <View style={styles.seedRow}>
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSeeding(true);
              const result = await seedToSupabase();
              setSeeding(false);
              Alert.alert(result.ok ? '✅ הצלחה' : '❌ שגיאה', result.message);
              if (result.ok) loadQuestionsFromSupabase();
            }}
            style={({ pressed }) => [styles.seedBtn, pressed && { opacity: 0.85 }]}
            disabled={seeding}
          >
            <LinearGradient colors={['#0EA5E9', '#0284C7']} style={styles.seedBtnGrad}>
              {seeding ? <ActivityIndicator color="#fff" /> : <Text style={styles.seedBtnText}>☁️ זרע ל-Supabase</Text>}
            </LinearGradient>
          </Pressable>
          <Pressable onPress={async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await loadQuestionsFromSupabase(); Alert.alert('✅ עודכן', 'שאלות נטענו מ-Supabase'); }} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.refreshBtnText}>🔄 טען</Text>
          </Pressable>
        </View>

        {/* Quick add */}
        <Pressable onPress={() => router.push({ pathname: '/admin/question-editor', params: { mode: 'add' } })} style={({ pressed }) => [styles.quickAdd, pressed && { opacity: 0.9 }]}>
          <Text style={styles.quickAddText}>+ הוסף שאלה חדשה</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────

function LoginScreen({ email, setEmail, password, setPassword, error, loading, onSubmit }: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  error: string; loading: boolean; onSubmit: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <KeyboardAvoidingView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
        <Text style={{ fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', marginBottom: 4 }}>
          כניסה למנהל
        </Text>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', marginBottom: 32 }}>
          התחבר עם מייל וסיסמה
        </Text>

        <TextInput
          style={inputStyle(false)}
          value={email}
          onChangeText={setEmail}
          placeholder="מייל"
          placeholderTextColor="#475569"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
        />

        <TextInput
          style={inputStyle(!!error)}
          value={password}
          onChangeText={setPassword}
          placeholder="סיסמה"
          placeholderTextColor="#475569"
          secureTextEntry
          textAlign="right"
          onSubmitEditing={onSubmit}
        />

        {!!error && (
          <Text style={{ color: Colors.danger, fontFamily: FontFamily.medium, marginTop: 8, textAlign: 'right', width: '100%' }}>
            {error}
          </Text>
        )}

        <Pressable onPress={onSubmit} disabled={loading} style={({ pressed }) => [{ backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, width: '100%', alignItems: 'center', marginTop: 20, opacity: pressed || loading ? 0.85 : 1 }]}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' }}>כניסה</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#64748B' }}>← חזרה לאפליקציה</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = (hasError: boolean) => ({
  backgroundColor: '#1E293B',
  color: '#fff',
  fontFamily: FontFamily.medium,
  fontSize: FontSize.base,
  borderRadius: Radius.lg,
  padding: 16,
  width: '100%' as const,
  textAlign: 'right' as const,
  marginBottom: 12,
  borderWidth: hasError ? 2 : 0,
  borderColor: Colors.danger,
});

// ── MiniStat ───────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon, color, alert }: { label: string; value: number | string; icon: string; color: string; alert?: boolean }) {
  return (
    <View style={[miniStyles.card, alert && { borderColor: Colors.warning, borderWidth: 2 }]}>
      <Text style={miniStyles.icon}>{icon}</Text>
      <Text style={[miniStyles.value, { color }]}>{value}</Text>
      <Text style={miniStyles.label}>{label}</Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12, alignItems: 'center', ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  icon: { fontSize: 18, marginBottom: 4 },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'center', marginTop: 2 },
});

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },

  header: { padding: 24, paddingTop: 32, paddingBottom: 28, alignItems: 'flex-end' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', marginTop: 4 },
  logoutBtn: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  logoutText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#fff' },

  statsGrid: { flexDirection: 'row-reverse', paddingHorizontal: 16, gap: 8, marginTop: 12 },

  alertBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: Radius.lg, overflow: 'hidden' },
  alertBannerGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, gap: 10 },
  alertIcon: { fontSize: 18 },
  alertText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#fff', textAlign: 'right' },
  alertArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text, textAlign: 'right', paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  sectionsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  sectionCard: { width: '47%', borderRadius: Radius.xl, padding: 18, overflow: 'hidden', minHeight: 120, justifyContent: 'space-between', ...Shadow.lg, position: 'relative' },
  badge: { position: 'absolute', top: 10, left: 10, backgroundColor: Colors.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, zIndex: 10 },
  badgeText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
  sectionIcon: { fontSize: 28, textAlign: 'right' },
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff', textAlign: 'right', marginTop: 6 },
  sectionDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', textAlign: 'right' },

  seedRow: { flexDirection: 'row-reverse', marginHorizontal: 16, marginTop: 20, gap: 10 },
  seedBtn: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  seedBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  seedBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  refreshBtn: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  refreshBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },

  quickAdd: { margin: 16, marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 18, alignItems: 'center', ...Shadow.primary },
  quickAddText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
});
