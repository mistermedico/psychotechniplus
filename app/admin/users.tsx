import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { TARGETS, TOPICS } from '../../data/mockData';
import { logger } from '../../utils/logger';

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
}

type SortKey = 'sessions' | 'level' | 'streak' | 'correct_rate' | 'joined';

function getPerformanceLevel(totalCorrect: number, totalAnswered: number): { label: string; color: string } {
  if (totalAnswered === 0) return { label: 'מתחיל', color: Colors.danger };
  const rate = totalCorrect / totalAnswered;
  if (rate >= 0.75) return { label: 'מתקדם', color: Colors.success };
  if (rate >= 0.35) return { label: 'בינוני', color: Colors.warning };
  return { label: 'מתחיל', color: Colors.danger };
}

export default function UsersScreen() {
  const [users, setUsers] = useState<RealUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sessions');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inactiveFilter, setInactiveFilter] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const { data: profiles, error: pe } = await supabase
        .from('user_profiles')
        .select('*')
        .order('total_sessions', { ascending: false });

      if (pe) { logger.error('users:load', 'שגיאה בטעינת משתמשים', pe.message); setLoading(false); setRefreshing(false); return; }
      if (!profiles?.length) { setUsers([]); return; }

      const combined: RealUser[] = profiles.map(p => ({
        id: p.id,
        name: p.name || 'ללא שם',
        selected_target_id: p.selected_target_id,
        has_completed_onboarding: p.has_completed_onboarding ?? false,
        is_premium: p.is_premium ?? false,
        streak: p.streak ?? 0,
        longest_streak: p.longest_streak ?? 0,
        level: p.level ?? 1,
        xp: p.xp ?? 0,
        total_sessions: p.total_sessions ?? 0,
        total_correct: p.total_correct ?? 0,
        total_answered: p.total_answered ?? 0,
        last_practiced_date: p.last_practiced_date ?? null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));

      setUsers(combined);
    } catch (e: any) {
      logger.error('users:load', 'חריגה בטעינת משתמשים', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onRefresh = () => { setRefreshing(true); loadUsers(); };

  const handleExportCSV = async () => {
    const header = 'שם,סשנים,דיוק%,רצף,פרמיום,הצטרף';
    const rows = users.map(u => {
      const acc = u.total_answered > 0 ? Math.round((u.total_correct / u.total_answered) * 100) : 0;
      const joined = new Date(u.created_at).toLocaleDateString('he-IL');
      return `"${u.name}",${u.total_sessions},${acc}%,${u.streak},${u.is_premium ? 'כן' : 'לא'},"${joined}"`;
    });
    const csv = [header, ...rows].join('\n');
    logger.info('users:export', `CSV generated with ${users.length} rows`);
    try {
      await Share.share({
        message: csv,
        title: `psychotechniplus-users-${new Date().toLocaleDateString('he-IL')}.csv`,
      });
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לשתף את הקובץ');
    }
  };

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(s) ||
        (u.email ?? '').toLowerCase().includes(s) ||
        u.id.toLowerCase().includes(s)
      );
    }
    if (inactiveFilter) {
      list = list.filter(u => {
        if (!u.last_practiced_date) return true;
        return u.last_practiced_date < sevenDaysAgo;
      });
    }
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'sessions':     return b.total_sessions - a.total_sessions;
        case 'level':        return b.level - a.level;
        case 'streak':       return b.streak - a.streak;
        case 'correct_rate': {
          const ra = a.total_answered ? a.total_correct / a.total_answered : 0;
          const rb = b.total_answered ? b.total_correct / b.total_answered : 0;
          return rb - ra;
        }
        case 'joined':       return b.created_at.localeCompare(a.created_at);
        default:             return 0;
      }
    });
  }, [users, search, sortKey, inactiveFilter, sevenDaysAgo]);

  const selectedUser = users.find(u => u.id === selectedUserId);

  const stats = useMemo(() => ({
    total: users.length,
    withSessions: users.filter(u => u.total_sessions > 0).length,
    premium: users.filter(u => u.is_premium).length,
    avgSessions: users.length ? Math.round(users.reduce((s, u) => s + u.total_sessions, 0) / users.length) : 0,
  }), [users]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>טוען משתמשים מ-Supabase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedUser) {
    return (
      <UserDetailScreen
        user={selectedUser}
        onBack={() => { setSelectedUserId(null); loadUsers(); }}
        onDeleted={() => { setSelectedUserId(null); loadUsers(); }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <StatChip label="סה״כ" value={String(stats.total)} />
        <StatChip label="פעילים" value={String(stats.withSessions)} />
        <StatChip label="פרמיום" value={String(stats.premium)} />
        <StatChip label="סשנים ממוצע" value={String(stats.avgSessions)} />
      </View>

      {/* Search + export */}
      <View style={styles.controlRow}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          placeholder="🔍 חפש משתמש..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
        <Pressable onPress={handleExportCSV} style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>📤 CSV</Text>
        </Pressable>
      </View>

      {/* Sort chips + inactive filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortChips} style={styles.sortScroll}>
        <Pressable
          onPress={() => setInactiveFilter(v => !v)}
          style={[styles.sortChip, inactiveFilter && styles.sortChipWarning]}
        >
          <Text style={[styles.sortChipText, inactiveFilter && styles.sortChipTextActive]}>
            לא פעיל 7+ ימים
          </Text>
        </Pressable>
        {([
          ['sessions', 'סשנים'],
          ['level', 'רמה'],
          ['streak', 'רצף'],
          ['correct_rate', '% נכון'],
          ['joined', 'הצטרפות'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setSortKey(key)}
            style={[styles.sortChip, sortKey === key && styles.sortChipActive]}
          >
            <Text style={[styles.sortChipText, sortKey === key && styles.sortChipTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.resultCount}>{filtered.length} משתמשים</Text>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyText}>
              {users.length === 0 ? 'אין משתמשים רשומים עדיין' : 'לא נמצאו תוצאות'}
            </Text>
            <Text style={styles.emptyHint}>
              {users.length === 0 ? 'משתמשים יופיעו כאן לאחר הרשמה' : 'נסה חיפוש אחר'}
            </Text>
          </View>
        ) : (
          filtered.map(u => {
            const target = TARGETS.find(t => t.id === u.selected_target_id);
            const correctRate = u.total_answered > 0
              ? Math.round((u.total_correct / u.total_answered) * 100)
              : null;
            const joinDate = new Date(u.created_at).toLocaleDateString('he-IL');
            const perf = getPerformanceLevel(u.total_correct, u.total_answered);

            return (
              <Pressable
                key={u.id}
                onPress={() => setSelectedUserId(u.id)}
                style={({ pressed }) => [styles.userCard, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.userCardHeader}>
                  <View style={styles.userAvatarCircle}>
                    <Text style={styles.userAvatarText}>
                      {u.name.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.userMainInfo}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.userName}>{u.name}</Text>
                      {u.is_premium && <Text style={{ fontSize: 14 }}>💎</Text>}
                    </View>
                    <Text style={styles.userId} numberOfLines={1}>
                      {target ? `${target.icon} ${target.name}` : 'ללא מסלול'}
                      {!u.has_completed_onboarding ? ' · לא השלים אונבורדינג' : ''}
                    </Text>
                  </View>
                  <View style={styles.userLevelBadge}>
                    <Text style={styles.userLevelText}>Lv{u.level}</Text>
                  </View>
                </View>

                <View style={styles.userStats}>
                  <MiniStat icon="🎯" value={String(u.total_sessions)} label="סשנים" />
                  <MiniStat icon="✅" value={correctRate !== null ? `${correctRate}%` : '—'} label="נכון" />
                  <MiniStat icon="🔥" value={String(u.streak)} label="רצף" />
                  <MiniStat icon="⭐" value={String(u.xp)} label="XP" />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.userJoined}>הצטרף: {joinDate}</Text>
                  <View style={[styles.perfPill, { backgroundColor: perf.color + '22', borderColor: perf.color + '55' }]}>
                    <Text style={[styles.perfPillText, { color: perf.color }]}>{perf.label}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── User Detail Screen ─────────────────────────────────────────────────────

function UserDetailScreen({
  user,
  onBack,
  onDeleted,
}: {
  user: RealUser;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [isPremium, setIsPremium] = useState(user.is_premium);
  const [togglingPremium, setTogglingPremium] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase
      .from('practice_sessions')
      .select('id, mode, topic_id, total_questions, correct_answers, score, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setSessions(data ?? []);
        setLoadingSessions(false);
      });
  }, [user.id]);

  const handleTogglePremium = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTogglingPremium(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_premium: !isPremium })
        .eq('id', user.id);
      if (error) {
        Alert.alert('שגיאה', 'לא ניתן לעדכן סטטוס פרמיום: ' + error.message);
      } else {
        setIsPremium(prev => !prev);
        Alert.alert('עודכן', !isPremium ? '💎 המשתמש עודכן לפרמיום' : '🔓 פרמיום הוסר מהמשתמש');
      }
    } finally {
      setTogglingPremium(false);
    }
  };

  const handleDeleteUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'מחק משתמש',
      `האם אתה בטוח שברצונך למחוק את ${user.name}?\nפעולה זו בלתי הפיכה ותמחק את כל הסשנים.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error: sessErr } = await supabase
                .from('practice_sessions')
                .delete()
                .eq('user_id', user.id);
              if (sessErr) {
                Alert.alert('שגיאה', 'לא ניתן למחוק סשנים: ' + sessErr.message);
                setDeleting(false);
                return;
              }
              const { error: profErr } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', user.id);
              if (profErr) {
                Alert.alert('שגיאה', 'לא ניתן למחוק פרופיל: ' + profErr.message);
                setDeleting(false);
                return;
              }
              Alert.alert('נמחק', `המשתמש ${user.name} נמחק בהצלחה`, [
                { text: 'אישור', onPress: onDeleted },
              ]);
            } catch (e: any) {
              Alert.alert('שגיאה', e?.message ?? 'שגיאה לא ידועה');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const target = TARGETS.find(t => t.id === user.selected_target_id);
  const correctRate = user.total_answered > 0
    ? Math.round((user.total_correct / user.total_answered) * 100)
    : null;
  const perf = getPerformanceLevel(user.total_correct, user.total_answered);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Back */}
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>→ חזרה לרשימה</Text>
        </Pressable>

        {/* User header */}
        <View style={styles.detailHeader}>
          <View style={[styles.userAvatarCircle, { width: 64, height: 64, borderRadius: 32 }]}>
            <Text style={[styles.userAvatarText, { fontSize: 28 }]}>
              {user.name.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.detailName}>{user.name}</Text>
            {isPremium && <Text style={{ fontSize: 22 }}>💎</Text>}
          </View>
          <Text style={styles.detailSub}>{target ? `${target.icon} ${target.name}` : 'ללא מסלול'}</Text>
          <View style={[styles.perfPill, { backgroundColor: perf.color + '22', borderColor: perf.color + '55', marginTop: 4 }]}>
            <Text style={[styles.perfPillText, { color: perf.color }]}>{perf.label}</Text>
          </View>
          <Text style={[styles.detailSub, { fontSize: FontSize.xs, marginTop: 2, color: Colors.textTertiary }]}>
            ID: {user.id.slice(0, 16)}...
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.detailGrid}>
          {[
            ['🎯', 'סשנים', String(user.total_sessions)],
            ['✅', 'נכון', correctRate !== null ? `${correctRate}%` : '—'],
            ['🔥', 'רצף', String(user.streak)],
            ['🏆', 'רצף שיא', String(user.longest_streak)],
            ['⭐', 'XP', String(user.xp)],
            ['🎖️', 'רמה', String(user.level)],
          ].map(([icon, label, value]) => (
            <View key={label} style={styles.detailStatCard}>
              <Text style={styles.detailStatIcon}>{icon}</Text>
              <Text style={styles.detailStatValue}>{value}</Text>
              <Text style={styles.detailStatLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Premium toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ פעולות ניהול</Text>
          <Pressable
            onPress={handleTogglePremium}
            disabled={togglingPremium}
            style={[styles.actionBtn, isPremium ? styles.actionBtnWarning : styles.actionBtnPrimary]}
          >
            {togglingPremium
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.actionBtnText}>
                  {isPremium ? '🔓 הסר פרמיום' : '💎 הוסף פרמיום'}
                </Text>
            }
          </Pressable>

          <Pressable
            onPress={handleDeleteUser}
            disabled={deleting}
            style={[styles.actionBtn, styles.actionBtnDanger, { marginTop: 10 }]}
          >
            {deleting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.actionBtnText}>🗑️ מחק משתמש</Text>
            }
          </Pressable>
        </View>

        {/* Recent sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕐 סשנים אחרונים ({sessions.length})</Text>
          {loadingSessions ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyHint}>אין סשנים מתועדים</Text>
          ) : (
            sessions.map(s => {
              const topic = TOPICS.find(t => t.id === s.topic_id);
              const date = s.completed_at ? new Date(s.completed_at).toLocaleDateString('he-IL') : '—';
              const score = s.score ? `${Math.round(s.score)}%` : '—';
              return (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionMode}>
                      {s.mode === 'simulation' ? '🏆 סימולציה' : s.mode === 'speed' ? '⚡ מהירות' : s.mode === 'adaptive' ? '🧠 אדפטיבי' : '📝 תרגול'}
                      {topic ? ` · ${topic.icon} ${topic.name}` : ''}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {s.correct_answers}/{s.total_questions} נכון · ציון {score} · {date}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Dates */}
        <View style={[styles.section, { gap: 6 }]}>
          <Text style={styles.sectionTitle}>📅 תאריכים</Text>
          <Text style={styles.dateText}>הצטרף: {new Date(user.created_at).toLocaleString('he-IL')}</Text>
          {user.last_practiced_date && (
            <Text style={styles.dateText}>תרגל לאחרונה: {user.last_practiced_date}</Text>
          )}
          <Text style={styles.dateText}>עדכון אחרון: {new Date(user.updated_at).toLocaleString('he-IL')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Small components ───────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatIcon}>{icon}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },

  statsBar: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    paddingVertical: 8,
  },
  statChipValue: { fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.primary },
  statChipLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },

  controlRow: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.primary },

  sortScroll: { maxHeight: 44 },
  sortChips: { paddingHorizontal: 12, gap: 8, flexDirection: 'row-reverse' },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipWarning: { backgroundColor: Colors.warning + '30', borderColor: Colors.warning },
  sortChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  sortChipTextActive: { color: '#fff' },

  resultCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    paddingHorizontal: 14,
    paddingBottom: 4,
  },

  list: { padding: 12, gap: 10, paddingBottom: 40 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textSecondary },
  emptyHint: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },

  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    ...Shadow.sm,
  },
  userCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  userAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
  },
  userAvatarText: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.primary,
  },
  userMainInfo: { flex: 1 },
  userName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  userId: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  userLevelBadge: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  userLevelText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary },

  userStats: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  miniStat: { alignItems: 'center', gap: 2 },
  miniStatIcon: { fontSize: 14 },
  miniStatValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  miniStatLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },

  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  perfPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  perfPillText: { fontFamily: FontFamily.medium, fontSize: 11 },

  userJoined: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
  },

  // Detail screen
  backBtn: { alignSelf: 'flex-end', marginBottom: 16, minHeight: 44, justifyContent: 'center' },
  backBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  detailHeader: { alignItems: 'center', marginBottom: 20, gap: 6 },
  detailName: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.text },
  detailSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary },

  detailGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  detailStatCard: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  detailStatIcon: { fontSize: 22 },
  detailStatValue: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.primary },
  detailStatLabel: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.textTertiary },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 10,
  },

  actionBtn: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primaryLighter,
    borderColor: Colors.primary + '60',
  },
  actionBtnWarning: {
    backgroundColor: Colors.warning + '20',
    borderColor: Colors.warning + '60',
  },
  actionBtnDanger: {
    backgroundColor: Colors.danger + '20',
    borderColor: Colors.danger + '60',
  },
  actionBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },

  sessionRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionMode: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  sessionMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  dateText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
});
