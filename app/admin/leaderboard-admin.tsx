import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

interface LeaderEntry {
  id: string;
  name: string;
  xp: number;
  level: number;
  sessions: number;
  streak: number;
  isPremium: boolean;
  excluded: boolean;
}

export default function LeaderboardAdminScreen() {
  const { appConfig, setAppConfig } = useAdminStore();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id,name,xp,level,total_sessions,streak,is_premium')
        .order('xp', { ascending: false });

        setEntries((data ?? []).map(row => ({
          id: row.id,
          name: row.name || 'ללא שם',
          xp: row.xp ?? 0,
          level: row.level ?? 1,
          sessions: row.total_sessions ?? 0,
          streak: row.streak ?? 0,
          isPremium: row.is_premium ?? false,
          excluded: false,
        })));
      setLoading(false);
    };

    loadEntries().catch(() => setLoading(false));
  }, []);

  const visible = useMemo(() => entries
    .map(entry => ({ ...entry, excluded: excludedIds.has(entry.id) }))
    .filter(entry => showExcluded ? entry.excluded : !entry.excluded)
    .sort((a, b) => b.xp - a.xp || b.level - a.level || b.sessions - a.sessions),
  [entries, excludedIds, showExcluded]);

  const excludedCount = excludedIds.size;
  const premiumCount = entries.filter(entry => entry.isPremium).length;
  const rankColors = ['#F59E0B', '#94A3B8', '#CD7F32'];

  const toggleExclude = (id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ניהול לוח מובילים</Text>
        <Text style={styles.headerSub}>מדורג לפי נתוני משתמשים אמיתיים: XP, רמה וסשנים</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.visCard, { borderColor: appConfig.leaderboardVisible ? Colors.success + '50' : Colors.danger + '50', backgroundColor: appConfig.leaderboardVisible ? Colors.success + '10' : Colors.danger + '10' }]}>
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
                {appConfig.leaderboardVisible ? 'לוח מובילים גלוי' : 'לוח מובילים מוסתר'}
              </Text>
              <Text style={styles.visDesc}>
                {appConfig.leaderboardVisible ? 'משתמשים יכולים לראות את הדירוג' : 'הדירוג מוסתר מהמשתמשים'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="מדורגים" value={entries.length - excludedCount} />
          <Stat label="מוסרים" value={excludedCount} color={Colors.danger} />
          <Stat label="פרימיום" value={premiumCount} color={Colors.warning} />
        </View>

        <View style={styles.controlsRow}>
          <Pressable onPress={() => setShowExcluded(v => !v)} style={[styles.controlBtn, showExcluded && styles.controlBtnActive]}>
            <Text style={[styles.controlBtnText, showExcluded && styles.controlBtnTextActive]}>
              {showExcluded ? 'הצג גלויים' : `מוסרים (${excludedCount})`}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{showExcluded ? 'משתמשים מוסרים' : 'דירוג נוכחי'}</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{entries.length === 0 ? 'אין עדיין משתמשים אמיתיים לדירוג' : 'אין תוצאות להצגה'}</Text>
          </View>
        ) : (
          visible.map((entry, idx) => {
            const rankColor = idx < 3 && !showExcluded ? rankColors[idx] : Colors.textTertiary;
            return (
              <View key={entry.id} style={[styles.entryCard, entry.excluded && styles.entryCardExcluded]}>
                <View style={[styles.rankBadge, { backgroundColor: rankColor + '25' }]}>
                  <Text style={[styles.rankNum, { color: rankColor }]}>{showExcluded ? '-' : idx + 1}</Text>
                </View>
                <View style={styles.entryAvatar}>
                  <Text style={styles.entryAvatarText}>{entry.name[0] ?? '?'}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <View style={styles.entryNameRow}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    {entry.isPremium && <Text style={styles.premiumBadge}>Premium</Text>}
                  </View>
                  <View style={styles.entryMeta}>
                    <Text style={styles.metaStat}>XP {entry.xp}</Text>
                    <Text style={styles.metaStat}>Lv {entry.level}</Text>
                    <Text style={styles.metaStat}>{entry.sessions} סשנים</Text>
                    <Text style={styles.metaStat}>רצף {entry.streak}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => toggleExclude(entry.id)}
                  style={[styles.excludeBtn, entry.excluded ? { backgroundColor: Colors.successLight } : { backgroundColor: Colors.dangerLight }]}
                  hitSlop={8}
                >
                  <Text style={styles.excludeBtnText}>{entry.excluded ? 'הצג' : 'הסר'}</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color = Colors.text }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 20 },
  back: { marginBottom: 10, minHeight: 44, justifyContent: 'center' },
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
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12, alignItems: 'center', ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  statVal: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  statLbl: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  controlsRow: { flexDirection: 'row-reverse', gap: 10 },
  controlBtn: { flex: 1, padding: 12, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  controlBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  controlBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  controlBtnTextActive: { color: '#fff' },
  entryCard: { flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, alignItems: 'center', gap: 12, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  entryCardExcluded: { opacity: 0.6, borderStyle: 'dashed' },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankNum: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  entryAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLighter, alignItems: 'center', justifyContent: 'center' },
  entryAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary },
  entryInfo: { flex: 1, alignItems: 'flex-end' },
  entryNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  entryName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  premiumBadge: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.warning },
  entryMeta: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  metaStat: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  excludeBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.lg, alignItems: 'center', minWidth: 60 },
  excludeBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary },
});
