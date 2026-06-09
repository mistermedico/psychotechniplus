import React, { useState, useEffect, useMemo } from 'react';
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

// ── Navigation sections ────────────────────────────────────────────────────

type NavCategory = 'content' | 'exams' | 'users' | 'business' | 'system';

interface NavSection {
  id: string;
  icon: string;
  label: string;
  desc: string;
  route: string;
  category: NavCategory;
}

const ADMIN_SECTIONS: NavSection[] = [
  // Content
  { id: 'questions',          icon: '📋', label: 'שאלות',          desc: 'CRUD ופילטרים',        route: '/admin/questions',           category: 'content' },
  { id: 'validate',           icon: '✅', label: 'ולידציה',         desc: 'אישור שאלות',           route: '/admin/validate',            category: 'content' },
  { id: 'json-import',        icon: '📥', label: 'ייבוא JSON',      desc: 'העלאת שאלות',           route: '/admin/json-import',         category: 'content' },
  { id: 'ai-generator',       icon: '📝', label: 'מחולל שאלות',     desc: 'מבוסס תבניות',          route: '/admin/ai-generator',        category: 'content' },
  { id: 'export',             icon: '📤', label: 'ייצוא',            desc: 'ייצוא JSON',             route: '/admin/export',              category: 'content' },
  { id: 'topics-admin',       icon: '📚', label: 'נושאים',          desc: 'ניהול Topics',           route: '/admin/topics-admin',        category: 'content' },
  // Exams
  { id: 'simulation-builder', icon: '🏗️', label: 'סימולציה',        desc: 'תבניות מבחן',           route: '/admin/simulation-builder',  category: 'exams' },
  { id: 'topic-exam-map',     icon: '🗺️', label: 'מפת נושאים',     desc: 'שיוך נושא↔מבחן',        route: '/admin/topic-exam-map',      category: 'exams' },
  { id: 'question-assignment',icon: '🔗', label: 'שיוך שאלות',      desc: 'שייך לנושאים',          route: '/admin/question-assignment', category: 'exams' },
  { id: 'display-settings',  icon: '🎨', label: 'תצוגה',            desc: 'ממשק שאלות',             route: '/admin/display-settings',    category: 'exams' },
  // Users
  { id: 'users',              icon: '👥', label: 'משתמשים',         desc: 'צפייה, שדרוג',           route: '/admin/users',               category: 'users' },
  { id: 'monitor',            icon: '🛰️', label: 'מוניטור',         desc: 'שאלות, פרקים ומבחנים',    route: '/admin/monitor',             category: 'users' },
  { id: 'leaderboard-admin',  icon: '🏅', label: 'לוח מובילים',     desc: 'ניהול דירוג',            route: '/admin/leaderboard-admin',   category: 'users' },
  // Business
  { id: 'revenue',            icon: '📈', label: 'הכנסות',           desc: 'MRR ומנויים',            route: '/admin/revenue',             category: 'business' },
  { id: 'promo-codes',        icon: '🎟️', label: 'קודי קופון',      desc: 'הנחות וגישה',            route: '/admin/promo-codes',         category: 'business' },
  { id: 'notifications',      icon: '🔔', label: 'הודעות Push',     desc: 'שליחת התראות',           route: '/admin/notifications',       category: 'business' },
  { id: 'app-settings',       icon: '⚙️', label: 'הגדרות אפליקציה',desc: 'פרמטרים גלובליים',       route: '/admin/app-settings',        category: 'business' },
  // System
  { id: 'performance',        icon: '📈', label: 'ביצועים',           desc: 'דיוק, רמות, נושאים',     route: '/admin/performance',         category: 'system' },
  { id: 'analytics',          icon: '📊', label: 'אנליטיקס',         desc: 'גרפים ומגמות',           route: '/admin/analytics',           category: 'system' },
  { id: 'app-control',        icon: '🎮', label: 'מרכז שליטה',       desc: 'תחזוקה, דגלים',          route: '/admin/app-control',         category: 'system' },
  { id: 'session-settings',   icon: '🎛️', label: 'הגדרות סשן',      desc: 'תרגול ומבחנים',          route: '/admin/session-settings',    category: 'system' },
  { id: 'daily-challenge',    icon: '🎯', label: 'אתגרים יומיים',    desc: 'בונוס XP',               route: '/admin/daily-challenge',     category: 'system' },
  { id: 'activity-log',       icon: '📋', label: 'יומן פעילות',      desc: 'תיעוד פעולות',           route: '/admin/activity-log',        category: 'system' },
  { id: 'logs',               icon: '🪵', label: 'לוגים',             desc: 'שגיאות ואירועים',         route: '/admin/logs',                category: 'system' },
];

