import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { TOPICS } from '../../data/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { StatCard } from '../../components/StatCard';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { eloToTitle, eloToLevel, eloToProgress } from '../../utils/elo';

const BADGE_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  first_session: { icon: '🌱', label: 'סשן ראשון', desc: 'השלמת את הסשן הראשון שלך' },
  streak_7: { icon: '🔥', label: 'שבוע רצוף', desc: '7 ימי תרגול ברצף' },
  streak_30: { icon: '🌟', label: 'חודש רצוף!', desc: '30 ימי תרגול ברצף' },
  perfect_score: { icon: '💯', label: 'ניקוד מושלם', desc: '100% בסשן אחד' },
  speed_master: { icon: '⚡', label: 'מהיר כברק', desc: 'ענית נכון ב-< 10 שניות על 5 שאלות' },
  topic_complete: { icon: '🏆', label: 'נושא הושלם', desc: 'השלמת נושא שלם' },
  simulation_pass: { icon: '🎖️', label: 'עבר סימולציה', desc: 'עברת סימולציה בהצלחה' },
  level_up: { icon: '⬆️', label: 'רמה חדשה!', desc: 'עלית רמה' },
};

const ALL_BADGES = Object.entries(BADGE_INFO).map(([type, info]) => ({ type, ...info }));

export default function ProgressTab() {
  const {
    name, level, xp, streak, longestStreak,
    totalSessions, totalCorrect, totalAnswered,
    badges, selectedTargetId, getTopicElo,
  } = useUserStore();

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const topics = TOPICS.filter(t => t.targetId === selectedTargetId);
  const earnedBadgeTypes = new Set(badges.map(b => b.badgeType));
  const xpForNext = level * 100;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>ההתקדמות שלי</Text>

        {/* Level card */}
        <LinearGradient
          colors={Colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.levelCard}
        >
          <View style={styles.levelTop}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNum}>{level}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>רמה {level}</Text>
              <Text style={styles.levelXp}>{xp} / {xpForNext} XP לרמה הבאה</Text>
            </View>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.min(100, (xp / xpForNext) * 100)}%` }]} />
          </View>
        </LinearGradient>

        {/* Stats grid */}
        <Text style={styles.sectionTitle}>סטטיסטיקות כלליות</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="🎯" label="סשנים" value={totalSessions} color={Colors.primary} />
          <StatCard icon="✅" label="נכון" value={totalCorrect} color={Colors.success} />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard icon="📊" label="דיוק" value={`${accuracy}%`} color={Colors.accent} />
          <StatCard icon="🔥" label="רצף" value={`${streak} ימים`} color={Colors.warning} />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard icon="🏅" label="רצף שיא" value={`${longestStreak} ימים`} color={Colors.gold} />
          <StatCard icon="📝" label="סה״כ שאלות" value={totalAnswered} color={Colors.textSecondary} />
        </View>

        {/* Streak calendar (simplified) */}
        <Text style={styles.sectionTitle}>🔥 הרצף שלי</Text>
        <View style={styles.streakCard}>
          <View style={styles.streakRow}>
            {Array.from({ length: 7 }).map((_, i) => {
              const isToday = i === 6;
              const active = i >= 7 - Math.min(streak, 7);
              return (
                <View
                  key={i}
                  style={[
                    styles.streakDay,
                    active && { backgroundColor: Colors.warning },
                    isToday && { borderWidth: 2, borderColor: Colors.primary },
                  ]}
                >
                  <Text style={[styles.streakDayText, active && { color: '#fff' }]}>
                    {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][i]}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.streakSummary}>
            {streak === 0
              ? 'התחל לתרגל היום!'
              : `${streak} ימים ברצף 🔥 — כל הכבוד!`}
          </Text>
        </View>

        {/* ELO per topic */}
        <Text style={styles.sectionTitle}>ELO לפי נושא</Text>
        <View style={styles.eloContainer}>
          {topics.map(topic => {
            const elo = getTopicElo(topic.id);
            const progress = eloToProgress(elo);
            return (
              <View key={topic.id} style={styles.eloRow}>
                <View style={styles.eloLeft}>
                  <Text style={styles.eloIcon}>{topic.icon}</Text>
                  <View>
                    <Text style={styles.eloTopicName}>{topic.name}</Text>
                    <Text style={[styles.eloTitle, { color: topic.color }]}>
                      {eloToTitle(elo)}
                    </Text>
                  </View>
                </View>
                <View style={styles.eloRight}>
                  <Text style={[styles.eloValue, { color: topic.color }]}>{elo}</Text>
                  <View style={styles.eloBar}>
                    <ProgressBar progress={progress} color={topic.color} height={5} />
                  </View>
                </View>
              </View>
            );
          })}
          {topics.length === 0 && (
            <Text style={styles.emptyText}>
              השלם לפחות סשן אחד כדי לראות את ה-ELO שלך
            </Text>
          )}
        </View>

        {/* Badges */}
        <Text style={styles.sectionTitle}>הישגים ועיטורים</Text>
        <View style={styles.badgesGrid}>
          {ALL_BADGES.map(badge => {
            const earned = earnedBadgeTypes.has(badge.type as any);
            return (
              <View
                key={badge.type}
                style={[styles.badgeCard, !earned && styles.badgeCardLocked]}
              >
                <Text style={[styles.badgeIcon, !earned && { opacity: 0.3 }]}>
                  {badge.icon}
                </Text>
                <Text style={[styles.badgeLabel, !earned && { color: Colors.textTertiary }]}>
                  {badge.label}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>
                  {badge.desc}
                </Text>
                {earned && (
                  <View style={styles.earnedBadge}>
                    <Text style={styles.earnedText}>✓</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 20,
  },

  levelCard: {
    borderRadius: Radius.xl,
    padding: 20,
    marginBottom: 24,
    ...Shadow.primary,
  },
  levelTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  levelInfo: { flex: 1, alignItems: 'flex-end' },
  levelTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: '#fff' },
  levelXp: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  xpTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: { height: 8, backgroundColor: '#fff', borderRadius: 4 },

  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: { flexDirection: 'row-reverse', gap: 10 },

  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 8,
    ...Shadow.md,
  },
  streakRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  streakDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  streakSummary: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  eloContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 4,
    marginBottom: 8,
    ...Shadow.md,
  },
  eloRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  eloLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 },
  eloIcon: { fontSize: 22 },
  eloTopicName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  eloTitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, textAlign: 'right' },
  eloRight: { alignItems: 'flex-start', width: 100 },
  eloValue: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  eloBar: { width: 90, marginTop: 4 },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    padding: 20,
  },

  badgesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'flex-end',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeCardLocked: { backgroundColor: Colors.surfaceSecondary },
  badgeIcon: { fontSize: 32, marginBottom: 6 },
  badgeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 3,
  },
  badgeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'right',
    lineHeight: 16,
  },
  earnedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnedText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
});
