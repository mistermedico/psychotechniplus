import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { logger } from '../../utils/logger';
import AdminSyncToolbar from '../../components/AdminSyncToolbar';

interface RealUser {
  id: string;
  name: string;
  email?: string;
  selected_target_id: string | null;
  has_completed_onboarding: boolean;
  is_premium: boolean;
  streak: number;
  longest_streak: number;
  level: number;
  xp: number;
  total_sessions: number;
  total_correct: number;
  total_answered: number;
  last_practiced_date: string | null;
  created_at: string;
  updated_at: string;
  sessions_last_7_days: number;
  avg_score: number;
  total_time_seconds: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  mode: string | null;
  topic_id: string | null;
  total_questions: number | null;
  correct_answers: number | null;
  score: number | null;
  time_spent_seconds: number | null;
  completed_at: string | null;
}

type SortKey = 'sessions' | 'level' | 'streak' | 'correct_rate' | 'joined' | 'recent';
type UserSegment = 'all' | 'free' | 'premium' | 'active7' | 'low_accuracy' | 'incomplete_onboarding';

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('he-IL');
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

function getPerformanceLevel(totalCorrect: number, totalAnswered: number): { label: string; color: string } {
  if (totalAnswered === 0) return { label: 'מתחיל', color: Colors.textTertiary };
  const rate = totalCorrect / totalAnswered;
  if (rate >= 0.75) return { label: 'מתקדם', color: Colors.success };
  if (rate >= 0.45) return { label: 'בינוני', color: Colors.warning };
  return { label: 'צריך חיזוק', color: Colors.danger };
}