const CATEGORY_COLORS: Record<NavCategory, [string, string]> = {
  content:  ['#5A52D5', '#7C6FF7'],
  exams:    ['#7C6FF7', '#C084FC'],
  users:    ['#10B981', '#34D399'],
  business: ['#D97706', '#FBBF24'],
  system:   ['#334155', '#475569'],
};

const CATEGORY_LABELS: Record<NavCategory, string> = {
  content:  'תוכן 📚',
  exams:    'מבחנים 🏆',
  users:    'משתמשים 👥',
  business: 'עסקי 💼',
  system:   'מערכת ⚙️',
};

const QUICK_ACTIONS = [
  { icon: '✅', label: 'אמת שאלות', route: '/admin/validate' },
  { icon: '➕', label: 'הוסף שאלה', route: '/admin/question-editor?mode=add' },
  { icon: '📈', label: 'ביצועים',    route: '/admin/performance' },
  { icon: '🛰️', label: 'מוניטור',    route: '/admin/monitor' },
  { icon: '👥', label: 'משתמשים',   route: '/admin/users' },
  { icon: '📤', label: 'ייצא',        route: '/admin/export' },
  { icon: '🔔', label: 'שלח הודעה',  route: '/admin/notifications' },
];

export default function AdminDashboard() {
  const {
    isAdmin, login, logout, setIsAdmin, getStats, getPendingQuestions,
    seedToSupabase, loadQuestionsFromSupabase,
    revenueSnapshots, activityLog, questions, topics, templates, sessionHistory,
  } = useAdminStore();

  const [email, setEmail] = useState('mrmedico111@gmail.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
  const latestRevenue = revenueSnapshots[revenueSnapshots.length - 1];
  const prevRevenue = revenueSnapshots[revenueSnapshots.length - 2];
  const approvedPct = stats.totalQuestions > 0
    ? Math.round((stats.validatedCount / stats.totalQuestions) * 100)
    : 0;

  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const recentActivity = activityLog.slice(0, 5);

  const contentHealth = useMemo(() => {
    const validatedPerTopic = topics.map(topic => ({
      topic,
      count: questions.filter(q => q.topicId === topic.id && q.validationStatus === 'validated').length,
    }));
    const lowCoverageTopics = validatedPerTopic.filter(row => row.count < 20).length;
    const countByTopic = Object.fromEntries(validatedPerTopic.map(row => [row.topic.id, row.count]));
    const templateShortages = templates.filter(template =>
      template.rules.some(rule => (countByTopic[rule.topicId] ?? 0) < rule.count)
    ).length;
    const weakSessions = sessionHistory.filter(session => session.score < 55).length;
    return { lowCoverageTopics, templateShortages, weakSessions };
  }, [questions, topics, templates, sessionHistory]);

  const categorized = (['content', 'exams', 'users', 'business', 'system'] as NavCategory[]).map(cat => ({
    cat,
    sections: ADMIN_SECTIONS.filter(s => s.category === cat),
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero Header */}
        <LinearGradient colors={['#0A0F1E', '#0F172A', '#1E293B']} style={styles.hero}>
          <View style={styles.heroTop}>
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>MA</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroDate}>{today}</Text>
              <Text style={styles.heroStatus}>מצב מערכת: תקין ✅</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>🛠️ פאנל ניהול</Text>
          <Text style={styles.heroSub}>PsychoTechniPlus Admin</Text>
          <Pressable
            onPress={async () => { await logout(); router.replace('/auth'); }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>יציאה →</Text>
          </Pressable>
        </LinearGradient>

        {/* Alert Banner */}
        {pendingCount > 0 && (
          <Pressable
            onPress={() => router.push('/admin/validate')}
            style={({ pressed }) => [styles.alertBanner, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient colors={['#D97706', '#B45309']} style={styles.alertGrad}>
              <Text style={styles.alertText}>⚠️  {pendingCount} שאלות ממתינות לאישור</Text>
              <Text style={styles.alertArrow}>←</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Quick Stats Grid 2x2 */}
        <Text style={styles.sectionTitle}>סקירה כללית</Text>
        <View style={styles.statsGrid}>
          {/* Questions */}
          <View style={[styles.glassCard, { borderColor: Colors.primary + '40' }]}>
            <Text style={styles.glassCardTitle}>📋 שאלות</Text>
            <Text style={[styles.glassCardValue, { color: Colors.primary }]}>{stats.totalQuestions}</Text>
            <Text style={styles.glassCardSub}>✅ {stats.validatedCount} מאושרות · ⏳ {stats.pendingCount} ממתינות</Text>
          </View>
          {/* Users */}
          <View style={[styles.glassCard, { borderColor: Colors.success + '40' }]}>
            <Text style={styles.glassCardTitle}>👥 משתמשים</Text>
            <Text style={[styles.glassCardValue, { color: Colors.success }]}>
              {latestRevenue ? latestRevenue.totalPremiumUsers : '—'}
            </Text>
            <Text style={styles.glassCardSub}>
              💎 פרמיום · 📈 {latestRevenue ? (latestRevenue.conversionRate * 100).toFixed(1) : '—'}% המרה
            </Text>
          </View>
          {/* Revenue */}
          <View style={[styles.glassCard, { borderColor: '#D97706' + '40' }]}>
            <Text style={styles.glassCardTitle}>💰 הכנסות</Text>
            <Text style={[styles.glassCardValue, { color: '#F59E0B' }]}>
              {latestRevenue ? `₪${latestRevenue.mrr.toLocaleString()}` : '—'}
            </Text>
            <Text style={styles.glassCardSub}>
              חודש קודם: {prevRevenue ? `₪${prevRevenue.mrr.toLocaleString()}` : '—'}
            </Text>
          </View>
          {/* Quality */}
          <View style={[styles.glassCard, { borderColor: Colors.accent + '40' }]}>
            <Text style={styles.glassCardTitle}>⚖️ איכות</Text>
            <Text style={[styles.glassCardValue, { color: Colors.accent }]}>{approvedPct}%</Text>
            <Text style={styles.glassCardSub}>קושי ממוצע: {stats.avgDifficulty}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>בריאות תוכן וניטור</Text>
        <View style={styles.healthGrid}>
          <Pressable onPress={() => router.push('/admin/topics-admin' as any)} style={styles.healthCard}>
            <Text style={[styles.healthValue, { color: contentHealth.lowCoverageTopics ? Colors.warning : Colors.success }]}>
              {contentHealth.lowCoverageTopics}
            </Text>
            <Text style={styles.healthLabel}>פרקים עם פחות מ-20 שאלות מאושרות</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/admin/simulation-builder' as any)} style={styles.healthCard}>
            <Text style={[styles.healthValue, { color: contentHealth.templateShortages ? Colors.danger : Colors.success }]}>
              {contentHealth.templateShortages}
            </Text>
            <Text style={styles.healthLabel}>מבחנים עם מחסור לפי כללים</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/admin/monitor' as any)} style={styles.healthCard}>
            <Text style={[styles.healthValue, { color: contentHealth.weakSessions ? Colors.warning : Colors.success }]}>
              {contentHealth.weakSessions}
            </Text>
            <Text style={styles.healthLabel}>הגשות חלשות לבדיקה</Text>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>פעולות מהירות</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((a, i) => (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(a.route as any);
              }}
              style={({ pressed }) => [styles.quickActionChip, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.quickActionIcon}>{a.icon}</Text>
              <Text style={styles.quickActionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Pressable onPress={() => router.push('/admin/activity-log' as any)}>
              <Text style={styles.seeAllLink}>ראה הכל ←</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>פעילות אחרונה</Text>
          </View>
          {recentActivity.map(log => (
            <View key={log.id} style={styles.activityRow}>
              <Text style={styles.activityTime}>{relativeTime(log.timestamp)}</Text>
              <Text style={styles.activityText}>{log.action}</Text>
              <View style={[styles.activityDot, { backgroundColor: CATEGORY_ICON_COLORS[log.category] }]} />
            </View>
          ))}
        </View>

        {/* Navigation Grid — by category */}
        <Text style={styles.sectionTitle}>ניווט</Text>
        {categorized.map(({ cat, sections }) => (
          <View key={cat} style={styles.categoryBlock}>
            <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.navGrid}>
              {sections.map(section => (
                <Pressable
                  key={section.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(section.route as any);
                  }}
                  style={({ pressed }) => [styles.navCard, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  <LinearGradient
                    colors={CATEGORY_COLORS[section.category]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                  />
                  {section.id === 'validate' && pendingCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pendingCount}</Text>
                    </View>
                  )}
                  <Text style={styles.navIcon}>{section.icon}</Text>
                  <Text style={styles.navLabel}>{section.label}</Text>
                  <Text style={styles.navDesc}>{section.desc}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Supabase actions */}
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
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await loadQuestionsFromSupabase();
              Alert.alert('✅ עודכן', 'שאלות נטענו מ-Supabase');
            }}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.refreshBtnText}>🔄 טען</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const CATEGORY_ICON_COLORS: Record<string, string> = {
  question: Colors.primary,
  user: Colors.accent,
  promo: Colors.success,
  notification: '#F59E0B',
  system: Colors.textTertiary,
};

function relativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins}ד׳`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `לפני ${diffHours}ש׳`;
  return `לפני ${Math.floor(diffHours / 24)} ימים`;
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

        <Pressable
          onPress={onSubmit}
          disabled={loading}
          style={({ pressed }) => [{
            backgroundColor: Colors.primary,
            borderRadius: Radius.lg,
            padding: 16,
            width: '100%',
            alignItems: 'center' as const,
            marginTop: 20,
            opacity: pressed || loading ? 0.85 : 1,
          }]}
        >
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

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F1E' },
  content: { paddingBottom: 40 },

  // Hero
  hero: {
    padding: 24,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: 'flex-end',
  },
  heroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primaryLight,
  },
  avatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  heroInfo: { flex: 1, alignItems: 'flex-end' },
  heroDate: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#64748B' },
  heroStatus: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#10B981', marginTop: 2 },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  heroSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#64748B', marginTop: 2 },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  logoutText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },

  // Alert Banner
  alertBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: Radius.lg, overflow: 'hidden' },
  alertGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, gap: 10 },
  alertText: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff', textAlign: 'right' },
  alertArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },

  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#E2E8F0',
    textAlign: 'right',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  // Quick Stats 2x2
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  glassCard: {
    width: '47.5%',
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1.5,
    ...Shadow.md,
    gap: 4,
  },
  glassCardTitle: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right' },
  glassCardValue: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], textAlign: 'right' },
  glassCardSub: { fontFamily: FontFamily.regular, fontSize: 10, color: '#64748B', textAlign: 'right' },

  healthGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  healthCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'flex-end',
    ...Shadow.sm,
  },
  healthValue: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['2xl'],
    textAlign: 'right',
  },
  healthLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 16,
  },

  // Quick Actions
  quickActionsRow: { paddingHorizontal: 16, gap: 10, flexDirection: 'row-reverse' },
  quickActionChip: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1, borderColor: '#334155',
    ...Shadow.sm,
  },
  quickActionIcon: { fontSize: 18 },
  quickActionLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#E2E8F0' },

  // Recent Activity
  activitySection: {
    marginHorizontal: 16,
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    ...Shadow.md,
  },
  activityHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllLink: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },
  activityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#E2E8F0', textAlign: 'right' },
  activityTime: { fontFamily: FontFamily.regular, fontSize: 10, color: '#64748B' },

  // Navigation Grid
  categoryBlock: { marginBottom: 4 },
  categoryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#64748B',
    textAlign: 'right',
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  navGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  navCard: {
    width: '30.5%',
    borderRadius: Radius.xl,
    padding: 12,
    overflow: 'hidden',
    minHeight: 100,
    justifyContent: 'space-between',
    position: 'relative',
    ...Shadow.md,
  },
  badge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: Colors.danger,
    borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, zIndex: 10,
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#fff' },
  navIcon: { fontSize: 22, textAlign: 'right' },
  navLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff', textAlign: 'right', marginTop: 4 },
  navDesc: { fontFamily: FontFamily.regular, fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'right' },

  // Supabase
  seedRow: { flexDirection: 'row-reverse', marginHorizontal: 16, marginTop: 20, gap: 10 },
  seedBtn: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  seedBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  seedBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  refreshBtn: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: '#334155',
    ...Shadow.sm,
  },
  refreshBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#E2E8F0' },
});
