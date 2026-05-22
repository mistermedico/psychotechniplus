import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, RefreshControl, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { TARGETS, TOPICS } from '../../data/mockData';
import { TargetCard } from '../../components/TargetCard';
import { ProgressBar } from '../../components/ProgressBar';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useUserStore } from '../../store/userStore';
import { LEVEL_LABELS } from '../../utils/adaptive';

// Animated topics container that springs in when a target is expanded
function AnimatedTopicsContainer({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(visible ? 0 : 20)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 160,
          friction: 14,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 20,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => setShouldRender(false));
      // Reset for next open
      translateY.setValue(20);
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function TargetsTab() {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { getTopicAccuracy, getTopicLevel, totalSessions } = useUserStore();

  const selected = TARGETS.find(t => t.id === selectedId);
  const selectedTopics = selected ? TOPICS.filter(t => t.targetId === selected.id) : [];

  const handleTargetPress = (id: string, comingSoon: boolean) => {
    if (comingSoon) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(prev => (prev === id ? null : id));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={Colors.gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>הכנה לפסיכוטכני</Text>
        <Text style={styles.heroSubtitle}>בחר מסלול ותרגל לפי רמה אישית</Text>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>🏆 {totalSessions} סשנים</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {TARGETS.filter(t => t.id === 'target_psychometric').map(target => {
          const topics = TOPICS.filter(t => t.targetId === target.id);
          const accuracies = topics.map(t => getTopicAccuracy(t.id));
          const avgAccuracy = accuracies.length > 0
            ? accuracies.reduce((s, a) => s + a, 0) / accuracies.length
            : 0;
          const progress = avgAccuracy;
          const progressPct = Math.round(progress * 100);
          const isExpanded = selectedId === target.id;

          return (
            <View key={target.id}>
              {/* TargetCard with coming-soon overlay */}
              <View style={styles.cardWrapper}>
                <TargetCard
                  target={target}
                  progress={progress}
                  sessionsCount={totalSessions}
                  onPress={() => handleTargetPress(target.id, !!target.comingSoon)}
                />
                {/* Progress percentage badge */}
                <View style={styles.progressPctBadge}>
                  <Text style={styles.progressPctText}>{progressPct}%</Text>
                </View>
                {/* Coming-soon overlay */}
                {target.comingSoon && (
                  <View style={styles.comingSoonOverlay}>
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>בקרוב</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Expanded topics section — animates in with spring */}
              <AnimatedTopicsContainer visible={isExpanded && !target.comingSoon}>
                <View style={styles.topicsContainer}>
                  <Text style={styles.topicsTitle}>נושאים במסלול</Text>

                  {selectedTopics.length === 0 ? (
                    <Text style={styles.emptyTopics}>אין נושאים זמינים</Text>
                  ) : (
                    selectedTopics.map((topic, index) => {
                      const topicAccuracy = getTopicAccuracy(topic.id);
                      const topicLevel = getTopicLevel(topic.id);
                      const topicPct = Math.round(topicAccuracy * 100);
                      const isLast = index === selectedTopics.length - 1;

                      return (
                        <View
                          key={topic.id}
                          style={[
                            styles.topicRow,
                            topic.isPremiumOnly && styles.topicLocked,
                            isLast && styles.topicRowLast,
                          ]}
                        >
                          {/* Right side: icon + name + accuracy */}
                          <View style={styles.topicInfo}>
                            <Text style={styles.topicIcon}>{topic.icon}</Text>
                            <View style={styles.topicTextBlock}>
                              <Text style={styles.topicName}>{topic.name}</Text>
                              <Text style={styles.topicElo}>
                                {LEVEL_LABELS[topicLevel]}
                              </Text>
                              <View style={styles.topicProgressRow}>
                                <View style={styles.topicProgressWrap}>
                                  <ProgressBar
                                    progress={topicAccuracy}
                                    color={topic.color}
                                    height={4}
                                  />
                                </View>
                                <Text style={[styles.topicProgressPct, { color: topic.color }]}>
                                  {topicAccuracy > 0 ? `${topicPct}%` : '—'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Left side: "תרגל ←" chip or 💎 lock */}
                          {topic.isPremiumOnly ? (
                            <Text style={styles.lockIcon}>💎</Text>
                          ) : (
                            <Pressable
                              style={({ pressed }) => [
                                styles.practiceChip,
                                { borderColor: topic.color, backgroundColor: topic.color + '18' },
                                pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                              ]}
                              onPress={() => {
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
                              <Text style={[styles.practiceChipText, { color: topic.color }]}>
                                תרגל ←
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })
                  )}

                  {/* Adaptive practice button at bottom of expanded section */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.adaptiveBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => {
                      const firstFreeTopic = selectedTopics.find(t => !t.isPremiumOnly);
                      if (!firstFreeTopic) {
                        Alert.alert('תרגול אדפטיבי', 'כל הנושאים במסלול זה דורשים מנוי פרמיום.');
                        return;
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({
                        pathname: '/practice-session',
                        params: {
                          topicId: firstFreeTopic.id,
                          targetId: target.id,
                          mode: 'adaptive',
                        },
                      });
                    }}
                  >
                    <LinearGradient
                      colors={Colors.gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.adaptiveBtnGrad}
                    >
                      <Text style={styles.adaptiveBtnText}>⚡ תרגול אדפטיבי</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </AnimatedTopicsContainer>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  heroTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize['3xl'],
    color: '#fff',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: 4,
  },
  heroBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#fff',
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },

  // Wrapper for TargetCard + overlays
  cardWrapper: {
    position: 'relative',
  },

  // Progress percentage badge — top-right corner (RTL: visually top-right)
  progressPctBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  progressPctText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#fff',
  },

  // Coming-soon overlay covers the entire card
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  comingSoonBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 8,
    ...Shadow.primary,
  },
  comingSoonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#fff',
  },

  // Expanded topics container
  topicsContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.xl,
    padding: 18,
    marginTop: 4,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    borderTopWidth: 3,
    borderTopColor: Colors.primary,
  },
  topicsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  emptyTopics: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Topic row: right side = info, left side = chip
  topicRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  topicRowLast: {
    borderBottomWidth: 0,
  },
  topicLocked: { opacity: 0.5 },

  // Right side: icon + text block
  topicInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topicIcon: { fontSize: 24 },
  topicTextBlock: { flex: 1, alignItems: 'flex-end' },
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
  topicProgressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  topicProgressWrap: { flex: 1 },
  topicProgressPct: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    minWidth: 32,
    textAlign: 'right',
  },

  lockIcon: { fontSize: 18 },

  // "תרגל ←" chip button
  practiceChip: {
    borderWidth: 1.5,
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 44,
    minWidth: 72,
  },
  practiceChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
  },

  // Adaptive practice button at bottom
  adaptiveBtn: {
    borderRadius: Radius.lg,
    marginTop: 12,
    overflow: 'hidden',
    ...Shadow.primary,
  },
  adaptiveBtnGrad: {
    padding: 14,
    alignItems: 'center',
  },
  adaptiveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#fff',
  },
});