function getAccuracy(user: RealUser): number {
  return user.total_answered > 0 ? Math.round((user.total_correct / user.total_answered) * 100) : 0;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} ש׳ ${rest} דק׳` : `${hours} ש׳`;
}

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const { targets } = useAdminStore();
  const [users, setUsers] = useState<RealUser[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [segment, setSegment] = useState<UserSegment>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inactiveFilter, setInactiveFilter] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const loadUsers = useCallback(async (silent = false) => {
    if (loadingRef.current) {
      setRefreshing(false);
      if (!silent) setLoading(false);
      return;
    }
    loadingRef.current = true;
    if (!silent) setLoading(true);
    setSyncError(null);
    try {
      const [{ data: profiles, error: profilesError }, { data: sessionRows, error: sessionsError }] = await Promise.all([
        supabase.from('user_profiles').select('*').order('updated_at', { ascending: false }),
        supabase
          .from('practice_sessions')
          .select('id,user_id,mode,topic_id,total_questions,correct_answers,score,time_spent_seconds,completed_at')
          .order('completed_at', { ascending: false })
          .limit(5000),
      ]);

      if (profilesError) throw profilesError;
      if (sessionsError) throw sessionsError;

      const allSessions = (sessionRows ?? []) as SessionRow[];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const sessionsByUser = new Map<string, SessionRow[]>();
      for (const session of allSessions) {
        if (!session.user_id) continue;
        const list = sessionsByUser.get(session.user_id) ?? [];
        list.push(session);
        sessionsByUser.set(session.user_id, list);
      }

      const mapped = (profiles ?? []).map(profile => {
        const userSessions = sessionsByUser.get(profile.id) ?? [];
        const answeredFromSessions = userSessions.reduce((sum, session) => sum + (session.total_questions ?? 0), 0);
        const correctFromSessions = userSessions.reduce((sum, session) => sum + (session.correct_answers ?? 0), 0);
        const totalSessions = Math.max(profile.total_sessions ?? 0, userSessions.length);
        const totalAnswered = Math.max(profile.total_answered ?? 0, answeredFromSessions);
        const totalCorrect = Math.max(profile.total_correct ?? 0, correctFromSessions);
        const avgScore = userSessions.length > 0
          ? Math.round(userSessions.reduce((sum, session) => sum + (session.score ?? 0), 0) / userSessions.length)
          : 0;
        const lastSession = userSessions.find(session => !!session.completed_at);
        const sessionsLast7Days = userSessions.filter(session => {
          if (!session.completed_at) return false;
          return new Date(session.completed_at) >= sevenDaysAgo;
        }).length;

        return {
          id: profile.id,
          name: profile.name || profile.email || 'משתמש ללא שם',
          email: profile.email ?? undefined,
          selected_target_id: profile.selected_target_id ?? null,
          has_completed_onboarding: profile.has_completed_onboarding ?? false,
          is_premium: profile.is_premium ?? false,
          streak: profile.streak ?? 0,
          longest_streak: profile.longest_streak ?? 0,
          level: profile.level ?? 1,
          xp: profile.xp ?? 0,
          total_sessions: totalSessions,
          total_correct: totalCorrect,
          total_answered: totalAnswered,
          last_practiced_date: lastSession?.completed_at ?? profile.last_practiced_date ?? null,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          sessions_last_7_days: sessionsLast7Days,
          avg_score: avgScore,
          total_time_seconds: userSessions.reduce((sum, session) => sum + (session.time_spent_seconds ?? 0), 0),
        } satisfies RealUser;
      });

      setUsers(mapped);
      setSessions(allSessions);
      setLastSyncedAt(new Date().toISOString());
    } catch (error: any) {
      const message = error?.message ?? 'לא ניתן לטעון משתמשים כרגע';
      setSyncError(message);
      logger.error('admin:users', 'שגיאה בטעינת משתמשים', message);
      if (!silent) Alert.alert('שגיאה', message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();

    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => {
        if (!loadingRef.current) loadUsers(true);
      }, 900);
    };

    const channel = supabase
      .channel('admin-users-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_sessions' }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [loadUsers]);

  const sevenDaysAgoDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = users.filter(user => (
      !term ||
      user.name.toLowerCase().includes(term) ||
      (user.email ?? '').toLowerCase().includes(term) ||
      user.id.toLowerCase().includes(term)
    ));

    if (inactiveFilter) {
      list = list.filter(user => !user.last_practiced_date || new Date(user.last_practiced_date) < sevenDaysAgoDate);
    }

    if (segment === 'free') list = list.filter(user => !user.is_premium);
    if (segment === 'premium') list = list.filter(user => user.is_premium);
    if (segment === 'active7') list = list.filter(user => user.sessions_last_7_days > 0);
    if (segment === 'low_accuracy') list = list.filter(user => user.total_answered >= 10 && getAccuracy(user) < 45);
    if (segment === 'incomplete_onboarding') list = list.filter(user => !user.has_completed_onboarding);

    return [...list].sort((a, b) => {
      if (sortKey === 'sessions') return b.total_sessions - a.total_sessions;
      if (sortKey === 'level') return b.level - a.level;
      if (sortKey === 'streak') return b.streak - a.streak;
      if (sortKey === 'joined') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortKey === 'recent') return new Date(b.last_practiced_date ?? b.updated_at ?? 0).getTime() - new Date(a.last_practiced_date ?? a.updated_at ?? 0).getTime();
      return getAccuracy(b) - getAccuracy(a);
    });
  }, [inactiveFilter, search, segment, sevenDaysAgoDate, sortKey, users]);

  const stats = useMemo(() => ({
    total: users.length,
    active7: users.filter(user => user.sessions_last_7_days > 0).length,
    premium: users.filter(user => user.is_premium).length,
    sessions: users.reduce((sum, user) => sum + user.total_sessions, 0),
    avgAccuracy: users.length
      ? Math.round(users.reduce((sum, user) => sum + getAccuracy(user), 0) / users.length)
      : 0,
  }), [users]);

  const selectedUser = users.find(user => user.id === selectedUserId);
  const selectedSessions = selectedUser ? sessions.filter(session => session.user_id === selectedUser.id) : [];

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers(true);
  };

  const handleExportCSV = () => {
    const header = 'מזהה,שם,אימייל,פרימיום,אונבורדינג,מסלול,רמה,XP,סשנים,דיוק,פעיל בשבוע האחרון,זמן תרגול בדקות,הצטרף,פעילות אחרונה';
    const rows = filtered.map(user => [
      user.id,
      user.name,
      user.email ?? '',
      user.is_premium ? 'כן' : 'לא',
      user.has_completed_onboarding ? 'כן' : 'לא',
      targets.find(targetItem => targetItem.id === user.selected_target_id)?.name ?? '',
      String(user.level),
      String(user.xp),
      String(user.total_sessions),
      `${getAccuracy(user)}%`,
      String(user.sessions_last_7_days),
      String(Math.round(user.total_time_seconds / 60)),
      formatDate(user.created_at),
      formatDateTime(user.last_practiced_date),
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
    const preview = [header, ...rows.slice(0, 5)].join('\n');
    Alert.alert('יצוא CSV', `${filtered.length} משתמשים בתצוגה הנוכחית\n\nתצוגה מקדימה:\n\n${preview}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>טוען משתמשים וסשנים מ-Supabase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedUser) {
    return (
      <UserDetailScreen
        user={selectedUser}
        sessions={selectedSessions}
        onBack={() => { setSelectedUserId(null); loadUsers(true); }}
        onDeleted={() => { setSelectedUserId(null); loadUsers(true); }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <AdminSyncToolbar
        title="ניהול משתמשים"
        subtitle="משתמשים, סשנים, דיוק וסטטוס פרימיום נטענים ישירות מ-Supabase ומתעדכנים בזמן אמת."
        counters={[
          { label: 'משתמשים', value: stats.total, tone: 'primary' },
          { label: 'פעילים השבוע', value: stats.active7, tone: 'success' },
          { label: 'פרימיום', value: stats.premium, tone: 'warning' },
          { label: 'דיוק ממוצע', value: `${stats.avgAccuracy}%`, tone: stats.avgAccuracy >= 60 ? 'success' : 'warning' },
        ]}
      />
      <View style={styles.statsBar}>
        <StatChip label="משתמשים" value={String(stats.total)} />
        <StatChip label="פעילים 7 ימים" value={String(stats.active7)} />
        <StatChip label="פרימיום" value={String(stats.premium)} />
        <StatChip label="סשנים" value={String(stats.sessions)} />
        <StatChip label="דיוק ממוצע" value={`${stats.avgAccuracy}%`} />
      </View>

      <View style={[styles.syncBanner, syncError && styles.syncBannerError]}>
        <View style={styles.syncTextWrap}>
          <Text style={styles.syncTitle}>{syncError ? 'יש בעיית סנכרון' : 'סנכרון חי פעיל'}</Text>
          <Text style={styles.syncSub}>
            {syncError ?? `עודכן לאחרונה: ${lastSyncedAt ? formatDateTime(lastSyncedAt) : '-'}`}
          </Text>
        </View>
        <Pressable
          disabled={loading || refreshing}
          onPress={() => loadUsers()}
          style={[styles.refreshBtn, (loading || refreshing) && { opacity: 0.65 }]}
        >
          <Text style={styles.refreshText}>{loading || refreshing ? 'טוען...' : 'רענן'}</Text>
        </Pressable>
      </View>

      <View style={styles.controlRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם, אימייל או מזהה..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
        <Pressable onPress={handleExportCSV} style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>CSV</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips} style={styles.sortScroll}>
        {([
          ['all', 'כולם'],
          ['free', 'חינמיים'],
          ['premium', 'פרימיום'],
          ['active7', 'פעילים השבוע'],
          ['low_accuracy', 'דיוק נמוך'],
          ['incomplete_onboarding', 'לא השלימו פתיחה'],
        ] as [UserSegment, string][]).map(([key, label]) => (
          <Pressable key={key} onPress={() => setSegment(key)} style={[styles.segmentChip, segment === key && styles.segmentChipActive]}>
            <Text style={[styles.segmentChipText, segment === key && styles.segmentChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips} style={styles.sortScroll}>
        <Pressable onPress={() => setInactiveFilter(value => !value)} style={[styles.sortChip, inactiveFilter && styles.sortChipWarning]}>
          <Text style={[styles.sortChipText, inactiveFilter && styles.sortChipTextActive]}>לא פעיל 7+ ימים</Text>
        </Pressable>
        {([
          ['recent', 'אחרון'],
          ['sessions', 'סשנים'],
          ['level', 'רמה'],
          ['streak', 'רצף'],
          ['correct_rate', 'דיוק'],
          ['joined', 'הצטרפות'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <Pressable key={key} onPress={() => setSortKey(key)} style={[styles.sortChip, sortKey === key && styles.sortChipActive]}>
            <Text style={[styles.sortChipText, sortKey === key && styles.sortChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.resultCount}>{filtered.length} משתמשים מוצגים</Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const target = targets.find(targetItem => targetItem.id === item.selected_target_id);
          const perf = getPerformanceLevel(item.total_correct, item.total_answered);

          return (
            <Pressable onPress={() => setSelectedUserId(item.id)} style={({ pressed }) => [styles.userCard, pressed && { opacity: 0.85 }]}>
              <View style={styles.userCardHeader}>
                <View style={styles.userAvatarCircle}>
                  <Text style={styles.userAvatarText}>{item.name.charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.userMainInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{item.name}</Text>
                    {item.is_premium && <Text style={styles.premiumTag}>פרימיום</Text>}
                  </View>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    {item.email ?? item.id}
                  </Text>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    {target ? `${target.icon} ${target.name}` : 'ללא מסלול'}{!item.has_completed_onboarding ? ' · לא השלים אונבורדינג' : ''}
                  </Text>
                </View>
                <View style={styles.userLevelBadge}>
                  <Text style={styles.userLevelText}>Lv {item.level}</Text>
                </View>
              </View>

              <View style={styles.userStats}>
                <MiniStat value={String(item.total_sessions)} label="סשנים" />
                <MiniStat value={`${getAccuracy(item)}%`} label="דיוק" />
                <MiniStat value={String(item.sessions_last_7_days)} label="7 ימים" />
                <MiniStat value={String(item.xp)} label="XP" />
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.userJoined}>פעילות אחרונה: {formatDateTime(item.last_practiced_date)}</Text>
                <View style={[styles.perfPill, { backgroundColor: perf.color + '22', borderColor: perf.color + '55' }]}>
                  <Text style={[styles.perfPillText, { color: perf.color }]}>{perf.label}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={(
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>{users.length === 0 ? 'אין משתמשים רשומים עדיין' : 'לא נמצאו תוצאות'}</Text>
            <Text style={styles.emptyHint}>{users.length === 0 ? 'משתמשים יופיעו כאן לאחר הרשמה או פעילות ראשונה' : 'נסה חיפוש או סינון אחר'}</Text>
          </View>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 80, 110) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

function UserDetailScreen({
  user,
  sessions,
  onBack,
  onDeleted,
}: {
  user: RealUser;
  sessions: SessionRow[];
  onBack: () => void;
  onDeleted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { targets, topics, premiumConfig } = useAdminStore();
  const [isPremium, setIsPremium] = useState(user.is_premium);
  const [togglingPremium, setTogglingPremium] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleTogglePremium = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTogglingPremium(true);
    const next = !isPremium;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_premium: next, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      setIsPremium(next);
      Alert.alert('עודכן', next ? 'המשתמש עודכן לפרימיום' : 'פרימיום הוסר מהמשתמש');
    } catch (error: any) {
      Alert.alert('שגיאה', error?.message ?? 'לא ניתן לעדכן סטטוס פרימיום');
    } finally {
      setTogglingPremium(false);
    }
  };

  const handleDeleteUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'מחיקת משתמש',
      `האם למחוק את ${user.name} לגמרי?\nהפעולה אינה הפיכה ותמחק גם נתוני סשנים.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.functions.invoke('admin-delete-user', { body: { userId: user.id } });
              if (error) throw error;
              Alert.alert('נמחק', `המשתמש ${user.name} נמחק בהצלחה`, [{ text: 'אישור', onPress: onDeleted }]);
            } catch (error: any) {
              Alert.alert('שגיאה', error?.message ?? 'לא ניתן למחוק את המשתמש');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const target = targets.find(item => item.id === user.selected_target_id);
  const perf = getPerformanceLevel(user.total_correct, user.total_answered);
  const topicSummary = useMemo(() => {
    const byTopic = new Map<string, { topicId: string; sessions: number; correct: number; total: number; time: number }>();
    for (const session of sessions) {
      const topicId = session.topic_id ?? 'unknown';
      const current = byTopic.get(topicId) ?? { topicId, sessions: 0, correct: 0, total: 0, time: 0 };
      current.sessions += 1;
      current.correct += session.correct_answers ?? 0;
      current.total += session.total_questions ?? 0;
      current.time += session.time_spent_seconds ?? 0;
      byTopic.set(topicId, current);
    }
    return [...byTopic.values()]
      .map(row => ({
        ...row,
        accuracy: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0,
        topic: topics.find(item => item.id === row.topicId),
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [sessions, topics]);
  const modeSummary = useMemo(() => {
    const byMode = new Map<string, number>();
    for (const session of sessions) {
      const mode = session.mode || 'practice';
      byMode.set(mode, (byMode.get(mode) ?? 0) + 1);
    }
    return [...byMode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [sessions]);
  const premiumAccessRows = [
    { label: 'כל הנושאים', active: isPremium && premiumConfig.premiumFeatures.allTopics },
    { label: 'סימולציות מלאות', active: isPremium && premiumConfig.premiumFeatures.simulations },
    { label: 'שאלות ללא הגבלה', active: isPremium && premiumConfig.premiumFeatures.unlimitedQuestions },
    { label: 'תרגול אדפטיבי', active: isPremium && premiumConfig.premiumFeatures.adaptiveAlgorithm },
    { label: 'מצב מהירות', active: isPremium && premiumConfig.premiumFeatures.speedMode },
    { label: 'ללא מודעות', active: isPremium },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.detailContent, { paddingBottom: Math.max(insets.bottom + 48, 80) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AdminSyncToolbar
          title="כרטיס משתמש"
          subtitle="שינוי פרימיום, מחיקה ונתוני ביצועים נשמרים ב-Supabase ומשתקפים בחזרה ברשימת המשתמשים."
          counters={[
            { label: 'סשנים', value: user.total_sessions, tone: 'primary' },
            { label: 'דיוק', value: `${getAccuracy(user)}%`, tone: getAccuracy(user) >= 60 ? 'success' : 'warning' },
            { label: 'רמה', value: user.level, tone: 'primary' },
            { label: 'סטטוס', value: isPremium ? 'פרימיום' : 'חינמי', tone: isPremium ? 'warning' : 'primary' },
          ]}
        />
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>חזרה לרשימה</Text>
        </Pressable>

        <View style={styles.detailHeader}>
          <View style={[styles.userAvatarCircle, styles.detailAvatar]}>
            <Text style={[styles.userAvatarText, styles.detailAvatarText]}>{user.name.charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.detailName}>{user.name}</Text>
          <Text style={styles.detailSub}>{user.email ?? user.id}</Text>
          <Text style={styles.detailSub}>{target ? `${target.icon} ${target.name}` : 'ללא מסלול'}</Text>
          <View style={[styles.perfPill, { backgroundColor: perf.color + '22', borderColor: perf.color + '55', marginTop: 8 }]}>
            <Text style={[styles.perfPillText, { color: perf.color }]}>{perf.label}</Text>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <MiniDetail label="סשנים" value={String(user.total_sessions)} />
          <MiniDetail label="דיוק" value={`${getAccuracy(user)}%`} />
          <MiniDetail label="פעיל השבוע" value={String(user.sessions_last_7_days)} />
          <MiniDetail label="רצף" value={String(user.streak)} />
          <MiniDetail label="XP" value={String(user.xp)} />
          <MiniDetail label="ציון ממוצע" value={user.avg_score ? `${user.avg_score}%` : '-'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>בקרת גישה ופרימיום</Text>
          <View style={[styles.accessStatusCard, isPremium ? styles.accessStatusPremium : styles.accessStatusFree]}>
            <Text style={styles.accessStatusTitle}>{isPremium ? 'משתמש פרימיום פעיל' : 'משתמש חינמי'}</Text>
            <Text style={styles.accessStatusText}>
              {isPremium
                ? 'גישה מלאה, ללא מודעות וללא מגבלת סשנים יומית.'
                : 'גישה בסיסית עם מגבלות חינמיות ומודעות לא פולשניות.'}
            </Text>
          </View>
          <View style={styles.accessRows}>
            {premiumAccessRows.map(row => (
              <View key={row.label} style={styles.accessRowItem}>
                <Text style={[styles.accessRowMark, { color: row.active ? Colors.success : Colors.textTertiary }]}>
                  {row.active ? '✓' : '—'}
                </Text>
                <Text style={styles.accessRowText}>{row.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פעולות מנהל</Text>
          <Pressable
            onPress={handleTogglePremium}
            disabled={togglingPremium}
            style={[styles.actionBtn, isPremium ? styles.actionBtnWarning : styles.actionBtnPrimary]}
          >
            {togglingPremium
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.actionBtnText}>{isPremium ? 'הסר פרימיום' : 'הפוך לפרימיום'}</Text>}
          </Pressable>

          <Pressable onPress={handleDeleteUser} disabled={deleting} style={[styles.actionBtn, styles.actionBtnDanger]}>
            {deleting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.actionBtnText}>מחק משתמש</Text>}
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Pressable onPress={() => Linking.openURL(`mailto:${user.email ?? ''}`)} disabled={!user.email}>
              <Text style={[styles.sectionLink, !user.email && { opacity: 0.4 }]}>שלח מייל</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>פרטים</Text>
          </View>
          <Text style={styles.dateText}>הצטרף: {formatDateTime(user.created_at)}</Text>
          <Text style={styles.dateText}>פעילות אחרונה: {formatDateTime(user.last_practiced_date)}</Text>
          <Text style={styles.dateText}>עדכון אחרון: {formatDateTime(user.updated_at)}</Text>
          <Text style={styles.dateText}>זמן תרגול כולל: {formatDuration(user.total_time_seconds)}</Text>
          <Text style={styles.dateText}>מזהה: {user.id}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פירוט פעילות לפי נושאים</Text>
          {topicSummary.length === 0 ? (
            <Text style={styles.emptyHint}>אין עדיין מספיק פעילות לפי נושא</Text>
          ) : topicSummary.map(row => (
            <View key={row.topicId} style={styles.topicInsightRow}>
              <View style={styles.topicInsightInfo}>
                <Text style={styles.topicInsightTitle}>{row.topic ? `${row.topic.icon} ${row.topic.name}` : row.topicId}</Text>
                <Text style={styles.topicInsightMeta}>
                  {row.sessions} סשנים · {row.correct}/{row.total} נכון · {formatDuration(row.time)}
                </Text>
              </View>
              <View style={[
                styles.topicAccuracyBadge,
                { borderColor: row.accuracy >= 70 ? Colors.success + '66' : row.accuracy >= 45 ? Colors.warning + '66' : Colors.dangerGlow },
              ]}>
                <Text style={[
                  styles.topicAccuracyText,
                  { color: row.accuracy >= 70 ? Colors.success : row.accuracy >= 45 ? Colors.warning : Colors.danger },
                ]}>{row.accuracy}%</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>מצבי תרגול בשימוש</Text>
          {modeSummary.length === 0 ? (
            <Text style={styles.emptyHint}>אין עדיין סשנים מתועדים</Text>
          ) : (
            <View style={styles.modeSummaryWrap}>
              {modeSummary.map(([mode, count]) => (
                <View key={mode} style={styles.modeSummaryChip}>
                  <Text style={styles.modeSummaryCount}>{count}</Text>
                  <Text style={styles.modeSummaryText}>{mode}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>סשנים אחרונים ({sessions.length})</Text>
          {sessions.length === 0 ? (
            <Text style={styles.emptyHint}>אין סשנים מתועדים</Text>
          ) : sessions.slice(0, 30).map(session => {
            const topic = topics.find(item => item.id === session.topic_id);
            const score = typeof session.score === 'number' ? `${Math.round(session.score)}%` : '-';
            return (
              <View key={session.id} style={styles.sessionRow}>
                <Text style={styles.sessionMode}>{topic ? `${topic.icon} ${topic.name}` : 'תרגול'} · {session.mode ?? '-'}</Text>
                <Text style={styles.sessionMeta}>
                  {session.correct_answers ?? 0}/{session.total_questions ?? 0} נכון · ציון {score} · {formatDateTime(session.completed_at)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function MiniDetail({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.detailStatCard}>
      <Text style={styles.detailStatValue}>{value}</Text>
      <Text style={styles.detailStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  statsBar: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 12, gap: 8 },
  statChip: {
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    alignItems: 'center',
  },
  statChipValue: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  statChipLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  syncBanner: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.success + '55',
    backgroundColor: Colors.success + '12',
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  syncBannerError: { borderColor: Colors.dangerGlow, backgroundColor: Colors.dangerLight },
  syncTextWrap: { flex: 1, alignItems: 'flex-end' },
  syncTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  syncSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  refreshBtn: { borderRadius: Radius.md, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9 },
  refreshText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  controlRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FontFamily.regular,
    writingDirection: 'rtl',
  },
  exportBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 12 },
  exportBtnText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.sm },
  sortScroll: { maxHeight: 52, marginTop: 10 },
  sortChips: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  sortChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipWarning: { backgroundColor: Colors.warning + '22', borderColor: Colors.warning },
  sortChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  sortChipTextActive: { color: '#fff' },
  segmentChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primaryLight },
  segmentChipTextActive: { color: '#fff' },
  resultCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  list: { padding: 12, gap: 12 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', padding: 36 },
  emptyIcon: { fontSize: 42, marginBottom: 10 },
  emptyText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'center' },
  emptyHint: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 6 },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    ...Shadow.sm,
  },
  userCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  userAvatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
  userMainInfo: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  userNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  premiumTag: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#111827',
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  userMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 3 },
  userLevelBadge: { backgroundColor: Colors.primaryLighter, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  userLevelText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary },
  userStats: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  miniStat: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: 8 },
  miniStatValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  miniStatLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 },
  userJoined: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right' },
  perfPill: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  perfPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  detailContent: { padding: 16 },
  backBtn: {
    alignSelf: 'flex-end',
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  backBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  detailHeader: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 14,
  },
  detailAvatar: { width: 64, height: 64, borderRadius: 32 },
  detailAvatarText: { fontSize: 28 },
  detailName: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'center', marginTop: 8 },
  detailSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  detailGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  detailStatCard: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  detailStatValue: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  detailStatLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  sectionLink: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  accessStatusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-end',
  },
  accessStatusPremium: {
    backgroundColor: Colors.warning + '18',
    borderColor: Colors.warning + '66',
  },
  accessStatusFree: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.border,
  },
  accessStatusTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  accessStatusText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 18,
  },
  accessRows: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  accessRowItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  accessRowMark: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  accessRowText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  actionBtn: { borderRadius: Radius.lg, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnWarning: { backgroundColor: Colors.warning },
  actionBtnDanger: { backgroundColor: Colors.danger },
  actionBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  topicInsightRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: 10,
  },
  topicInsightInfo: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  topicInsightTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  topicInsightMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 3 },
  topicAccuracyBadge: {
    minWidth: 58,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  topicAccuracyText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  modeSummaryWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  modeSummaryChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '16',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  modeSummaryCount: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primaryLight },
  modeSummaryText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  sessionRow: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: 10, gap: 4 },
  sessionMode: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  sessionMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },
  dateText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
});
