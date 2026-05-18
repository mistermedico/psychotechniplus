import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

// ── Mock user data ─────────────────────────────────────────────────────────

type UserStatus = 'active' | 'suspended';
type UserPlan = 'free' | 'premium';

interface MockUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  lastActiveAt: string;
  status: UserStatus;
  plan: UserPlan;
  stats: { totalSessions: number; totalCorrect: number; totalAnswered: number; streak: number; level: number };
  topicElos: Record<string, number>;
}

const INITIAL_USERS: MockUser[] = [
  {
    id: 'u001', name: 'יונתן לוי', email: 'yonatan.levi@gmail.com',
    joinedAt: '2025-01-05', lastActiveAt: '2025-05-16',
    status: 'active', plan: 'premium',
    stats: { totalSessions: 87, totalCorrect: 1243, totalAnswered: 1540, streak: 14, level: 7 },
    topicElos: { topic_quantitative: 1480, topic_verbal: 1350, topic_logic: 1520, topic_spatial: 1290 },
  },
  {
    id: 'u002', name: 'מיכל כהן', email: 'michal.cohen@outlook.com',
    joinedAt: '2025-01-12', lastActiveAt: '2025-05-14',
    status: 'active', plan: 'premium',
    stats: { totalSessions: 124, totalCorrect: 2180, totalAnswered: 2650, streak: 31, level: 9 },
    topicElos: { topic_quantitative: 1620, topic_verbal: 1580, topic_logic: 1540, topic_spatial: 1450 },
  },
  {
    id: 'u003', name: 'אור שמיר', email: 'or.shamir@gmail.com',
    joinedAt: '2025-02-03', lastActiveAt: '2025-05-10',
    status: 'active', plan: 'free',
    stats: { totalSessions: 23, totalCorrect: 298, totalAnswered: 460, streak: 3, level: 3 },
    topicElos: { topic_quantitative: 1150, topic_verbal: 1120, topic_logic: 1080, topic_spatial: 1200 },
  },
  {
    id: 'u004', name: 'תמר אברהם', email: 'tamar.a@walla.co.il',
    joinedAt: '2025-02-18', lastActiveAt: '2025-05-15',
    status: 'active', plan: 'free',
    stats: { totalSessions: 45, totalCorrect: 612, totalAnswered: 890, streak: 7, level: 5 },
    topicElos: { topic_quantitative: 1280, topic_verbal: 1320, topic_logic: 1260, topic_spatial: 1190 },
  },
  {
    id: 'u005', name: 'רון פרידמן', email: 'ron.f@company.com',
    joinedAt: '2025-01-28', lastActiveAt: '2025-04-20',
    status: 'suspended', plan: 'free',
    stats: { totalSessions: 11, totalCorrect: 87, totalAnswered: 220, streak: 0, level: 2 },
    topicElos: { topic_quantitative: 1050, topic_verbal: 980, topic_logic: 1030, topic_spatial: 1010 },
  },
  {
    id: 'u006', name: 'נועה ברק', email: 'noa.barak@gmail.com',
    joinedAt: '2025-03-05', lastActiveAt: '2025-05-17',
    status: 'active', plan: 'premium',
    stats: { totalSessions: 66, totalCorrect: 1050, totalAnswered: 1300, streak: 22, level: 6 },
    topicElos: { topic_quantitative: 1390, topic_verbal: 1410, topic_logic: 1360, topic_spatial: 1320 },
  },
  {
    id: 'u007', name: 'עידו שפירא', email: 'ido.sh@hotmail.com',
    joinedAt: '2025-03-20', lastActiveAt: '2025-05-13',
    status: 'active', plan: 'free',
    stats: { totalSessions: 19, totalCorrect: 245, totalAnswered: 380, streak: 5, level: 3 },
    topicElos: { topic_quantitative: 1180, topic_verbal: 1140, topic_logic: 1210, topic_spatial: 1130 },
  },
  {
    id: 'u008', name: 'שירה גולן', email: 'shira.golan@gmail.com',
    joinedAt: '2025-04-01', lastActiveAt: '2025-05-16',
    status: 'active', plan: 'premium',
    stats: { totalSessions: 38, totalCorrect: 571, totalAnswered: 760, streak: 10, level: 5 },
    topicElos: { topic_quantitative: 1310, topic_verbal: 1350, topic_logic: 1280, topic_spatial: 1240 },
  },
  {
    id: 'u009', name: 'אלון מזרחי', email: 'alon.mizrahi@gmail.com',
    joinedAt: '2025-04-15', lastActiveAt: '2025-05-12',
    status: 'active', plan: 'free',
    stats: { totalSessions: 8, totalCorrect: 95, totalAnswered: 160, streak: 2, level: 2 },
    topicElos: { topic_quantitative: 1080, topic_verbal: 1060, topic_logic: 1100, topic_spatial: 1050 },
  },
  {
    id: 'u010', name: 'דניאל רוזנברג', email: 'daniel.r@icloud.com',
    joinedAt: '2025-05-01', lastActiveAt: '2025-05-17',
    status: 'active', plan: 'free',
    stats: { totalSessions: 5, totalCorrect: 47, totalAnswered: 80, streak: 5, level: 1 },
    topicElos: { topic_quantitative: 1200, topic_verbal: 1200, topic_logic: 1200, topic_spatial: 1200 },
  },
  {
    id: 'u011', name: 'ליאת הרשקוביץ', email: 'liat.h@gmail.com',
    joinedAt: '2025-01-20', lastActiveAt: '2025-03-10',
    status: 'suspended', plan: 'free',
    stats: { totalSessions: 3, totalCorrect: 14, totalAnswered: 30, streak: 0, level: 1 },
    topicElos: { topic_quantitative: 950, topic_verbal: 1000, topic_logic: 920, topic_spatial: 980 },
  },
  {
    id: 'u012', name: 'גיל טוב', email: 'gil.tov@outlook.com',
    joinedAt: '2025-02-10', lastActiveAt: '2025-05-11',
    status: 'active', plan: 'premium',
    stats: { totalSessions: 103, totalCorrect: 1720, totalAnswered: 2100, streak: 18, level: 8 },
    topicElos: { topic_quantitative: 1550, topic_verbal: 1490, topic_logic: 1580, topic_spatial: 1420 },
  },
];

