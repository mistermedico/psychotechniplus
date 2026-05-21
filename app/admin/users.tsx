import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, RefreshControl,
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
  topicElos: Record<string, number>;
}

type SortKey = 'sessions' | 'level' | 'streak' | 'correct_rate' | 'joined';

export default function UsersScreen() {
  const [users, setUsers] = useState<RealUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sessions');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      // 1. Load all user profiles
      const { data: profiles, error: pe } = await supabase
        .from('user_profiles')
        .select('*')
        .order('total_sessions', { ascending: false });

      if (pe) { logger.error('users:load', 'שגיאה בטעינת משתמשים', pe.message); return; }
      if (!profiles?.length) { setUsers([]); return; }

      // 2. Load all ELOs in one query
      const userIds = profiles.map(p => p.id);
      const { data: elosData } = await supabase
        .from('user_elos')
        .select('user_id, topic_id, elo')
        .in('user_id', userIds);

      // Build ELO map per user
      const eloMap: Record<string, Record<string, number>> = {};
      (elosData ?? []).forEach(row => {
        if (!eloMap[row.user_id]) eloMap[row.user_id] = {};
        eloMap[row.user_id][row.topic_id] = row.elo;
      });

      // 3. Load auth emails from sessions (best-effort)
      const combined: RealUser[] = profiles.map(p => ({
        id: p.id,
        name: p.name || 'ללא שם',
        selected_target_id: p.selected_target_id,
        has_completed_onboarding: p.has_completed_onboarding ?? false,
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
        topicElos: eloMap[p.id] ?? {},
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
  }, [users, search, sortKey]);

  const selectedUser = users.find(u => u.id === selectedUserId);

  const stats = useMemo(() => ({
    total: users.length,
    withSessions: users.filter(u => u.total_sessions > 0).length,
    avgLevel: users.length ? Math.round(users.reduce((s, u) => s + u.level, 0) / users.length * 10) / 10 : 0,
    avgSessions: users.length ? Math.round(users.reduce((s, u) => s + u.total_sessions, 0) / users.length) : 0,
    activeToday: users.filter(u => {
      if (!u.last_practiced_date) return false;
      return u.last_practiced_date === new Date().toDateString();
    }).length,
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
    return <UserDetailScreen user={selectedUser} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <StatChip label="סה״כ" value={String(stats.total)} />
        <StatChip label="פעילים" value={String(stats.withSessions)} />
        <StatChip label="רמה ממוצעת" value={String(stats.avgLevel)} />
        <StatChip label="סשנים ממוצע" value={String(stats.avgSessions)} />
      </View>

      {/* Search + sort */}
      <View style={styles.controlRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 חפש משתמש..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      {/* Sort chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortChips} style={styles.sortScroll}>
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
            const topElos = Object.entries(u.topicElos).sort(([,a],[,b]) => b - a).slice(0, 2);

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
                    <Text style={styles.userName}>{u.name}</Text>
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

                {topElos.length > 0 && (
                  <View style={styles.eloRow}>
                    {topElos.map(([topicId, elo]) => {
                      const topic = TOPICS.find(t => t.id === topicId);
                      return (
                        <View key={topicId} style={styles.eloPill}>
                          <Text style={styles.eloPillText}>
                            {topic?.icon ?? '📚'} {topic?.name ?? topicId}: {elo}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.userJoined}>הצטרף: {joinDate}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── User Detail Screen ─────────────────────────────────────────────────────

function UserDetailScreen({ user, onBack }: { user: RealUser; onBack: () => void }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

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

  const target = TARGETS.find(t => t.id === user.selected_target_id);
  const correctRate = user.total_answered > 0
    ? Math.round((user.total_correct / user.total_answered) * 100)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Back */}
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← חזרה לרשימה</Text>
        </Pressable>

        {/* User header */}
        <View style={styles.detailHeader}>
          <View style={[styles.userAvatarCircle, { width: 64, height: 64, borderRadius: 32 }]}>
            <Text style={[styles.userAvatarText, { fontSize: 28 }]}>
              {user.name.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.detailName}>{user.name}</Text>
          <Text style={styles.detailSub}>{target ? `${target.icon} ${target.name}` : 'ללא מסלול'}</Text>
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

        {/* ELOs */}
        {Object.keys(user.topicElos).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 ELO לפי נושא</Text>
            {Object.entries(user.topicElos)
              .sort(([,a],[,b]) => b - a)
              .map(([topicId, elo]) => {
                const topic = TOPICS.find(t => t.id === topicId);
                const pct = Math.min(100, Math.max(0, ((elo - 800) / 800) * 100));
                return (
                  <View key={topicId} style={styles.eloBarRow}>
                    <Text style={styles.eloBarLabel}>{topic?.icon ?? '📚'} {topic?.name ?? topicId}</Text>
                    <View style={styles.eloBarBg}>
                      <View style={[styles.eloBarFill, { width: `${pct}%` as any, backgroundColor: topic?.color ?? Colors.primary }]} />
                    </View>
                    <Text style={styles.eloBarValue}>{elo}</Text>
                  </View>
                );
              })}
          </View>
        )}

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
                      {s.mode === 'simulation' ? '🏆 סימולציה' : s.mode === 'speed' ? '⚡ מהירות' : '📝 תרגול'}
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

  controlRow: { paddingHorizontal: 12, paddingVertical: 8 },
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

  sortScroll: { maxHeight: 44 },
  sortChips: { paddingHorizontal: 12, gap: 8, flexDirection: 'row-reverse' },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
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

  eloRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  eloPill: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eloPillText: { fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textSecondary },

  userJoined: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
  },

  // Detail screen
  backBtn: { alignSelf: 'flex-end', marginBottom: 16 },
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

  eloBarRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  eloBarLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 90,
    textAlign: 'right',
  },
  eloBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  eloBarFill: { height: '100%', borderRadius: 4 },
  eloBarValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primary,
    width: 40,
    textAlign: 'right',
  },

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
