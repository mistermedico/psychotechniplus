import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
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

export default function PracticeTab() {
  const [selectedMode, setSelectedMode] = useState('practice');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const { selectedTargetId, getTopicElo } = useUserStore();

  const target = TARGETS.find(t => t.id === selectedTargetId) ?? TARGETS[0];
  const topics = TOPICS.filter(t => t.targetId === target.id && !t.isPremiumOnly);

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
      >
        <View style={styles.header}>
          <Text style={styles.title}>בחר תרגול</Text>
          <Text style={styles.subtitle}>מה מתאמנים היום?</Text>
        </View>

        {/* Mode selector */}
        <Text style={styles.sectionLabel}>מצב תרגול</Text>
        <View style={styles.modesGrid}>
          {MODES.map(mode => (
            <Pressable
              key={mode.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedMode(mode.id);
              }}
              style={({ pressed }) => [
                styles.modeCard,
                selectedMode === mode.id && styles.modeCardSelected,
                { borderColor: selectedMode === mode.id ? mode.color : Colors.border },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              {selectedMode === mode.id && (
                <LinearGradient
                  colors={mode.gradient}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                />
              )}
              <Text style={styles.modeIcon}>{mode.icon}</Text>
              <Text
                style={[
                  styles.modeLabel,
                  { color: selectedMode === mode.id ? '#fff' : Colors.text },
                ]}
              >
                {mode.label}
              </Text>
              <Text
                style={[
                  styles.modeDesc,
                  { color: selectedMode === mode.id ? 'rgba(255,255,255,0.8)' : Colors.textTertiary },
                ]}
              >
                {mode.desc}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Topic selector */}
        <Text style={styles.sectionLabel}>בחר נושא</Text>
        <View style={styles.topicsGrid}>
          {topics.map(topic => {
            const elo = getTopicElo(topic.id);
            const isSelected = selectedTopicId === topic.id;
            return (
              <Pressable
                key={topic.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedTopicId(prev => (prev === topic.id ? null : topic.id));
                }}
                style={({ pressed }) => [
                  styles.topicCard,
                  isSelected && { borderColor: topic.color, backgroundColor: topic.color + '12' },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Text style={styles.topicIcon}>{topic.icon}</Text>
                <Text style={[styles.topicName, isSelected && { color: topic.color }]}>
                  {topic.name}
                </Text>
                <Text style={styles.topicElo}>ELO {elo}</Text>
                <Text style={[styles.topicTitle, { color: topic.color }]}>
                  {eloToTitle(elo)}
                </Text>
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: topic.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Start button */}
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
            <Text style={styles.startBtnText}>
              {canStart ? 'התחל תרגול ←' : 'בחר נושא כדי להתחיל'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 4 },

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

  modesGrid: { gap: 10, marginBottom: 8 },
  modeCard: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  modeCardSelected: { ...Shadow.primary },
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

  topicsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  topicCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'flex-end',
    ...Shadow.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  topicIcon: { fontSize: 28, marginBottom: 6 },
  topicName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 4,
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
  checkmark: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#fff' },

  startBtn: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.primary,
  },
  startBtnDisabled: { shadowOpacity: 0 },
  startBtnGrad: { padding: 18, alignItems: 'center' },
  startBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
});