const TOPIC_NAMES: Record<string, string> = {
  topic_quantitative: 'כמותי',
  topic_verbal: 'מילולי',
  topic_logic: 'לוגי',
  topic_spatial: 'מרחבי',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function UsersAdmin() {
  const { getUserNote, setUserNote } = useAdminStore();
  const [users, setUsers] = useState<MockUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | UserStatus>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | UserPlan>('all');
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !search || u.name.includes(search) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || u.status === filterStatus;
      const matchPlan = filterPlan === 'all' || u.plan === filterPlan;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [users, search, filterStatus, filterPlan]);

  const updateUser = (id: string, updates: Partial<MockUser>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    if (selectedUser?.id === id) setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleSuspend = (user: MockUser) => {
    const next = user.status === 'active' ? 'suspended' : 'active';
    const label = next === 'suspended' ? 'השהיית' : 'שחרור';
    Alert.alert(`${label} משתמש`, `האם ל${label} את ${user.name}?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: label, style: next === 'suspended' ? 'destructive' : 'default', onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateUser(user.id, { status: next });
      }},
    ]);
  };

  const handleTogglePlan = (user: MockUser) => {
    const next: UserPlan = user.plan === 'free' ? 'premium' : 'free';
    Alert.alert('שינוי תוכנית', `לשנות את ${user.name} ל-${next === 'premium' ? 'פרמיום 💎' : 'חינמי'}?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'שנה', onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateUser(user.id, { plan: next });
      }},
    ]);
  };

  const handleResetProgress = (user: MockUser) => {
    Alert.alert('איפוס התקדמות', `לאפס את כל ההתקדמות של ${user.name}? פעולה זו בלתי הפיכה.`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'אפס', style: 'destructive', onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const resetElos: Record<string, number> = {};
        Object.keys(user.topicElos).forEach(k => { resetElos[k] = 1200; });
        updateUser(user.id, {
          stats: { totalSessions: 0, totalCorrect: 0, totalAnswered: 0, streak: 0, level: 1 },
          topicElos: resetElos,
        });
      }},
    ]);
  };

  // ── Detail sheet ──────────────────────────────────────────────────────────

  if (selectedUser) {
    const u = selectedUser;
    const accuracy = u.stats.totalAnswered > 0
      ? Math.round((u.stats.totalCorrect / u.stats.totalAnswered) * 100)
      : 0;

    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Back */}
          <Pressable onPress={() => setSelectedUser(null)} style={styles.backRow}>
            <Text style={styles.backArrow}>→</Text>
            <Text style={styles.backLabel}>חזרה לרשימה</Text>
          </Pressable>

          {/* User hero */}
          <View style={[styles.userHero, u.status === 'suspended' && { borderColor: Colors.danger, borderWidth: 2 }]}>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarLgText}>{u.name[0]}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{u.name}</Text>
              <Text style={styles.heroEmail}>{u.email}</Text>
              <View style={styles.heroBadges}>
                <View style={[styles.badge, { backgroundColor: u.plan === 'premium' ? Colors.warning + '20' : Colors.surfaceSecondary }]}>
                  <Text style={[styles.badgeText, { color: u.plan === 'premium' ? Colors.warning : Colors.textTertiary }]}>
                    {u.plan === 'premium' ? '💎 פרמיום' : '🆓 חינמי'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: u.status === 'active' ? Colors.successLight : Colors.dangerLight }]}>
                  <Text style={[styles.badgeText, { color: u.status === 'active' ? Colors.success : Colors.danger }]}>
                    {u.status === 'active' ? '✅ פעיל' : '🚫 מושהה'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Dates */}
          <View style={styles.datesRow}>
            <Text style={styles.dateItem}>הצטרף: {u.joinedAt}</Text>
            <Text style={styles.dateItem}>פעיל לאחרונה: {u.lastActiveAt}</Text>
          </View>

          {/* Stats */}
          <Text style={styles.sectionTitle}>סטטיסטיקות</Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'סשנים', value: u.stats.totalSessions, icon: '🎯' },
              { label: 'דיוק', value: `${accuracy}%`, icon: '✅' },
              { label: 'רצף', value: `${u.stats.streak}🔥`, icon: '' },
              { label: 'רמה', value: u.stats.level, icon: '⬆️' },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ELO per topic */}
          <Text style={styles.sectionTitle}>ELO לפי נושא</Text>
          <View style={styles.eloCard}>
            {Object.entries(u.topicElos).map(([topicId, elo]) => (
              <View key={topicId} style={styles.eloRow}>
                <View style={styles.eloBarWrap}>
                  <View style={[styles.eloBarFill, { width: `${Math.min(100, ((elo - 900) / 900) * 100)}%` }]} />
                </View>
                <Text style={styles.eloValue}>{elo}</Text>
                <Text style={styles.eloLabel}>{TOPIC_NAMES[topicId] ?? topicId}</Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <Text style={styles.sectionTitle}>פעולות</Text>
          <View style={styles.actionsColumn}>
            <Pressable
              onPress={() => handleTogglePlan(u)}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.warning + '20' }, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.actionBtnText, { color: Colors.warning }]}>
                {u.plan === 'premium' ? '🔽 הורד לחינמי' : '💎 שדרג לפרמיום'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSuspend(u)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: u.status === 'active' ? Colors.dangerLight : Colors.successLight },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.actionBtnText, { color: u.status === 'active' ? Colors.danger : Colors.success }]}>
                {u.status === 'active' ? '🚫 השהה משתמש' : '✅ בטל השהייה'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleResetProgress(u)}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.surfaceSecondary }, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.actionBtnText, { color: Colors.danger }]}>🗑️ אפס כל ההתקדמות</Text>
            </Pressable>
          </View>

          {/* Admin note */}
          <Text style={styles.sectionTitle}>📝 הערת מנהל</Text>
          <NoteEditor userId={u.id} />

          {/* Session History */}
          <UserSessionHistory userId={u.id} />

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── User list ─────────────────────────────────────────────────────────────

  const totalActive = users.filter(u => u.status === 'active').length;
  const totalPremium = users.filter(u => u.plan === 'premium').length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryVal}>{users.length}</Text>
            <Text style={styles.summaryLbl}>משתמשים</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: Colors.success }]}>{totalActive}</Text>
            <Text style={styles.summaryLbl}>פעילים</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: Colors.warning }]}>{totalPremium}</Text>
            <Text style={styles.summaryLbl}>פרמיום</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: Colors.danger }]}>{users.length - totalActive}</Text>
            <Text style={styles.summaryLbl}>מושהים</Text>
          </View>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם או אימייל..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />

        {/* Filters */}
        <View style={styles.filtersRow}>
          {/* Status filter */}
          <View style={styles.filterGroup}>
            {(['all', 'active', 'suspended'] as const).map(s => (
              <Pressable
                key={s}
                onPress={() => setFilterStatus(s)}
                style={[styles.filterChip, filterStatus === s && { backgroundColor: Colors.primary }]}
              >
                <Text style={[styles.filterChipText, filterStatus === s && { color: '#fff' }]}>
                  {s === 'all' ? 'הכל' : s === 'active' ? 'פעילים' : 'מושהים'}
                </Text>
              </Pressable>
            ))}
          </View>
          {/* Plan filter */}
          <View style={styles.filterGroup}>
            {(['all', 'free', 'premium'] as const).map(p => (
              <Pressable
                key={p}
                onPress={() => setFilterPlan(p)}
                style={[styles.filterChip, filterPlan === p && { backgroundColor: Colors.warning }]}
              >
                <Text style={[styles.filterChipText, filterPlan === p && { color: '#fff' }]}>
                  {p === 'all' ? 'כל התוכניות' : p === 'free' ? 'חינמי' : 'פרמיום 💎'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Results count */}
        <Text style={styles.resultCount}>{filtered.length} משתמשים</Text>

        {/* User cards */}
        {filtered.map(user => {
          const accuracy = user.stats.totalAnswered > 0
            ? Math.round((user.stats.totalCorrect / user.stats.totalAnswered) * 100)
            : 0;
          return (
            <Pressable
              key={user.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedUser(user);
              }}
              style={({ pressed }) => [
                styles.userCard,
                user.status === 'suspended' && styles.userCardSuspended,
                pressed && { opacity: 0.85 },
              ]}
            >
              {/* Left: avatar */}
              <View style={[styles.avatar, { backgroundColor: user.plan === 'premium' ? Colors.warning + '30' : Colors.primaryLighter }]}>
                <Text style={styles.avatarText}>{user.name[0]}</Text>
              </View>

              {/* Middle: info */}
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{user.name}</Text>
                  {user.plan === 'premium' && <Text style={styles.premiumBadge}>💎</Text>}
                  {user.status === 'suspended' && <Text style={styles.suspendedBadge}>🚫</Text>}
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                <View style={styles.userMiniStats}>
                  <Text style={styles.miniStat}>🎯 {user.stats.totalSessions} סשנים</Text>
                  <Text style={styles.miniStat}>✅ {accuracy}%</Text>
                  <Text style={styles.miniStat}>🔥 {user.stats.streak}</Text>
                  <Text style={styles.miniStat}>Lv.{user.stats.level}</Text>
                </View>
              </View>

              {/* Right: quick toggle */}
              <View style={styles.userActions}>
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); handleSuspend(user); }}
                  style={[styles.quickBtn, { backgroundColor: user.status === 'active' ? Colors.successLight : Colors.dangerLight }]}
                >
                  <Text style={{ fontSize: 14 }}>{user.status === 'active' ? '✅' : '🚫'}</Text>
                </Pressable>
                <Text style={styles.detailArrow}>←</Text>
              </View>
            </Pressable>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>לא נמצאו משתמשים</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 12, alignItems: 'center', ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  summaryVal: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text },
  summaryLbl: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },

  searchInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },

  filtersRow: { gap: 8, marginBottom: 12 },
  filterGroup: { flexDirection: 'row-reverse', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  resultCount: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary,
    textAlign: 'right', marginBottom: 8,
  },

  userCard: {
    flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 14, marginBottom: 10, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 12,
  },
  userCardSuspended: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight + '30' },

  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },

  userInfo: { flex: 1, alignItems: 'flex-end' },
  userNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  userName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  premiumBadge: { fontSize: 14 },
  suspendedBadge: { fontSize: 14 },
  userEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  userMiniStats: { flexDirection: 'row-reverse', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  miniStat: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textSecondary },

  userActions: { alignItems: 'center', gap: 8 },
  quickBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detailArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textTertiary },

  // Detail view
  backRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    marginBottom: 16, paddingVertical: 4,
  },
  backArrow: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.primary },
  backLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  userHero: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 20,
    flexDirection: 'row-reverse', gap: 16, alignItems: 'center',
    ...Shadow.md, marginBottom: 12,
  },
  avatarLg: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryLighter, alignItems: 'center', justifyContent: 'center',
  },
  avatarLgText: { fontFamily: FontFamily.bold, fontSize: 32, color: Colors.primary },
  heroInfo: { flex: 1, alignItems: 'flex-end' },
  heroName: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text },
  heroEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 },
  heroBadges: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  badgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  datesRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  dateItem: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },

  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text,
    textAlign: 'right', marginBottom: 10, marginTop: 4,
  },

  statsGrid: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    alignItems: 'center', ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.primary },
  statLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },

  eloCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16,
    ...Shadow.sm, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  eloRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  eloLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, width: 48, textAlign: 'right' },
  eloValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary, width: 40, textAlign: 'left' },
  eloBarWrap: { flex: 1, height: 8, backgroundColor: Colors.surfaceTertiary, borderRadius: 4, overflow: 'hidden' },
  eloBarFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  actionsColumn: { gap: 10, marginBottom: 24 },
  actionBtn: {
    borderRadius: Radius.xl, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
});

