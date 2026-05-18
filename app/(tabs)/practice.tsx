import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { TARGETS, TOPICS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useUserStore } from '../../store/userStore';
import { useAdminStore, SmartExamTemplate } from '../../store/adminStore';
import { eloToTitle } from '../../utils/elo';

// ── Tab IDs ──────────────────────────────────────────────────────────────────
type PracticeTab = 'free' | 'simulations';

// ── Free practice mode options ────────────────────────────────────────────────
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

  const { selectedTargetId, getTopicElo, isPremium } = useUserStore();
  const { freePracticeLimit, templates } = useAdminStore();

  const target = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  const topics = TOPICS.filter(t => t.targetId === target.id);

  // Only show active templates for this target
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
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => switchTab('free')}
          style={[styles.tabBtn, activeTab === 'free' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, activeTab === 'free' && styles.tabBtnTextActive]}>
            📖 תרגול חופשי
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchTab('simulations')}
          style={[styles.tabBtn, activeTab === 'simulations' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabBtnText, activeTab === 'simulations' && styles.tabBtnTextActive]}>
            🏗️ מבחנים חכמים
          </Text>
          {activeTemplates.length > 0 && (
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{activeTemplates.length}</Text>
            </View>
          )}
        </Pressable>
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

// ── Free Practice Pane ────────────────────────────────────────────────────────

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
  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
      >
        {/* Premium / Free badge */}
        <View style={styles.accessRow}>
          <View style={[styles.accessBadge, isPremium ? styles.accessPremium : styles.accessFree]}>
            <Text style={styles.accessBadgeText}>
              {isPremium ? '💎 פרמיום — תרגול ללא הגבלה' : `🆓 חינמי — עד ${freePracticeLimit} שאלות לסשן`}
            </Text>
          </View>
          {!isPremium && (
            <Pressable
              onPress={() => Alert.alert('שדרג לפרמיום', 'פרמיום מאפשר תרגול ללא הגבלה 💎')}
              style={styles.upgradeLink}
            >
              <Text style={styles.upgradeLinkText}>שדרג ←</Text>
            </Pressable>
          )}
        </View>

        {/* Mode selector */}
        <Text style={styles.sectionLabel}>מצב תרגול</Text>
        <View style={styles.modesGrid}>
          {FREE_MODES.map(mode => (
            <ModeCard
              key={mode.id}
              mode={mode}
              isSelected={selectedMode === mode.id}
              onPress={() => { Haptics.selectionAsync(); setSelectedMode(mode.id); }}
            />
          ))}
        </View>

        {/* Topic selector */}
        <Text style={styles.sectionLabel}>בחר נושא</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicsHScroll}
          style={styles.topicsHScrollOuter}
          directionalLockEnabled
        >
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
                  isSelected && { borderColor: topic.color, backgroundColor: topic.color + '12' },
                  isLocked && styles.topicCardLocked,
                  pressed && !isLocked && { transform: [{ scale: 0.96 }] },
                ]}
              >
                {isLocked && <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>💎</Text></View>}
                {isSelected && !isLocked && (
                  <View style={[styles.topicCheck, { backgroundColor: topic.color }]}>
                    <Text style={styles.topicCheckText}>✓</Text>
                  </View>
                )}
                <Text style={styles.topicIcon}>{topic.icon}</Text>
                <Text
                  style={[
                    styles.topicName,
                    isSelected && !isLocked && { color: topic.color },
                    isLocked && { color: Colors.textTertiary },
                  ]}
                  numberOfLines={2}
                >
                  {topic.name}
                </Text>
                <Text style={[styles.topicTitle, { color: isLocked ? Colors.textTertiary : topic.color }]}>
                  {eloToTitle(elo)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Question count info */}
        {canStart && !isPremium && (
          <View style={styles.limitInfo}>
            <Text style={styles.limitInfoText}>
              ⚠️ סשן זה יכלול עד {freePracticeLimit} שאלות (מגבלת חינמי)
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky start button */}
      <View style={styles.stickyBar}>
        <Pressable
          onPress={onStart}
          disabled={!canStart}
          style={({ pressed }) => [
            styles.startBtn,
            !canStart && styles.startBtnDisabled,
            pressed && canStart && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={canStart ? Colors.gradients.primary : ['#CBD5E1', '#94A3B8']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.startBtnGrad}
          >
            <Text style={[styles.startBtnText, !canStart && styles.startBtnTextDisabled]}>
              {canStart ? `התחל תרגול ← (${isPremium ? 'ללא הגבלה' : `עד ${freePracticeLimit}`})` : 'בחר נושא'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}

// ── Simulations Pane ──────────────────────────────────────────────────────────

function SimulationsPane({
  templates, target, onStart, isPremium,
}: {
  templates: SmartExamTemplate[];
  target: typeof TARGETS[0];
  onStart: (id: string) => void;
  isPremium: boolean;
}) {
  if (templates.length === 0) {
    return (
      <View style={styles.emptySimulations}>
        <Text style={styles.emptySimIcon}>🏗️</Text>
        <Text style={styles.emptySimTitle}>אין מבחנים חכמים זמינים</Text>
        <Text style={styles.emptySimDesc}>המנהל טרם הגדיר מבחנים חכמים עבור מסלול זה</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
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
            <LinearGradient
              colors={['#0F172A', '#1E293B']}
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

              {/* Rules breakdown */}
              <View style={styles.simRulesBox}>
                {(tmpl.smartRules ?? tmpl.rules).map((r, _i) => {
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
                style={({ pressed }) => [styles.simStartBtn, pressed && { opacity: 0.85 }]}
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
  wrap: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 8 },
  icon: { fontSize: 14, marginBottom: 2 },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
});

// ── Mode Card ─────────────────────────────────────────────────────────────────

function ModeCard({
  mode, isSelected, onPress,
}: { mode: typeof FREE_MODES[0]; isSelected: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(isSelected ? 1.01 : 1)).current;
  const checkOpacity = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: isSelected ? 1.01 : 1, useNativeDriver: true, tension: 180, friction: 12 }).start();
    Animated.timing(checkOpacity, { toValue: isSelected ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [isSelected]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      <Animated.View style={[styles.modeCard, isSelected && styles.modeCardSelected, { borderColor: isSelected ? mode.color : Colors.border }, { transform: [{ scale }] }]}>
        {isSelected && <LinearGradient colors={mode.gradient} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />}
        <Animated.View style={[styles.modeCheck, { opacity: checkOpacity }]}>
          <Text style={styles.modeCheckText}>✓</Text>
        </Animated.View>
        <Text style={styles.modeIcon}>{mode.icon}</Text>
        <Text style={[styles.modeLabel, { color: isSelected ? '#fff' : Colors.text }]}>{mode.label}</Text>
        <Text style={[styles.modeDesc, { color: isSelected ? 'rgba(255,255,255,0.8)' : Colors.textTertiary }]}>{mode.desc}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 4 },

  // ── Tab bar ──────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: Radius.lg, gap: 6,
  },
  tabBtnActive: { backgroundColor: Colors.primaryLighter },
  tabBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.primary, fontFamily: FontFamily.bold },
  tabCount: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#fff' },

  // ── Free practice ─────────────────────────────────────────────────────────
  accessRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  accessBadge: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  accessFree: { backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  accessPremium: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  accessBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text },
  upgradeLink: { paddingHorizontal: 10 },
  upgradeLinkText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },

  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 10, marginTop: 12 },
  modesGrid: { gap: 10, marginBottom: 8 },
  modeCard: { borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.border, padding: 16, overflow: 'hidden', backgroundColor: Colors.surface, position: 'relative', ...Shadow.sm },
  modeCardSelected: { ...Shadow.primary },
  modeCheck: { position: 'absolute', top: 10, left: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  modeCheckText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#fff' },
  modeIcon: { fontSize: 28, textAlign: 'right', marginBottom: 6 },
  modeLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, textAlign: 'right', marginBottom: 3 },
  modeDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, textAlign: 'right', lineHeight: 20 },

  topicsHScrollOuter: { marginHorizontal: -16 },
  topicsHScroll: { paddingHorizontal: 16, gap: 10, flexDirection: 'row-reverse', paddingBottom: 4 },
  topicCard: { width: 140, height: 115, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.border, padding: 12, alignItems: 'flex-end', justifyContent: 'flex-start', ...Shadow.sm, position: 'relative', overflow: 'hidden' },
  topicCardLocked: { opacity: 0.55 },
  topicCheck: { position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topicCheckText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
  premiumBadge: { position: 'absolute', top: 8, left: 8 },
  premiumBadgeText: { fontSize: 14 },
  topicIcon: { fontSize: 36, marginBottom: 4 },
  topicName: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.text, textAlign: 'right', marginBottom: 2 },
  topicTitle: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, textAlign: 'right', marginTop: 2 },

  limitInfo: { backgroundColor: '#FEF3C7', borderRadius: Radius.lg, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#F59E0B' },
  limitInfoText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#92400E', textAlign: 'right' },

  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.glassStrong, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  startBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  startBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  startBtnGrad: { padding: 18, alignItems: 'center' },
  startBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  startBtnTextDisabled: { color: 'rgba(255,255,255,0.85)' },

  // ── Simulations ───────────────────────────────────────────────────────────
  emptySimulations: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptySimIcon: { fontSize: 52, marginBottom: 12 },
  emptySimTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, marginBottom: 6 },
  emptySimDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  simHeader: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20, marginBottom: 16, marginTop: 8 },

  simCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.md, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  simCardHeader: { padding: 16, flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between' },
  simCardHeaderRight: { flex: 1, alignItems: 'flex-end' },
  simCardName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff', textAlign: 'right' },
  simCardDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 4, lineHeight: 16 },
  simCardIcon: { fontSize: 28, marginRight: 8 },
  simCardBody: { padding: 16 },

  simStats: { flexDirection: 'row-reverse', gap: 6, marginBottom: 12 },

  simRulesBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 10, marginBottom: 10 },
  simRuleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  simRuleText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text },
  simRuleMeta: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },

  simRestNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginBottom: 10 },

  simStartBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  simStartGrad: { padding: 16, alignItems: 'center' },
  simStartText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
