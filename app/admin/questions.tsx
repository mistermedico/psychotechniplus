import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { TOPICS } from '../../data/mockData';
import { Question, ValidationStatus } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { detectDir, textAlign as ta } from '../../utils/textDirection';

const STATUS_COLORS: Record<ValidationStatus, string> = {
  validated: Colors.success,
  pending: Colors.warning,
  draft: Colors.textTertiary,
  rejected: Colors.danger,
};

const STATUS_LABELS: Record<ValidationStatus, string> = {
  validated: 'מאושר',
  pending: 'ממתין',
  draft: 'טיוטה',
  rejected: 'נדחה',
};

const SORT_OPTIONS = ['חדש → ישן', 'ישן → חדש', 'קושי ↑', 'קושי ↓', 'ELO ↑', 'ELO ↓'];

export default function QuestionsAdmin() {
  const insets = useSafeAreaInsets();
  const { questions, topics, selectedQuestionIds, toggleSelectQuestion, clearSelection,
    selectAll, deleteQuestions, bulkValidate, deleteQuestion, addQuestion } = useAdminStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ValidationStatus | 'all'>('all');
  const [filterTopicId, setFilterTopicId] = useState<string>('all');
  const [sortIdx, setSortIdx] = useState(0);
  const [bulkMode, setBulkMode] = useState(false);

  const filtered = useMemo(() => {
    let q = [...questions];
    if (search.trim()) {
      const s = search.toLowerCase();
      q = q.filter(x => x.questionText.toLowerCase().includes(s) ||
        x.explanation?.toLowerCase().includes(s));
    }
    if (filterStatus !== 'all') q = q.filter(x => x.validationStatus === filterStatus);
    if (filterTopicId !== 'all') q = q.filter(x => x.topicId === filterTopicId);

    switch (sortIdx) {
      case 0: q = q.slice().reverse(); break;
      case 1: /* natural order = oldest first */ break;
      case 2: q = q.slice().sort((a, b) => a.difficulty - b.difficulty); break;
      case 3: q = q.slice().sort((a, b) => b.difficulty - a.difficulty); break;
      case 4: q = q.slice().sort((a, b) => a.psychometricStats.elo - b.psychometricStats.elo); break;
      case 5: q = q.slice().sort((a, b) => b.psychometricStats.elo - a.psychometricStats.elo); break;
    }
    return q;
  }, [questions, search, filterStatus, filterTopicId, sortIdx]);

  const handleBulkAction = (action: 'approve' | 'reject' | 'delete') => {
    if (selectedQuestionIds.length === 0) return;
    Alert.alert(
      'פעולה קבוצתית',
      `${action === 'delete' ? 'מחיקת' : action === 'approve' ? 'אישור' : 'דחיית'} ${selectedQuestionIds.length} שאלות?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          style: action === 'delete' ? 'destructive' : 'default',
          onPress: () => {
            if (action === 'delete') deleteQuestions(selectedQuestionIds);
            else if (action === 'approve') bulkValidate(selectedQuestionIds, 'validated');
            else bulkValidate(selectedQuestionIds, 'rejected');
            setBulkMode(false);
          },
        },
      ]
    );
  };

  const handleDuplicate = (item: Question) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addQuestion({
      ...item,
      questionText: `[עותק] ${item.questionText}`,
      validationStatus: 'draft',
      smartPracticeEligible: false,
      generalPracticeEligible: false,
    });
    Alert.alert('שוכפל', 'עותק נוצר כטיוטה');
  };

  const renderItem = ({ item }: { item: Question }) => {
    const topic = TOPICS.find(t => t.id === item.topicId);
    const isSelected = selectedQuestionIds.includes(item.id);

    return (
      <Pressable
        onPress={() => {
          if (bulkMode) {
            Haptics.selectionAsync();
            toggleSelectQuestion(item.id);
          } else {
            router.push({ pathname: '/admin/question-editor', params: { questionId: item.id, mode: 'edit' } });
          }
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setBulkMode(true);
          toggleSelectQuestion(item.id);
        }}
        style={({ pressed }) => [
          styles.card,
          isSelected && styles.cardSelected,
          pressed && { opacity: 0.85 },
        ]}
      >
        {/* Status + difficulty */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.validationStatus] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.validationStatus] }]}>
            {STATUS_LABELS[item.validationStatus]}
          </Text>
          <View style={[styles.diffBadge, {
            backgroundColor: item.difficulty <= 3 ? Colors.successLight :
              item.difficulty <= 6 ? Colors.warningLight : Colors.dangerLight,
          }]}>
            <Text style={[styles.diffText, {
              color: item.difficulty <= 3 ? Colors.success :
                item.difficulty <= 6 ? Colors.warning : Colors.danger,
            }]}>
              רמה {item.difficulty}
            </Text>
          </View>
          <Text style={styles.eloText}>ELO {item.psychometricStats.elo}</Text>
          <Text style={[styles.accessBadge, { color: item.accessLevel === 'premium' ? Colors.warning : Colors.success }]}>
            {item.accessLevel === 'premium' ? '💎' : '🆓'}
          </Text>
          {bulkMode && (
            <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
              {isSelected && <Text style={styles.checkMark}>✓</Text>}
            </View>
          )}
        </View>

        {/* Question text */}
        <View style={styles.questionTextRow}>
          <Text
            style={[styles.questionText, { flex: 1, textAlign: ta(item.questionText), writingDirection: detectDir(item.questionText) }]}
            numberOfLines={2}
          >
            {item.questionText}
          </Text>
          {item.mediaUrl && <Text style={styles.imageBadge}>🖼️</Text>}
        </View>

        {/* Topic + type */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerMeta}>{item.questionType}</Text>
          {topic && (
            <View style={[styles.topicPill, { backgroundColor: topic.color + '18', borderColor: topic.color + '40' }]}>
              <Text style={[styles.topicPillText, { color: topic.color }]}>
                {topic.icon} {topic.name}
              </Text>
            </View>
          )}
        </View>

        {/* Quick actions — horizontal scroll so they never wrap */}
        {!bulkMode && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickActionsScroll}
            contentContainerStyle={styles.quickActionsContent}
          >
            <Pressable
              onPress={() => router.push({ pathname: '/admin/question-editor', params: { questionId: item.id, mode: 'edit' } })}
              style={[styles.qaBtn, { backgroundColor: Colors.primaryLighter }]}
            >
              <Text style={[styles.qaBtnText, { color: Colors.primary }]}>✏️ ערוך</Text>
            </Pressable>
            {item.validationStatus !== 'validated' && (
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  bulkValidate([item.id], 'validated');
                }}
                style={[styles.qaBtn, { backgroundColor: Colors.successLight }]}
              >
                <Text style={[styles.qaBtnText, { color: Colors.success }]}>✅ אשר</Text>
              </Pressable>
            )}
            {(item.validationStatus === 'pending' || item.validationStatus === 'validated') && (
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  bulkValidate([item.id], 'rejected');
                }}
                style={[styles.qaBtn, { backgroundColor: Colors.dangerLight }]}
              >
                <Text style={[styles.qaBtnText, { color: Colors.danger }]}>❌ דחה</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => handleDuplicate(item)}
              style={[styles.qaBtn, { backgroundColor: Colors.surfaceSecondary }]}
            >
              <Text style={[styles.qaBtnText, { color: Colors.textSecondary }]}>📋 שכפל</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Alert.alert('מחיקה', 'למחוק שאלה זו?', [
                  { text: 'ביטול', style: 'cancel' },
                  { text: 'מחק', style: 'destructive', onPress: () => deleteQuestion(item.id) },
                ]);
              }}
              style={[styles.qaBtn, { backgroundColor: Colors.dangerLight }]}
            >
              <Text style={[styles.qaBtnText, { color: Colors.danger }]}>🗑️ מחק</Text>
            </Pressable>
          </ScrollView>
        )}
      </Pressable>
    );
  };

  const pendingCount = questions.filter(q => q.validationStatus === 'pending').length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 חיפוש בשאלות ובהסברים..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filter — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollWrap}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', 'validated', 'pending', 'draft', 'rejected'] as const).map(s => (
          <Pressable
            key={s}
            onPress={() => setFilterStatus(s)}
            style={[
              styles.filterChip,
              filterStatus === s && (s === 'all'
                ? styles.filterChipActive
                : { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }),
            ]}
          >
            <Text style={[styles.filterChipText, filterStatus === s && { color: '#fff' }]}>
              {s === 'all' ? 'הכל' : STATUS_LABELS[s]}
              {s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Topic filter + sort — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollWrap}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          onPress={() => setFilterTopicId('all')}
          style={[styles.filterChip, filterTopicId === 'all' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, filterTopicId === 'all' && { color: '#fff' }]}>
            📚 כל הנושאים
          </Text>
        </Pressable>
        {TOPICS.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setFilterTopicId(filterTopicId === t.id ? 'all' : t.id)}
            style={[
              styles.filterChip,
              filterTopicId === t.id && { backgroundColor: t.color, borderColor: t.color },
            ]}
          >
            <Text style={[styles.filterChipText, filterTopicId === t.id && { color: '#fff' }]}>
              {t.icon} {t.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setSortIdx(i => (i + 1) % SORT_OPTIONS.length)}
          style={styles.sortChip}
        >
          <Text style={styles.filterChipText}>⇅ {SORT_OPTIONS[sortIdx]}</Text>
        </Pressable>
      </ScrollView>

      {/* Bulk mode bar — horizontal scroll */}
      {bulkMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bulkBarWrap}
          contentContainerStyle={styles.bulkBar}
        >
          <Pressable onPress={() => { clearSelection(); setBulkMode(false); }} style={styles.bulkCancel}>
            <Text style={styles.bulkCancelText}>✕ ביטול</Text>
          </Pressable>
          <Text style={styles.bulkCount}>{selectedQuestionIds.length} נבחרו</Text>
          <Pressable onPress={() => selectAll()} style={styles.bulkAction}>
            <Text style={styles.bulkActionText}>בחר הכל</Text>
          </Pressable>
          <Pressable onPress={() => handleBulkAction('approve')} style={[styles.bulkAction, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.bulkActionText, { color: Colors.success }]}>✅ אשר</Text>
          </Pressable>
          <Pressable onPress={() => handleBulkAction('reject')} style={[styles.bulkAction, { backgroundColor: Colors.dangerLight }]}>
            <Text style={[styles.bulkActionText, { color: Colors.danger }]}>❌ דחה</Text>
          </Pressable>
          <Pressable onPress={() => handleBulkAction('delete')} style={[styles.bulkAction, { backgroundColor: Colors.dangerLight }]}>
            <Text style={[styles.bulkActionText, { color: Colors.danger }]}>🗑️ מחק</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Count + pending indicator */}
      <View style={styles.summaryRow}>
        <Text style={styles.resultCount}>{filtered.length} מתוך {questions.length} שאלות</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingIndicator}>⏳ {pendingCount} ממתינות לאישור</Text>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      {/* FAB — respects safe area */}
      {!bulkMode && (
        <Pressable
          onPress={() => router.push({ pathname: '/admin/question-editor', params: { mode: 'add' } })}
          style={[styles.fab, { bottom: Math.max(24, insets.bottom + 16) }]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  searchBar: { padding: 12, paddingBottom: 8 },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  filterScrollWrap: { maxHeight: 44 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row-reverse' },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  bulkBarWrap: { backgroundColor: '#0F172A', maxHeight: 52 },
  bulkBar: { paddingHorizontal: 10, paddingVertical: 10, gap: 8, flexDirection: 'row-reverse', alignItems: 'center' },
  bulkCancel: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.1)' },
  bulkCancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  bulkCount: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff', paddingHorizontal: 6 },
  bulkAction: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkActionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  resultCount: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  pendingIndicator: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.warning },

  list: { paddingHorizontal: 12 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardSelected: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: Colors.primaryLighter },

  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  diffBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  diffText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  eloText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, flex: 1, textAlign: 'right' },
  accessBadge: { fontSize: 12 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { fontFamily: FontFamily.bold, fontSize: 12, color: '#fff' },

  questionTextRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 8, gap: 6 },
  questionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  imageBadge: { fontSize: 14 },

  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  footerMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  topicPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  topicPillText: { fontFamily: FontFamily.medium, fontSize: 11 },

  quickActionsScroll: { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  quickActionsContent: { flexDirection: 'row-reverse', gap: 6 },
  qaBtn: { borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  qaBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  fab: {
    position: 'absolute',
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.primary,
  },
  fabText: { fontFamily: FontFamily.bold, fontSize: 28, color: '#fff', lineHeight: 32 },
});