// ── Note Editor ───────────────────────────────────────────────────────────

function NoteEditor({ userId }: { userId: string }) {
  const { getUserNote, setUserNote } = useAdminStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(getUserNote(userId));
  const note = getUserNote(userId);

  const handleSave = () => {
    setUserNote(userId, draft.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
  };

  return (
    <View style={noteStyles.container}>
      {editing ? (
        <>
          <TextInput
            style={noteStyles.input}
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlign="right"
            textAlignVertical="top"
            placeholder="כתוב הערה על המשתמש..."
            placeholderTextColor={Colors.textTertiary}
            numberOfLines={4}
            autoFocus
          />
          <View style={noteStyles.btnRow}>
            <Pressable onPress={() => setEditing(false)} style={noteStyles.cancelBtn}>
              <Text style={noteStyles.cancelText}>ביטול</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={noteStyles.saveBtn}>
              <Text style={noteStyles.saveText}>שמור</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable onPress={() => { setDraft(note); setEditing(true); }} style={noteStyles.noteDisplay}>
          {note ? (
            <Text style={noteStyles.noteText}>{note}</Text>
          ) : (
            <Text style={noteStyles.notePlaceholder}>לחץ להוספת הערה...</Text>
          )}
          <Text style={noteStyles.editHint}>✏️ עריכה</Text>
        </Pressable>
      )}
    </View>
  );
}

const noteStyles = StyleSheet.create({
  container: { marginBottom: 24 },
  noteDisplay: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10,
    ...Shadow.sm,
  },
  noteText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },
  notePlaceholder: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'right' },
  editHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.primary,
    padding: 14, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text,
    minHeight: 100, marginBottom: 8,
  },
  btnRow: { flexDirection: 'row-reverse', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 12, borderRadius: Radius.xl, alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
  saveBtn: { flex: 2, padding: 12, borderRadius: Radius.xl, alignItems: 'center', backgroundColor: Colors.primary },
  saveText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});

