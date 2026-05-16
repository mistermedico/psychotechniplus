import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAdminStore } from '../../store/adminStore';
import { TOPICS } from '../../data/mockData';
import { Question, ValidationStatus } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

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

const SORT_OPTIONS = ['חדש → ישן', 'ישן → חדש', 'קושי ↑', 'קושי ↓'];

export default function QuestionsAdmin() {
  const { questions, topics, selectedQuestionIds, toggleSelectQuestion, clearSelection,
    selectAll, deleteQuestions, bulkValidate, deleteQuestion } = useAdminStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ValidationStatus | 'all'>('all');
  const [filterTopicId, setFilterTopicId] = useState<string>('all');
  const [sortIdx, setSortIdx] = useState(0);
  const [bulkMode, setBulkMode] = useState(false);

  const filtered = useMemo(() => {
    let q = [...questions];
    if (search.trim()) {
      const s = search.toLowerCase();
      q = q.filter(x => x.questionText.toLowerCase().includes(s));
    }
    if (filterStatus !== 'all') q = q.filter(x => x.validationStatus === filterStatus);
    if (filterTopicId !== 'all') q = q.filter(x => x.topicId === filterTopicId);

    switch (sortIdx) {
      case 0: q.reverse(); break;
      case 2: q.sort((a, b) => a.difficulty - b.difficulty); break;
      case 3: q.sort((a, b) => b.difficulty - a.difficulty); break;
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
          <View style={styles.diffBadge}>
            <Text style={styles.diffText}>רמה {item.difficulty}</Text>
          </View>
          <Text style={styles.eloText}>ELO {item.psychometricStats.elo}</Text>
          {bulkMode && (
            <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
              {isSelected && <Text style={styles.checkMark}>✓</Text>}
            </View>
          )}
        </View>

        {/* Question text */}
        <Text style={styles.questionText} numberOfLines={2}>{item.questionText}</Text>

        {/* Topic + type */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerMeta}>{item.questionType}</Text>
          <Text style={styles.footerTopic}>{topic?.icon} {topic?.name ?? item.topicId}</Text>
        </View>

        {/* Quick actions */}
        {!bulkMode && (
          <View style={styles.quickActions}>
            <Pressable
              onPress={() => router.push({ pathname: '/admin/question-editor', params: { questionId: item.id, mode: 'edit' } })}
              style={[styles.qaBtn, { backgroundColor: Colors.primaryLighter }]}
            >
              <Text style={[styles.qaBtnText, { color: Colors.primary }]}>✏️ עריכה</Text>
            </Pressable>
            {item.validationStatus === 'pending' && (
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
            <Pressable
              onPress={() => {
                Alert.alert('מחיקה', 'למחוק שאלה זו?', [
                  { text: 'ביטול', style: 'cancel' },
                  { text: 'מחק', style: 'destructive', onPress: () => deleteQuestion(item.id) },
                ]);
              }}
              style={[styles.qaBtn, { backgroundColor: Colors.dangerLight }]}
            >
              <Text style={[styles.qaBtnText, { color: Colors.danger }]}>🗑️</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 חיפוש שאלה..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'validated', 'pending', 'draft', 'rejected'] as const).map(s => (
          <Pressable
            key={s}
            onPress={() => setFilterStatus(s)}
            style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterStatus === s && { color: '#fff' }]}>
              {s === 'all' ? 'הכל' : STATUS_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Topic filter + sort */}
      <View style={styles.secondRow}>
        <Pressable
          onPress={() => {
            const topicIds = ['all', ...TOPICS.map(t => t.id)];
            const idx = topicIds.indexOf(filterTopicId);
            setFilterTopicId(topicIds[(idx + 1) % topicIds.length]);
          }}
          style={styles.topicFilter}
        >
          <Text style={styles.topicFilterText}>
            {filterTopicId === 'all' ? '📚 כל הנושאים' :
              (TOPICS.find(t => t.id === filterTopicId)?.name ?? filterTopicId)}
            {' ▾'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSortIdx(i => (i + 1) % SORT_OPTIONS.length)}
          style={styles.sortBtn}
        >
          <Text style={styles.sortBtnText}>⇅ {SORT_OPTIONS[sortIdx]}</Text>
        </Pressable>
      </View>

      {/* Bulk mode bar */}
      {bulkMode && (
        <View style={styles.bulkBar}>
          <Pressable onPress={() => { clearSelection(); setBulkMode(false); }} style={styles.bulkCancel}>
            <Text style={styles.bulkCancelText}>ביטול</Text>
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
            <Text style={[styles.bulkActionText, { color: Colors.danger }]}>🗑️</Text>
          </Pressable>
        </View>
      )}

      {/* Count */}
      <Text style={styles.resultCount}>{filtered.length} שאלות</Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      {/* FAB */}
      {!bulkMode && (
        <Pressable
          onPress={() => router.push({ pathname: '/admin/question-editor', params: { mode: 'add' } })}
          style={styles.fab}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  searchBar: { padding: 12, paddingBottom: 0 },
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
  filterRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  secondRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  topicFilter: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topicFilterText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  sortBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  sortBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  bulkBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#0F172A',
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  bulkCancel: { paddingHorizontal: 8 },
  bulkCancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  bulkCount: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff', textAlign: 'center' },
  bulkAction: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulkActionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },

  resultCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: { paddingHorizontal: 12, paddingBottom: 80 },

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
  diffBadge: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diffText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  eloText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginRight: 4, flex: 1, textAlign: 'left' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { fontFamily: FontFamily.bold, fontSize: 12, color: '#fff' },
  questionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  footerTopic: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  footerMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  quickActions: { flexDirection: 'row-reverse', gap: 6, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  qaBtn: { borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 5 },
  qaBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  fab: {
    position: 'absolute',
    bottom: 24,
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
