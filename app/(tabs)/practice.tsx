import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { TARGETS, TOPICS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useUserStore } from '../../store/userStore';
import { useAdminStore, SmartExamTemplate } from '../../store/adminStore';
import { eloToTitle } from '../../utils/elo';

type PracticeTab = 'free' | 'simulations';

const FREE_MODES = [
  {
    id: 'practice',
    icon: '📖',
    label: 'תרגול חופשי',
    desc: 'תרגל בקצב שלך, קבל הסברים מיידיים',
    color: Colors.primary,
    gradient: Colors.gradients.primary,
  },
  {
    id: 'adaptive',
    icon: '🧠',
    label: 'תרגול אדפטיבי',
    desc: 'המנוע מתאים את הקושי לרמתך בזמן אמת',
    color: Colors.accent,
    gradient: ['#8B5CF6', '#6D28D9'] as [string, string],
  },
  {
    id: 'speed',
    icon: '⚡',
    label: 'מצב מהירות',
    desc: '60 שניות לשאלה — אתגר עצמך',
    color: Colors.warning,
    gradient: Colors.gradients.gold,
  },
];

export default function PracticeTab() {
  const [activeTab, setActiveTab] = useState<PracticeTab>('free');
  const [selectedMode, setSelectedMode] = useState('practice');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const indicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  const { selectedTargetId, getTopicElo, isPremium } = useUserStore();
  const { freePracticeLimit, templates } = useAdminStore();

  const target = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  const topics = TOPICS.filter(t => t.targetId === target.id);

  const activeTemplates = useMemo(
    () => templates.filter(t => t.isActive && t.targetId === target.id),
    [templates, target.id]
  );

  const switchTab = (tab: PracticeTab) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'free' ? 0 : 1,
      useNativeDriver: false,
      tension: 200,
      friction: 18,
    }).start();
  };

  const handleStartFree = () => {
    if (!selectedTopicId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/practice-session',
      params: {
        topicId: selectedTopicId,
        targetId: target.id,
        mode: selectedMode,
        questionLimit: isPremium ? '999' : String(freePracticeLimit),
        isPremium: isPremium ? '1' : '0',
      },
    });
  };

  const handleStartSimulation = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/practice-session',
      params: {
        mode: 'simulation',
        templateId,
        targetId: target.id,
        topicId: tmpl.rules[0]?.topicId ?? '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
          <Pressable onPress={() => switchTab('free')} style={styles.tabBtn}>
            <Text style={[styles.tabBtnText, activeTab === 'free' && styles.tabBtnTextActive]}>
              📖 תרגול חופשי
            </Text>
          </Pressable>
          <Pressable onPress={() => switchTab('simulations')} style={styles.tabBtn}>
            <View style={styles.tabBtnInner}>
              <Text style={[styles.tabBtnText, activeTab === 'simulations' && styles.tabBtnTextActive]}>
                🏗️ מבחנים חכמים
              </Text>
              {activeTemplates.length > 0 && (
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>{activeTemplates.length}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {activeTab === 'free' ? (
        <FreePracticePane
          topics={topics}
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
          selectedTopicId={selectedTopicId}
          setSelectedTopicId={setSelectedTopicId}
          getTopicElo={getTopicElo}
          isPremium={isPremium}
          freePracticeLimit={freePracticeLimit}
          canStart={selectedTopicId !== null}
          onStart={handleStartFree}
        />
      ) : (
        <SimulationsPane
          templates={activeTemplates}
          target={target}
          onStart={handleStartSimulation}
          isPremium={isPremium}
        />
      )}
    </SafeAreaView>
  );
}

function FreePracticePane({
  topics, selectedMode, setSelectedMode,
  selectedTopicId, setSelectedTopicId, getTopicElo,
  isPremium, freePracticeLimit, canStart, onStart,
}: {
  topics: typeof TOPICS;
  selectedMode: string; setSelectedMode: (m: string) => void;
  selectedTopicId: string | null; setSelectedTopicId: (id: string | null) => void;
  getTopicElo: (id: string) => number;
  isPremium: boolean; freePracticeLimit: number;
  canStart: boolean; onStart: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <View style={styles.accessRow}>
          <View style={[styles.accessBadge, isPremium ? styles.accessPremium : styles.accessFree]}>
            <Text style={styles.accessBadgeText}>
              {isPremium ? '💎 פרמיום — תרגול ללא הגבלה' : `🆓 חינמי — עד ${freePracticeLimit} שאלות לסשן`}
            </Text>
          </View>
          {!isPremium && (
            <Pressable
              onPress={() => Alert.alert('שדרג לפרמיום', 'פרמיום מאפשר תרגול ללא הגבלה 💎')}
              style={({ pressed }) => [styles.upgradeChip, { opacity: pressed ? 0.75 : 1 }]}
            >
              <LinearGradient colors={Colors.gradients.primary} style={styles.upgradeChipGrad}>
                <Text style={styles.upgradeChipText}>שדרג 💎</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionLabel}>מצב תרגול</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modesRow}
          directionalLockEnabled
          style={styles.modesRowOuter}
        >
          {FREE_MODES.map(mode => (
            <ModeChip
              key={mode.id}
              mode={mode}
              isSelected={selectedMode === mode.id}
              onPress={() => { Haptics.selectionAsync(); setSelectedMode(mode.id); }}
            />
          ))}
        </ScrollView>

        {FREE_MODES.filter(m => m.id === selectedMode).map(mode => (
          <View key={mode.id} style={styles.modeDetailCard}>
            <Text style={styles.modeDetailIcon}>{mode.icon}</Text>
            <View style={styles.modeDetailText}>
              <Text style={[styles.modeDetailLabel, { color: mode.color }]}>{mode.label}</Text>
              <Text style={styles.modeDetailDesc}>{mode.desc}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionLabel}>בחר נושא</Text>
        <View style={styles.topicsGrid}>
          {topics.map(topic => {
            const elo = getTopicElo(topic.id);
            const isSelected = selectedTopicId === topic.id;
            const isLocked = topic.isPremiumOnly && !isPremium;
            return (
              <Pressable
                key={topic.id}
                disabled={isLocked}
                onPress={() => {
                  if (isLocked) {
                    Alert.alert('נושא פרמיום 💎', 'שדרג לפרמיום לגישה לנושא זה');
                    return;
                  }
                  Haptics.selectionAsync();
                  setSelectedTopicId(selectedTopicId === topic.id ? null : topic.id);
                }}
                style={({ pressed }) => [
                  styles.topicCard,
                  isSelected && { borderColor: topic.color, borderWidth: 2 },
                  isLocked && styles.topicCardLocked,
                  { opacity: pressed && !isLocked ? 0.75 : 1 },
                ]}
              >
                {isSelected && (
                  <LinearGradient
                    colors={[topic.color + '18', topic.color + '08']}
                    style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                  />
                )}
                {isLocked && (
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockBadgeText}>💎</Text>
                  </View>
                )}
                {isSelected && !isLocked && (
                  <View style={[styles.checkBadge, { backgroundColor: topic.color }]}>
                    <Text style={styles.checkBadgeText}>✓</Text>
                  </View>
                )}
                <Text style={styles.topicCardIcon}>{topic.icon}</Text>
                <Text
                  style={[
                    styles.topicCardName,
                    isSelected && !isLocked && { color: topic.color },
                    isLocked && { color: Colors.textTertiary },
                  ]}
                  numberOfLines={2}
                >
                  {topic.name}
                </Text>
                <Text style={[styles.topicCardElo, { color: isLocked ? Colors.textTertiary : topic.color }]}>
                  {eloToTitle(elo)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {canStart && !isPremium && (
          <View style={styles.limitInfo}>
            <Text style={styles.limitInfoText}>
              ⚠️ סשן זה יכלול עד {freePracticeLimit} שאלות (מגבלת חינמי)
            </Text>
          </View>
        )}

        {topics.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📚</Text>
            <Text style={styles.emptyStateTitle}>אין נושאים זמינים</Text>
            <Text style={styles.emptyStateSub}>נושאים יתווספו בקרוב למסלול זה</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom + 4, 20) }]}>
        <Pressable
          onPress={onStart}
          disabled={!canStart}
          style={({ pressed }) => [{ opacity: pressed && canStart ? 0.75 : 1 }]}
        >
          <LinearGradient
            colors={canStart ? Colors.gradients.primary : ['#CBD5E1', '#94A3B8']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.startBtn, !canStart && { shadowOpacity: 0 }]}
          >
            <Text style={[styles.startBtnText, !canStart && { color: 'rgba(255,255,255,0.7)' }]}>
              {canStart
                ? `התחל תרגול ← (${isPremium ? 'ללא הגבלה' : `עד ${freePracticeLimit}`})`
                : 'בחר נושא להתחלה'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}

function ModeChip({
  mode, isSelected, onPress,
}: { mode: typeof FREE_MODES[0]; isSelected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
    >
      {isSelected ? (
        <LinearGradient
          colors={mode.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modeChip}
        >
          <Text style={styles.modeChipIcon}>{mode.icon}</Text>
          <Text style={[styles.modeChipLabel, { color: '#fff' }]}>{mode.label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.modeChip, styles.modeChipInactive]}>
          <Text style={styles.modeChipIcon}>{mode.icon}</Text>
          <Text style={[styles.modeChipLabel, { color: Colors.textSecondary }]}>{mode.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SimulationsPane({
  templates, target, onStart,
}: {
  templates: SmartExamTemplate[];
  target: typeof TARGETS[0];
  onStart: (id: string) => void;
  isPremium: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (templates.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateEmoji}>🏗️</Text>
        <Text style={styles.emptyStateTitle}>אין מבחנים חכמים זמינים</Text>
        <Text style={styles.emptyStateSub}>המנהל טרם הגדיר מבחנים חכמים עבור מסלול זה</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.simHeader}>
        מבחנים חכמים לוקחים את השאלות הכי מתאימות לרמתך ובונים מבחן אישי בכל פעם מחדש.
      </Text>

      {templates.map(tmpl => {
        const totalQ = tmpl.smartRules && tmpl.smartRules.length > 0
          ? tmpl.smartRules.reduce((s: number, r) => s + r.count, 0)
          : tmpl.rules.reduce((s: number, r) => s + r.count, 0);

        return (
          <View key={tmpl.id} style={styles.simCard}>
            <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.simCardHeader}>
              <View style={styles.simCardHeaderRight}>
                <Text style={styles.simCardName}>{tmpl.name}</Text>
                {tmpl.description ? (
                  <Text style={styles.simCardDesc}>{tmpl.description}</Text>
                ) : null}
              </View>
              <Text style={styles.simCardIcon}>🏗️</Text>
            </LinearGradient>

            <View style={styles.simCardBody}>
              <View style={styles.simStats}>
                <SimStat icon="❓" label="שאלות" value={String(totalQ)} />
                <SimStat icon="⏱️" label="דקות" value={String(tmpl.timeLimitMinutes)} />
                <SimStat icon="📊" label="מעבר%" value={String(tmpl.passingScore)} />
                <SimStat icon="📋" label="חלקים" value={String(tmpl.rules.length)} />
              </View>

              <View style={styles.simRulesBox}>
                {(tmpl.smartRules ?? tmpl.rules).map((r) => {
                  const topic = TOPICS.find(t => t.id === r.topicId);
                  const count = r.count;
                  const minD = r.minDifficulty ?? 1;
                  const maxD = r.maxDifficulty ?? 10;
                  return (
                    <View key={r.id} style={styles.simRuleRow}>
                      <Text style={styles.simRuleText}>
                        {topic?.icon} {topic?.name ?? r.topicId}
                      </Text>
                      <Text style={styles.simRuleMeta}>
                        {count} שאלות · רמה {minD}–{maxD}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {tmpl.restTimeBetweenRules && tmpl.restTimeBetweenRules > 0 ? (
                <Text style={styles.simRestNote}>
                  😴 {tmpl.restTimeBetweenRules} שניות מנוחה בין חלקים
                </Text>
              ) : null}

              <Pressable
                onPress={() => onStart(tmpl.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              >
                <LinearGradient colors={Colors.gradients.primary} style={styles.simStartGrad}>
                  <Text style={styles.simStartText}>
                    🚀 התחל מבחן — {totalQ} שאלות, {tmpl.timeLimitMinutes} דקות
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function SimStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ssStyles.wrap}>
      <Text style={ssStyles.icon}>{icon}</Text>
      <Text style={ssStyles.value}>{value}</Text>
      <Text style={ssStyles.label}>{label}</Text>
    </View>
  );
}
const ssStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 10 },
  icon: { fontSize: 14, marginBottom: 2 },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 4 },

  tabBarWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    ...Shadow.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabBtnInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  tabBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textTertiary },
  tabBtnTextActive: { color: Colors.text, fontFamily: FontFamily.bold },
  tabCount: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#fff' },

  accessRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 },
  accessBadge: { borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  accessFree: { backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  accessPremium: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  accessBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text },
  upgradeChip: { borderRadius: Radius.full, overflow: 'hidden' },
  upgradeChipGrad: { paddingHorizontal: 14, paddingVertical: 8 },
  upgradeChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },

  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', marginBottom: 12, marginTop: 8 },

  modesRowOuter: { marginHorizontal: -20 },
  modesRow: { paddingHorizontal: 20, flexDirection: 'row-reverse', gap: 10, paddingBottom: 4 },
  modeChip: { flexDirection: 'row-reverse', alignItems: 'center', borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 12, gap: 7, ...Shadow.sm },
  modeChipInactive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  modeChipIcon: { fontSize: 16 },
  modeChipLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },

  modeDetailCard: { flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 8, gap: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', ...Shadow.sm },
  modeDetailIcon: { fontSize: 32 },
  modeDetailText: { flex: 1, alignItems: 'flex-end' },
  modeDetailLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right', marginBottom: 3 },
  modeDetailDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },

  topicsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  topicCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)', padding: 16, alignItems: 'flex-end', justifyContent: 'flex-start', minHeight: 130, ...Shadow.sm, position: 'relative', overflow: 'hidden' },
  topicCardLocked: { opacity: 0.55 },
  lockBadge: { position: 'absolute', top: 10, left: 10 },
  lockBadgeText: { fontSize: 16 },
  checkBadge: { position: 'absolute', top: 10, left: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkBadgeText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
  topicCardIcon: { fontSize: 36, marginBottom: 8 },
  topicCardName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', marginBottom: 4 },
  topicCardElo: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, textAlign: 'right' },

  limitInfo: { backgroundColor: '#FEF3C7', borderRadius: Radius.lg, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#F59E0B' },
  limitInfoText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#92400E', textAlign: 'right' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 60 },
  emptyStateEmoji: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptyStateSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.glassStrong, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 20, paddingTop: 12 },
  startBtn: { borderRadius: Radius.xl, paddingVertical: 18, alignItems: 'center', ...Shadow.primary },
  startBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  simHeader: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 22, marginBottom: 16, marginTop: 8 },
  simCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.md, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  simCardHeader: { padding: 18, flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between' },
  simCardHeaderRight: { flex: 1, alignItems: 'flex-end' },
  simCardName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff', textAlign: 'right' },
  simCardDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 4, lineHeight: 16 },
  simCardIcon: { fontSize: 28 },
  simCardBody: { padding: 16 },
  simStats: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  simRulesBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 12, marginBottom: 12 },
  simRuleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  simRuleText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text },
  simRuleMeta: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
  simRestNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginBottom: 12 },
  simStartGrad: { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center', ...Shadow.primary },
  simStartText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