// ── Session History ────────────────────────────────────────────────────────

function UserSessionHistory({ userId }: { userId: string }) {
  const { sessionHistory, loadSessionHistory } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sessions = sessionHistory.filter(r => r.userId === userId);

  useEffect(() => {
    setLoading(true);
    loadSessionHistory(userId).finally(() => setLoading(false));
  }, [userId]);

  const modeLabel = (mode: string) => {
    const map: Record<string, string> = {
      practice: 'תרגול', speed: 'מהירות ⚡', simulation: 'סימולציה 🏆',
      review: 'חזרה', adaptive: 'אדפטיבי 🧠',
    };
    return map[mode] ?? mode;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}ש׳`;
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return iso.slice(0, 10); }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={histStyles.title}>היסטוריית תרגול ({sessions.length})</Text>

      {loading && sessions.length === 0 && (
        <Text style={histStyles.loading}>טוען היסטוריה...</Text>
      )}

      {!loading && sessions.length === 0 && (
        <View style={histStyles.empty}>
          <Text style={histStyles.emptyText}>אין היסטוריה זמינה עדיין</Text>
          <Text style={histStyles.emptyHint}>היסטוריה תיצבר מסשנים שיתבצעו מכאן ואילך</Text>
        </View>
      )}

      {sessions.slice(0, 30).map(s => {
        const accuracy = s.totalQuestions > 0
          ? Math.round((s.correctAnswers / s.totalQuestions) * 100)
          : 0;
        const isOpen = expanded === s.id;
        const scoreColor = accuracy >= 80 ? Colors.success : accuracy >= 60 ? Colors.warning : Colors.danger;
        return (
          <Pressable
            key={s.id}
            onPress={() => setExpanded(isOpen ? null : s.id)}
            style={histStyles.sessionCard}
          >
            <View style={histStyles.sessionHeader}>
              <View style={histStyles.sessionLeft}>
                <Text style={histStyles.sessionMode}>{modeLabel(s.mode)}</Text>
                {s.templateName ? (
                  <Text style={histStyles.sessionTemplate} numberOfLines={1}>{s.templateName}</Text>
                ) : null}
                <Text style={histStyles.sessionDate}>{formatDate(s.completedAt)}</Text>
              </View>
              <View style={histStyles.sessionRight}>
                <View style={[histStyles.scoreBadge, { backgroundColor: scoreColor + '25' }]}>
                  <Text style={[histStyles.scoreText, { color: scoreColor }]}>{accuracy}%</Text>
                </View>
                <Text style={histStyles.sessionStats}>
                  {s.correctAnswers}/{s.totalQuestions} ✓{'  '}{formatTime(s.timeSpentSeconds)}
                </Text>
                {s.skippedQuestions > 0 && (
                  <Text style={histStyles.skipped}>{s.skippedQuestions} דולגו</Text>
                )}
              </View>
            </View>

            {isOpen && s.answers.length > 0 && (
              <View style={histStyles.answersSection}>
                <View style={histStyles.answersGrid}>
                  {s.answers.map((a, idx) => (
                    <View
                      key={`${a.questionId}_${idx}`}
                      style={[
                        histStyles.answerDot,
                        {
                          backgroundColor: a.isSkipped
                            ? Colors.textTertiary
                            : a.isCorrect
                            ? Colors.success
                            : Colors.danger,
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={histStyles.legendRow}>
                  <View style={histStyles.legendItem}>
                    <View style={[histStyles.legendDot, { backgroundColor: Colors.success }]} />
                    <Text style={histStyles.legendText}>נכון</Text>
                  </View>
                  <View style={histStyles.legendItem}>
                    <View style={[histStyles.legendDot, { backgroundColor: Colors.danger }]} />
                    <Text style={histStyles.legendText}>שגוי</Text>
                  </View>
                  <View style={histStyles.legendItem}>
                    <View style={[histStyles.legendDot, { backgroundColor: Colors.textTertiary }]} />
                    <Text style={histStyles.legendText}>דולג</Text>
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const histStyles = StyleSheet.create({
  title: {
    fontFamily: FontFamily.heading, fontSize: FontSize.lg, color: Colors.text,
    textAlign: 'right', marginBottom: 10, marginTop: 4,
  },
  loading: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'right', paddingVertical: 12,
  },
  empty: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16,
    alignItems: 'flex-end', borderWidth: 1, borderColor: Colors.border,
    marginBottom: 24,
  },
  emptyText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  emptyHint: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary,
    marginTop: 4, textAlign: 'right',
  },
  sessionCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  sessionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionLeft: { alignItems: 'flex-end', flex: 1, gap: 2 },
  sessionRight: { alignItems: 'flex-end', gap: 3 },
  sessionMode: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  sessionTemplate: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.primary,
    maxWidth: 160, textAlign: 'right',
  },
  sessionDate: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  scoreText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  sessionStats: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  skipped: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.warning },

  answersSection: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  answersGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5 },
  answerDot: { width: 13, height: 13, borderRadius: 7 },
  legendRow: {
    flexDirection: 'row-reverse', gap: 14, marginTop: 8,
  },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
});
