import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { logger } from '../../utils/logger';

const EXCLUDED_KEY = '@admin/leaderboard-excluded';

interface LeaderEntry {
  id: string;
  name: string;
  elo: number;
  sessions: number;
  streak: number;
  isPremium: boolean;
  excluded: boolean;
}

export default function LeaderboardAdminScreen() {
  const { appConfig, setAppConfig } = useAdminStore();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const savedExcluded = await AsyncStorage.getItem(EXCLUDED_KEY);
      const excluded: Set<string> = savedExcluded
        ? new Set(JSON.parse(savedExcluded))
        : new Set();
      setExcludedIds(excluded);

      const { data: profiles, error: profErr } = await supabase
        .from('user_profiles')
        .select('id, name, is_premium, total_sessions, streak')
        .order('total_sessions', { ascending: false })
        .limit(100);

      if (profErr) logger.error('leaderboard:load', 'שגיאה בטעינת פרופילים', profErr.message);

      const { data: elos, error: eloErr } = await supabase
        .from('user_elos')
        .select('user_id, elo');

      if (eloErr) logger.error('leaderboard:load', 'שגיאה בטעינת ELO', eloErr.message);

      const eloByUser = new Map<string, number[]>();
      (elos ?? []).forEach(e => {
        if (!eloByUser.has(e.user_id)) eloByUser.set(e.user_id, []);
        eloByUser.get(e.user_id)!.push(e.elo);
      });

      const computed: LeaderEntry[] = (profiles ?? [])
        .filter(p => (p.total_sessions ?? 0) > 0)
        .map(p => {
          const userElos = eloByUser.get(p.id) ?? [1200];
          const avgElo = Math.round(userElos.reduce((s, e) => s + e, 0) / userElos.length);
          return {
            id: p.id,
            name: p.name || 'ללא שם',
            elo: avgElo,
            sessions: p.total_sessions ?? 0,
            streak: p.streak ?? 0,
            isPremium: p.is_premium ?? false,
            excluded: excluded.has(p.id),
          };
        })
        .sort((a, b) => b.elo - a.elo);

      setEntries(computed);
    } catch (e: any) {
      logger.error('leaderboard:load', 'חריגה', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const toggleExclude = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = new Set(excludedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExcludedIds(next);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, excluded: !e.excluded } : e));
    AsyncStorage.setItem(EXCLUDED_KEY, JSON.stringify([...next])).catch(() => null);
  };

  const handleReset = () => {
    Alert.alert(
      '⚠️ איפוס לוח מובילים',
      'לאפס את כל ציוני ELO ל-1200? פעולה זו בלתי הפיכה.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס הכל', style: 'destructive', onPress: async () => {
            setResetting(true);
            try {
              const { error } = await supabase
                .from('user_elos')
                .update({ elo: 1200, history: [] })
                .gte('elo', 0);

              if (error) {
                Alert.alert('שגיאה', 'לא ניתן לאפס ELO: ' + error.message);
              } else {
                setEntries(prev => prev.map(e => ({ ...e, elo: 1200 })));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('✅ אופס', 'כל ציוני ELO אופסו ל-1200');
              }
            } catch (e: any) {
              Alert.alert('שגיאה', e?.message ?? 'שגיאה לא ידועה');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  const visible = useMemo(() =>
    entries.filter(e => showExcluded ? e.excluded : !e.excluded),
    [entries, showExcluded],
  );

  const excludedCount = entries.filter(e => e.excluded).length;
  const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← חזרה</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🏅 ניהול לוח מובילים</Text>
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary }}>
            טוען נתונים מ-Supabase...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🏅 ניהול לוח מובילים</Text>
        <Text style={styles.headerSub}>{entries.length - excludedCount} שחקנים גלויים</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Visibility toggle */}
        <View style={[styles.visCard, {
          borderColor: appConfig.leaderboardVisible ? Colors.success + '50' : Colors.danger + '50',
          backgroundColor: appConfig.leaderboardVisible ? Colors.success + '10' : Colors.danger + '10',
        }]}>
          <View style={styles.visRow}>
            <Switch
              value={appConfig.leaderboardVisible}
              onValueChange={val => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setAppConfig({ leaderboardVisible: val });
              }}
              trackColor={{ false: '#334155', true: Colors.success }}
              thumbColor="#fff"
            />
            <View style={styles.visInfo}>
              <Text style={[styles.visTitle, { color: appConfig.leaderboardVisible ? Colors.success : Colors.danger }]}>
                {appConfig.leaderboardVisible ? '✅ לוח מובילים גלוי' : '🚫 לוח מובילים מוסתר'}
              </Text>
              <Text style={styles.visDesc}>
                {appConfig.leaderboardVisible
                  ? 'כל המשתמשים יכולים לראות את הדירוג'
                  : 'הדירוג מוסתר מהמשתמשים'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{entries.length - excludedCount}</Text>
            <Text style={styles.statLbl}>מדורגים</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: Colors.danger }]}>{excludedCount}</Text>
            <Text style={styles.statLbl}>מוסרים</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: Colors.warning }]}>
              {entries.filter(e => e.isPremium).length}
            </Text>
            <Text style={styles.statLbl}>פרמיום</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <Pressable
            onPress={handleReset}
            disabled={resetting}
            style={[styles.controlBtn, { borderColor: Colors.danger }]}
          >
            {resetting
              ? <ActivityIndicator size="small" color={Colors.danger} />
              : <Text style={[styles.controlBtnText, { color: Colors.danger }]}>🔄 איפוס ציונים</Text>
            }
          </Pressable>
          <Pressable
            onPress={() => setShowExcluded(v => !v)}
            style={[styles.controlBtn, showExcluded && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
          >
            <Text style={[styles.controlBtnText, showExcluded && { color: '#fff' }]}>
              {showExcluded ? 'הצג גלויים' : `🚫 מוסרים (${excludedCount})`}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{showExcluded ? 'משתמשים מוסרים' : 'דירוג נוכחי'}</Text>

        {visible.map((entry, idx) => {
          const rank = idx + 1;
          const rankColor = idx < 3 ? RANK_COLORS[idx] : Colors.textTertiary;

          return (
            <View key={entry.id} style={[styles.entryCard, entry.excluded && styles.entryCardExcluded]}>
              <View style={[styles.rankBadge, { backgroundColor: rankColor + '25' }]}>
                <Text style={[styles.rankNum, { color: rankColor }]}>
                  {showExcluded ? '–' : rank}
                </Text>
              </View>

              <View style={styles.entryAvatar}>
                <Text style={styles.entryAvatarText}>{entry.name[0]}</Text>
              </View>

              <View style={styles.entryInfo}>
                <View style={styles.entryNameRow}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  {entry.isPremium && <Text style={styles.premiumBadge}>💎</Text>}
                </View>
                <View style={styles.entryMeta}>
                  <Text style={styles.metaStat}>ELO {entry.elo}</Text>
                  <Text style={styles.metaStat}>🎯 {entry.sessions}</Text>
                  <Text style={styles.metaStat}>🔥 {entry.streak}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => toggleExclude(entry.id)}
                style={[
                  styles.excludeBtn,
                  entry.excluded ? { backgroundColor: Colors.successLight } : { backgroundColor: Colors.dangerLight },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.excludeBtnText}>{entry.excluded ? '✅ הצג' : '🚫 הסר'}</Text>
              </Pressable>
            </View>
          );
        })}

        {visible.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{showExcluded ? '✅' : '🏅'}</Text>
            <Text style={styles.emptyText}>
              {showExcluded ? 'אין משתמשים מוסרים' : 'אין משתמשים עם סשנים עדיין'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 20 },
  back: { marginBottom: 10 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 3 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginTop: 4, marginBottom: 4 },

  visCard: { borderRadius: Radius.xl, borderWidth: 1.5, padding: 16 },
  visRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  visInfo: { flex: 1, alignItems: 'flex-end' },
  visTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  visDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row-reverse', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 12, alignItems: 'center', ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  statVal: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text },
  statLbl: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },

  controlsRow: { flexDirection: 'row-reverse', gap: 10 },
  controlBtn: {
    flex: 1, padding: 12, borderRadius: Radius.lg, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  controlBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  entryCard: {
    flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 14, alignItems: 'center', gap: 12,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  entryCardExcluded: { opacity: 0.6, borderStyle: 'dashed' },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankNum: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  entryAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLighter, alignItems: 'center', justifyContent: 'center',
  },
  entryAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary },
  entryInfo: { flex: 1, alignItems: 'flex-end' },
  entryNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  entryName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  premiumBadge: { fontSize: 12 },
  entryMeta: { flexDirection: 'row-reverse', gap: 10, marginTop: 4 },
  metaStat: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  excludeBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.lg, alignItems: 'center',
    minWidth: 60,
  },
  excludeBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary },
});
