import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { TARGETS, TOPICS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useUserStore } from '../../store/userStore';
import { eloToTitle } from '../../utils/elo';

const MODES = [
  {
    id: 'practice',
    icon: '📖',
    label: 'תרגול חופשי',
    desc: 'בחר נושא ותרגל בקצב שלך עם הסברים',
    color: Colors.primary,
    gradient: Colors.gradients.primary,
  },
  {
    id: 'adaptive',
    icon: '🧠',
    label: 'תרגול אדפטיבי',
    desc: 'מנוע ELO מתאים את הקושי לרמתך בזמן אמת',
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

// Animated mode card with spring scale on selection and fade-in checkmark
function ModeCard({
  mode,
  isSelected,
  onPress,
}: {
  mode: typeof MODES[number];
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(isSelected ? 1.01 : 1)).current;
  const checkOpacity = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSelected ? 1.01 : 1,
      useNativeDriver: true,
      tension: 180,
      friction: 12,
    }).start();
    Animated.timing(checkOpacity, {
      toValue: isSelected ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
    >
      <Animated.View
        style={[
          styles.modeCard,
          isSelected && styles.modeCardSelected,
          { borderColor: isSelected ? mode.color : Colors.border },
          { transform: [{ scale }] },
        ]}
      >
        {isSelected && (
          <LinearGradient
            colors={mode.gradient}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
        )}
        {/* Animated checkmark — top-right corner (in RTL layout, top-left in LTR coords) */}
        <Animated.View style={[styles.modeCheck, { opacity: checkOpacity }]}>
          <Text style={styles.modeCheckText}>✓</Text>
        </Animated.View>
        <Text style={styles.modeIcon}>{mode.icon}</Text>
        <Text style={[styles.modeLabel, { color: isSelected ? '#fff' : Colors.text }]}>
          {mode.label}
        </Text>
        <Text
          style={[
            styles.modeDesc,
            { color: isSelected ? 'rgba(255,255,255,0.8)' : Colors.textTertiary },
          ]}
        >
          {mode.desc}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function PracticeTab() {
  const [selectedMode, setSelectedMode] = useState('practice');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const { selectedTargetId, getTopicElo } = useUserStore();

  const target = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  // All topics for the selected target — premium ones shown grayed out
  const topics = TOPICS.filter(t => t.targetId === target.id);

  const canStart = selectedTopicId !== null;

  const handleStart = () => {
    if (!selectedTopicId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/practice-session',
      params: {
        topicId: selectedTopicId,
        targetId: target.id,
        mode: selectedMode,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>בחר תרגול</Text>
          <Text style={styles.subtitle}>מה מתאמנים היום?</Text>
        </View>

        {/* Mode selector — stacked vertically, spring animation on selection */}
        <Text style={styles.sectionLabel}>מצב תרגול</Text>
        <View style={styles.modesGrid}>
          {MODES.map(mode => (
            <ModeCard
              key={mode.id}
              mode={mode}
              isSelected={selectedMode === mode.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedMode(mode.id);
              }}
            />
          ))}
        </View>

        {/* Topic selector — horizontal scroll, each card 150×120 */}
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
            const isPremium = topic.isPremiumOnly;
            return (
              <Pressable
                key={topic.id}
                disabled={isPremium}
                onPress={() => {
                  if (isPremium) return;
                  Haptics.selectionAsync();
                  setSelectedTopicId(prev => (prev === topic.id ? null : topic.id));
                }}
                style={({ pressed }) => [
                  styles.topicCard,
                  isSelected && { borderColor: topic.color, backgroundColor: topic.color + '12' },
                  isPremium && styles.topicCardLocked,
                  pressed && !isPremium && { transform: [{ scale: 0.96 }] },
                ]}
              >
                {/* Premium badge — top-left (LTR coords = top-right in RTL view) */}
                {isPremium && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>💎</Text>
                  </View>
                )}
                {/* Selected checkmark */}
                {isSelected && !isPremium && (
                  <View style={[styles.topicCheck, { backgroundColor: topic.color }]}>
                    <Text style={styles.topicCheckText}>✓</Text>
                  </View>
                )}
                <Text style={styles.topicIcon}>{topic.icon}</Text>
                <Text
                  style={[
                    styles.topicName,
                    isSelected && !isPremium && { color: topic.color },
                    isPremium && { color: Colors.textTertiary },
                  ]}
                  numberOfLines={2}
                >
                  {topic.name}
                </Text>
                <Text style={styles.topicElo}>ELO {elo}</Text>
                <Text style={[styles.topicTitle, { color: isPremium ? Colors.textTertiary : topic.color }]}>
                  {eloToTitle(elo)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Spacer so content doesn't hide under sticky button */}
        <View style={styles.stickyButtonSpacer} />
      </ScrollView>

      {/* Sticky start button — outside ScrollView, anchored to bottom */}
      <View style={styles.stickyBar}>
        <Pressable
          onPress={handleStart}
          disabled={!canStart}
          style={({ pressed }) => [
            styles.startBtn,
            !canStart && styles.startBtnDisabled,
            pressed && canStart && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={canStart ? Colors.gradients.primary : ['#CBD5E1', '#94A3B8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startBtnGrad}
          >
            <Text style={[styles.startBtnText, !canStart && styles.startBtnTextDisabled]}>
              {canStart ? 'התחל תרגול ←' : 'בחר נושא כדי להתחיל'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 4 },

  header: { marginBottom: 16 },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },

  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 10,
    marginTop: 12,
  },

  // Mode cards — stacked vertically
  modesGrid: { gap: 10, marginBottom: 8 },
  modeCard: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    position: 'relative',
    ...Shadow.sm,
  },
  modeCardSelected: { ...Shadow.primary },
  // Checkmark pinned top-right corner in RTL (absolute left in LTR coordinate space)
  modeCheck: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modeCheckText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#fff' },
  modeIcon: { fontSize: 28, textAlign: 'right', marginBottom: 6 },
  modeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    textAlign: 'right',
    marginBottom: 3,
  },
  modeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'right',
    lineHeight: 20,
  },

  // Topic horizontal scroll
  topicsHScrollOuter: { marginHorizontal: -20 },
  topicsHScroll: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row-reverse',
    paddingBottom: 4,
  },
  topicCard: {
    width: 150,
    height: 120,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    ...Shadow.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  topicCardLocked: {
    opacity: 0.55,
  },
  // Checkmark circle pinned top-left (LTR coords) = top-right in RTL view
  topicCheck: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicCheckText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  premiumBadgeText: { fontSize: 14 },
  topicIcon: { fontSize: 40, marginBottom: 4 },
  topicName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 2,
  },
  topicElo: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  topicTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: 2,
  },

  // Spacer below scroll content so nothing hides behind the sticky bar
  stickyButtonSpacer: { height: 100 },

  // Sticky bottom bar — positioned outside ScrollView
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  startBtn: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.primary,
  },
  startBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  startBtnGrad: { padding: 18, alignItems: 'center' },
  startBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#fff',
  },
  startBtnTextDisabled: {
    color: 'rgba(255,255,255,0.85)',
  },
});
