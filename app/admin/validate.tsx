import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAdminStore } from '../../store/adminStore';
import { TOPICS } from '../../data/mockData';
import { Question } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

export default function ValidateQueue() {
  const { getPendingQuestions, validateQuestion, getQuestionsByStatus } = useAdminStore();
  const pending = getPendingQuestions();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [filter, setFilter] = useState<'pending' | 'rejected' | 'all'>('pending');

  const slideAnim = useState(new Animated.Value(0))[0];

  const animateOut = (direction: 'approve' | 'reject', cb: () => void) => {
    Animated.timing(slideAnim, {
      toValue: direction === 'approve' ? -400 : 400,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(0);
      cb();
    });
  };

  const handleApprove = (q: Question) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    animateOut('approve', () => {
      validateQuestion(q.id, 'validated');
      if (currentIdx >= pending.length - 1) setCurrentIdx(0);
    });
  };

  const handleReject = (q: Question) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    animateOut('reject', () => {
      validateQuestion(q.id, 'rejected');
      if (currentIdx >= pending.length - 1) setCurrentIdx(0);
    });
  };

  const handleSkip = () => {
    setCurrentIdx(i => (i + 1) % Math.max(1, pending.length));
  };

  const handleEdit = (q: Question) => {
    router.push({ pathname: '/admin/question-editor', params: { questionId: q.id, mode: 'edit' } });
  };

  const current = pending[currentIdx];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header stats */}
      <View style={styles.statsRow}>
        <StatPill label="ממתינות" value={pending.length} color={Colors.warning} />
        <StatPill label="נדחו" value={getQuestionsByStatus('rejected').length} color={Colors.danger} />
        <StatPill label="אושרו" value={getQuestionsByStatus('validated').length} color={Colors.success} />
      </View>

      {pending.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>אין שאלות ממתינות!</Text>
          <Text style={styles.emptyDesc}>כל השאלות עברו ולידציה.</Text>
          <Pressable
            onPress={() => router.push('/admin/ai-generator')}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>🤖 יצור שאלות חדשות</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Progress */}
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {currentIdx + 1} / {pending.length}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${((currentIdx + 1) / pending.length) * 100}%` }]}
              />
            </View>
          </View>

          {/* Card */}
          <Animated.View
            style={[
              styles.cardWrap,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <QuestionPreviewCard question={current} />
          </Animated.View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => handleReject(current)}
              style={({ pressed }) => [styles.rejectBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              <Text style={styles.rejectIcon}>❌</Text>
              <Text style={styles.rejectText}>דחה</Text>
            </Pressable>

            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.skipText}>דלג</Text>
            </Pressable>

            <Pressable
              onPress={() => handleEdit(current)}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.editText}>✏️ ערוך</Text>
            </Pressable>

            <Pressable
              onPress={() => handleApprove(current)}
              style={({ pressed }) => [styles.approveBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              <Text style={styles.approveIcon}>✅</Text>
              <Text style={styles.approveText}>אשר</Text>
            </Pressable>
          </View>

          {/* Bulk approve all */}
          <Pressable
            onPress={() => {
              Alert.alert(
                'אישור קבוצתי',
                `לאשר את כל ${pending.length} השאלות הממתינות?`,
                [
                  { text: 'ביטול', style: 'cancel' },
                  {
                    text: 'אשר הכל',
                    onPress: () => {
                      pending.forEach(q => validateQuestion(q.id, 'validated'));
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                  },
                ]
              );
            }}
            style={styles.bulkApproveBtn}
          >
            <Text style={styles.bulkApproveText}>✅ אשר את כל {pending.length} הממתינות</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

function QuestionPreviewCard({ question }: { question: Question }) {
  const topic = TOPICS.find(t => t.id === question.topicId);

  return (
    <View style={cardStyles.card}>
      {/* Meta */}
      <View style={cardStyles.meta}>
        <View style={[cardStyles.diffBadge, {
          backgroundColor: question.difficulty <= 3 ? Colors.successLight
            : question.difficulty <= 6 ? Colors.warningLight : Colors.dangerLight,
        }]}>
          <Text style={[cardStyles.diffText, {
            color: question.difficulty <= 3 ? Colors.success
              : question.difficulty <= 6 ? Colors.warning : Colors.danger,
          }]}>
            רמה {question.difficulty}
          </Text>
        </View>
        <Text style={cardStyles.typeBadge}>{question.questionType}</Text>
        <Text style={cardStyles.topicBadge}>{topic?.icon} {topic?.name}</Text>
      </View>

      {/* Question */}
      <Text style={cardStyles.questionText}>{question.questionText}</Text>

      {/* Options */}
      <View style={cardStyles.options}>
        {question.options.map(opt => (
          <View
            key={opt.id}
            style={[
              cardStyles.optionRow,
              opt.isCorrect && { backgroundColor: Colors.successLight, borderColor: Colors.success },
            ]}
          >
            <Text style={[cardStyles.optionId, opt.isCorrect && { color: Colors.success }]}>
              {opt.id.toUpperCase()}
            </Text>
            <Text style={cardStyles.optionText}>{opt.text}</Text>
            {opt.isCorrect && <Text style={cardStyles.correctMark}>✓</Text>}
          </View>
        ))}
      </View>

      {/* Explanation */}
      {question.explanation ? (
        <View style={cardStyles.explanation}>
          <Text style={cardStyles.explanationLabel}>💡 הסבר:</Text>
          <Text style={cardStyles.explanationText}>{question.explanation}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[pillStyles.pill, { borderColor: color + '40' }]}>
      <Text style={[pillStyles.value, { color }]}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  label: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  meta: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  diffBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  diffText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  typeBadge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  topicBadge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  questionText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 12,
  },
  options: { gap: 6, marginBottom: 12 },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  optionId: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary, width: 20, textAlign: 'center' },
  optionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  correctMark: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.success },
  explanation: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.lg,
    padding: 10,
  },
  explanationLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', marginBottom: 4 },
  explanationText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  statsRow: { flexDirection: 'row-reverse', padding: 12, gap: 8 },
  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  progressText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, width: 50, textAlign: 'right' },
  progressTrack: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.warning, borderRadius: 3 },
  cardWrap: { flex: 1, paddingHorizontal: 16, marginBottom: 12 },
  actions: {
    flexDirection: 'row-reverse',
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  rejectBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.danger,
  },
  rejectIcon: { fontSize: 20 },
  rejectText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.danger, marginTop: 2 },
  skipBtn: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  editBtn: {
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },
  approveBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.success,
  },
  approveIcon: { fontSize: 20 },
  approveText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.success, marginTop: 2 },
  bulkApproveBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  bulkApproveText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.success },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: Colors.text, marginBottom: 8 },
  emptyDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 24, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14, ...Shadow.primary },
  emptyBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
