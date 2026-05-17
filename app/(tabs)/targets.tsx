import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { TARGETS, TOPICS } from '../../data/mockData';
import { TargetCard } from '../../components/TargetCard';
import { ProgressBar } from '../../components/ProgressBar';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useUserStore } from '../../store/userStore';
import { eloToTitle } from '../../utils/elo';

export default function TargetsTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { getTopicElo, totalSessions } = useUserStore();

  const selected = TARGETS.find(t => t.id === selectedId);
  const selectedTopics = selected ? TOPICS.filter(t => t.targetId === selected.id) : [];

  const handleTargetPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(prev => (prev === id ? null : id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>מסלולי הכנה</Text>
        <Text style={styles.subtitle}>בחר מסלול להתחיל לתרגל</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {TARGETS.map(target => {
          const topics = TOPICS.filter(t => t.targetId === target.id);
          const avgElo = topics.length > 0
            ? topics.reduce((s, t) => s + getTopicElo(t.id), 0) / topics.length
            : 1200;
          const progress = Math.max(0, Math.min(1, (avgElo - 900) / 600));

          return (
            <View key={target.id}>
              <TargetCard
                target={target}
                progress={progress}
                sessionsCount={totalSessions}
                onPress={() => handleTargetPress(target.id)}
              />

              {/* Expanded topics */}
              {selectedId === target.id && !target.comingSoon && (
                <View style={styles.topicsContainer}>
                  <Text style={styles.topicsTitle}>נושאים במסלול</Text>
                  {selectedTopics.map(topic => {
                    const elo = getTopicElo(topic.id);
                    const topicProgress = Math.max(0, Math.min(1, (elo - 900) / 600));
                    return (
                      <Pressable
                        key={topic.id}
                        style={({ pressed }) => [
                          styles.topicRow,
                          pressed && { opacity: 0.85 },
                          topic.isPremiumOnly && styles.topicLocked,
                        ]}
                        onPress={() => {
                          if (topic.isPremiumOnly) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push({
                            pathname: '/practice-session',
                            params: {
                              topicId: topic.id,
                              targetId: target.id,
                              mode: 'practice',
                            },
                          });
                        }}
                      >
                        <View style={styles.topicLeft}>
                          <Text style={styles.topicIcon}>{topic.icon}</Text>
                          <View>
                            <Text style={styles.topicName}>{topic.name}</Text>
                            <Text style={styles.topicElo}>
                              {eloToTitle(elo)} · ELO {elo}
                            </Text>
                            <View style={styles.topicProgressWrap}>
                              <ProgressBar
                                progress={topicProgress}
                                color={topic.color}
                                height={4}
                              />
                            </View>
                          </View>
                        </View>
                        {topic.isPremiumOnly ? (
                          <Text style={styles.lockIcon}>💎</Text>
                        ) : (
                          <Text style={styles.arrow}>←</Text>
                        )}
                      </Pressable>
                    );
                  })}

                  <Pressable
                    style={({ pressed }) => [
                      styles.practiceBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => {
                      const firstFreeTopic = selectedTopics.find(t => !t.isPremiumOnly);
                      if (firstFreeTopic) {
                        router.push({
                          pathname: '/practice-session',
                          params: {
                            topicId: firstFreeTopic.id,
                            targetId: target.id,
                            mode: 'adaptive',
                          },
                        });
                      }
                    }}
                  >
                    <Text style={styles.practiceBtnText}>⚡ תרגול אדפטיבי</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: Colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },

  topicsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginTop: 4,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topicsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  topicRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  topicLocked: { opacity: 0.5 },
  topicLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 },
  topicIcon: { fontSize: 24 },
  topicName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
  },
  topicElo: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  topicProgressWrap: { width: 120, marginTop: 6 },
  lockIcon: { fontSize: 18 },
  arrow: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.primary },

  practiceBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    ...Shadow.primary,
  },
  practiceBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#fff',
  },
});
