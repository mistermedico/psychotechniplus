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

type PracticeTab = 'free' | 'simulations';

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';
const DIFFICULTY_OPTIONS: { id: DifficultyFilter; label: string; icon: string; color: string }[] = [
  { id: 'all',    label: 'הכל',    icon: '🎯', color: Colors.primary },
  { id: 'easy',   label: 'קל',     icon: '🟢', color: Colors.success },
  { id: 'medium', label: 'בינוני', icon: '🟡', color: Colors.warning },
  { id: 'hard',   label: 'קשה',    icon: '🔴', color: Colors.danger },
];

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
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('all');
  const tabAnim = useRef(new Animated.Value(0)).current;
  const indicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  const { selectedTargetId, getTopicAccuracy, getTopicLevelLabel, isPremium } = useUserStore();
  const { freePracticeLimit, templates, appConfig, practiceSettings } = useAdminStore();
  const featureFlags = appConfig.featureFlags;
  const premiumOnlyModes = practiceSettings.premiumOnlyModes;

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
    // Check if mode is premium-only
    if (premiumOnlyModes.includes(selectedMode) && !isPremium) {
      Alert.alert(
        'פרמיום בלבד',
        'מצב זה זמין למנויי פרמיום בלבד. שדרג את החשבון שלך.',
        [
          { text: 'שדרג', onPress: () => router.push('/paywall') },
          { text: 'ביטול', style: 'cancel' },
        ]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/practice-session',
      params: {
        topicId: selectedTopicId,
        targetId: target.id,
        mode: selectedMode,
        difficulty: selectedDifficulty,
        questionLimit: isPremium ? '999' : String(freePracticeLimit),
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
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header row with home button + tab bar */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={({ pressed }) => [styles.homeBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.homeBtnText}>🏠</Text>
          </Pressable>

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
        </View>

        {activeTab === 'free' ? (
          <FreePracticePane
            topics={topics}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            selectedTopicId={selectedTopicId}
            setSelectedTopicId={setSelectedTopicId}
            selectedDifficulty={selectedDifficulty}
            setSelectedDifficulty={setSelectedDifficulty}
            getTopicAccuracy={getTopicAccuracy}
            getTopicLevelLabel={getTopicLevelLabel}
            isPremium={isPremium}
            freePracticeLimit={freePracticeLimit}
            canStart={selectedTopicId !== null}
            onStart={handleStartFree}
            showSpeedMode={featureFlags.speedMode}
          />
        ) : featureFlags.simulations !== false ? (
          <SimulationsPane
            templates={activeTemplates}
            target={target}
            onStart={handleStartSimulation}
            isPremium={isPremium}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🔒</Text>
            <Text style={styles.emptyStateTitle}>מבחנים חכמים אינם זמינים כרגע</Text>
            <Text style={styles.emptyStateSub}>תכונה זו הושבתה זמנית</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function FreePracticePane({
  topics, selectedMode, setSelectedMode,
  selectedTopicId, setSelectedTopicId,
  selectedDifficulty, setSelectedDifficulty,
  getTopicAccuracy, getTopicLevelLabel,
  isPremium, freePracticeLimit, canStart, onStart, showSpeedMode,
}: {
  topics: typeof TOPICS;
  selectedMode: string; setSelectedMode: (m: string) => void;
  selectedTopicId: string | null; setSelectedTopicId: (id: string | null) => void;
  selectedDifficulty: DifficultyFilter; setSelectedDifficulty: (d: DifficultyFilter) => void;
  getTopicAccuracy: (id: string) => number;
  getTopicLevelLabel: (id: string) => string;
  isPremium: boolean; freePracticeLimit: number;
  canStart: boolean; onStart: () => void;
  showSpeedMode?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 64 + Math.max(insets.bottom, 12);
  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + 100 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Access badge row */}
        <View style={styles.accessRow}>
          <View style={[styles.accessBadge, isPremium ? styles.accessPremium : styles.accessFree]}>
            <Text style={styles.accessBadgeText}>
              {isPremium ? '💎 פרמיום — תרגול ללא הגבלה' : `🆓 חינמי — עד ${freePracticeLimit} שאלות לסשן`}
            </Text>
          </View>
          {!isPremium && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/paywall'); }}
              style={({ pressed }) => [styles.upgradeChip, { opacity: pressed ? 0.75 : 1 }]}
            >
              <LinearGradient colors={Colors.gradients.primary} style={styles.upgradeChipGrad}>
                <Text style={styles.upgradeChipText}>שדרג 💎</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* Mode label */}
        <Text style={styles.sectionLabel}>מצב תרגול</Text>

        {/* Mode chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modesRow}
          directionalLockEnabled
          style={styles.modesRowOuter}
        >
          {FREE_MODES.filter(mode => mode.id !== 'speed' || showSpeedMode !== false).map(mode => (
            <ModeChip
              key={mode.id}
              mode={mode}
              isSelected={selectedMode === mode.id}
              onPress={() => { Haptics.selectionAsync(); setSelectedMode(mode.id); }}
            />
          ))}
        </ScrollView>

        {/* Mode detail card */}
        {FREE_MODES.filter(m => m.id === selectedMode).map(mode => (
          <View key={mode.id} style={styles.modeDetailCard}>
            <Text style={styles.modeDetailIcon}>{mode.icon}</Text>
            <View style={styles.modeDetailText}>
              <Text style={[styles.modeDetailLabel, { color: mode.color }]}>{mode.label}</Text>
              <Text style={styles.modeDetailDesc}>{mode.desc}</Text>
            </View>
          </View>
        ))}

        {/* Difficulty selector — hidden for adaptive (algo decides) */}
        {selectedMode !== 'adaptive' && (
          <>
            <Text style={styles.sectionLabel}>רמת קושי</Text>
            <View style={styles.difficultyRow}>
              {DIFFICULTY_OPTIONS.map(opt => {
                const isActive = selectedDifficulty === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => { Haptics.selectionAsync(); setSelectedDifficulty(opt.id); }}
                    style={({ pressed }) => [
                      styles.difficultyChip,
                      isActive && { borderColor: opt.color, backgroundColor: opt.color + '22' },
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={styles.difficultyChipIcon}>{opt.icon}</Text>
                    <Text style={[styles.difficultyChipLabel, isActive && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Topic section */}
        <Text style={styles.sectionLabel}>בחר נושא</Text>
        <View style={styles.topicsGrid}>
          {topics.map(topic => {
            const accuracy = getTopicAccuracy(topic.id);
            const levelLabel = getTopicLevelLabel(topic.id);
            const isSelected = selectedTopicId === topic.id;
            const isLocked = topic.isPremiumOnly && !isPremium;
            return (
              <Pressable
                key={topic.id}
                disabled={isLocked}
                onPress={() => {
                  if (isLocked) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/paywall');
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
                    colors={[topic.color + '30', topic.color + '10']}
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
                    isLocked && { color: 'rgba(255,255,255,0.35)' },
                  ]}
                  numberOfLines={2}
                >
                  {topic.name}
                </Text>
                <Text style={[styles.topicCardElo, { color: isLocked ? 'rgba(255,255,255,0.35)' : topic.color }]}>
                  {isLocked ? '💎' : accuracy > 0 ? `${Math.round(accuracy * 100)}% · ${levelLabel}` : levelLabel}
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

      {/* Sticky start button */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom + 4, 20), bottom: TAB_BAR_HEIGHT }]}>
        <Pressable
          onPress={onStart}
          disabled={!canStart}
          style={({ pressed }) => [{ opacity: pressed && canStart ? 0.75 : 1 }]}
        >
          <LinearGradient
            colors={canStart ? Colors.gradients.primary : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.06)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.startBtn, !canStart && { shadowOpacity: 0 }]}
          >
            <Text style={[styles.startBtnText, !canStart && { color: 'rgba(255,255,255,0.4)' }]}>
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
          <Text style={[styles.modeChipLabel, { color: 'rgba(255,255,255,0.6)' }]}>{mode.label}</Text>
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
            {/* Card header with gradient strip */}
            <LinearGradient
              colors={['#1E1A4A', Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.simCardHeader}
            >
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
  wrap: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  icon: { fontSize: 14, marginBottom: 2 },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#F1F5F9' },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: 'rgba(255,255,255,0.45)' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 4 },

  /* ── Header row with home btn + tab switcher ── */
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  homeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnText: { fontSize: 18 },

  tabBarWrap: { flex: 1 },
  tabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.full,
    padding: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabBtnInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  tabBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.45)' },
  tabBtnTextActive: { color: '#F1F5F9', fontFamily: FontFamily.bold },
  tabCount: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#fff' },

  /* ── Access badge row ── */
  accessRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  accessBadge: { borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  accessFree: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  accessPremium: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  accessBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#F1F5F9' },
  upgradeChip: { borderRadius: Radius.full, overflow: 'hidden' },
  upgradeChipGrad: { paddingHorizontal: 14, paddingVertical: 8 },
  upgradeChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },

  /* ── Section label ── */
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    textAlign: 'right',
    marginBottom: 12,
    marginTop: 8,
  },

  /* ── Difficulty chips ── */
  difficultyRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 8,
  },
  difficultyChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 60,
    justifyContent: 'center',
  },
  difficultyChipIcon: { fontSize: 16 },
  difficultyChipLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.55)',
  },

  /* ── Mode chips ── */
  modesRowOuter: { marginHorizontal: -20 },
  modesRow: { paddingHorizontal: 20, flexDirection: 'row-reverse', gap: 10, paddingBottom: 4 },
  modeChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 7,
  },
  modeChipInactive: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  modeChipIcon: { fontSize: 16 },
  modeChipLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },

  /* ── Mode detail card ── */
  modeDetailCard: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 8,
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  modeDetailIcon: { fontSize: 32 },
  modeDetailText: { flex: 1, alignItems: 'flex-end' },
  modeDetailLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right', marginBottom: 3 },
  modeDetailDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    lineHeight: 20,
  },

  /* ── Topics grid ── */
  topicsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  topicCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.13)',
    padding: 16,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: 130,
    position: 'relative',
    overflow: 'hidden',
  },
  topicCardLocked: { opacity: 0.45 },
  lockBadge: { position: 'absolute', top: 10, left: 10 },
  lockBadgeText: { fontSize: 16 },
  checkBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
  topicCardIcon: { fontSize: 36, marginBottom: 8 },
  topicCardName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#F1F5F9',
    textAlign: 'right',
    marginBottom: 4,
  },
  topicCardElo: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, textAlign: 'right' },

  /* ── Limit info ── */
  limitInfo: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: Radius.lg,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  limitInfoText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(245,158,11,0.9)',
    textAlign: 'right',
  },

  /* ── Empty state ── */
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 60 },
  emptyStateEmoji: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#F1F5F9',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* ── Sticky start button ── */
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(6,9,18,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  startBtn: { borderRadius: Radius.xl, paddingVertical: 18, alignItems: 'center' },
  startBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  /* ── Simulations ── */
  simHeader: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: 16,
    marginTop: 8,
  },
  simCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  simCardHeader: {
    padding: 18,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  simCardHeaderRight: { flex: 1, alignItems: 'flex-end' },
  simCardName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff', textAlign: 'right' },
  simCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 16,
  },
  simCardIcon: { fontSize: 28 },
  simCardBody: { padding: 16 },
  simStats: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  simRulesBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  simRuleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  simRuleText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#F1F5F9' },
  simRuleMeta: { fontFamily: FontFamily.regular, fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  simRestNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    marginBottom: 12,
  },
  simStartGrad: { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  simStartText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
