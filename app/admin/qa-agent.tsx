import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { analyzeQuestionBank, getQuestionVisibilityLabel, QuestionQaFinding } from '../../utils/questionQaAgent';
import { textAlign as ta, detectDir } from '../../utils/textDirection';

type FindingFilter = 'all' | 'critical' | 'warning' | 'performance' | 'hidden';

const FILTERS: Array<{ id: FindingFilter; label: string }> = [
  { id: 'all', label: 'כל הממצאים' },
  { id: 'critical', label: 'קריטי' },
  { id: 'warning', label: 'דורש שיפור' },
  { id: 'performance', label: 'חריגי מענה' },
  { id: 'hidden', label: 'לא מוצגות' },
];

export default function AdminQaAgent() {
  const insets = useSafeAreaInsets();
  const {
    questions,
    topics,
    sessionHistory,
    loadSessionHistory,
    loadAdminData,
    updateQuestion,
    bulkValidate,
    isSyncing,
    lastSyncedAt,
  } = useAdminStore();
  const [filter, setFilter] = useState<FindingFilter>('all');
  const [applying, setApplying] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    loadAdminData();
    loadSessionHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const findings = useMemo(() => analyzeQuestionBank(questions, sessionHistory), [questions, sessionHistory]);
  const filtered = useMemo(() => {
    if (filter === 'all') return findings;
    if (filter === 'critical') return findings.filter(f => f.issues.some(i => i.severity === 'critical'));
    if (filter === 'warning') return findings.filter(f => f.issues.some(i => i.severity === 'warning'));
    if (filter === 'performance') return findings.filter(f => f.issues.some(i => i.id.includes('accuracy')));
    return findings.filter(f => f.issues.some(i => i.id === 'hidden_validated'));
  }, [filter, findings]);

  const criticalCount = findings.filter(f => f.issues.some(i => i.severity === 'critical')).length;
  const warningCount = findings.filter(f => f.issues.some(i => i.severity === 'warning')).length;
  const attemptedCount = findings.filter(f => f.stats.attempts > 0).length;
  const cleanCount = Math.max(0, questions.length - findings.length);
  const lastSyncText = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : 'עדיין לא סונכרן';

  const applyFinding = async (finding: QuestionQaFinding) => {
    setApplying(finding.question.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      updateQuestion(finding.question.id, finding.suggestedQuestion);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setApplying(null);
    }
  };

  const applyBulkFixes = () => {
    const candidates = findings.filter(f =>
      f.issues.some(issue => issue.severity === 'critical' || issue.id === 'weak_explanation' || issue.id === 'hidden_validated')
    );
    if (candidates.length === 0) {
      Alert.alert('אין תיקונים להחלה', 'הסוכן לא מצא ממצאים שאפשר לתקן אוטומטית.');
      return;
    }
    Alert.alert(
      'להחיל תיקונים אוטומטיים?',
      `הסוכן יעדכן ${candidates.length} שאלות. שאלות עם אחוזי דיוק חריגים מאוד יוחזרו לבדיקה במקום להישאר מוצגות.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'החל תיקונים',
          onPress: async () => {
            setBulkApplying(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              candidates.forEach(finding => updateQuestion(finding.question.id, finding.suggestedQuestion));
              const recheckIds = candidates
                .filter(finding => finding.suggestedQuestion.validationStatus === 'pending')
                .map(finding => finding.question.id);
              if (recheckIds.length > 0) bulkValidate(recheckIds, 'pending');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } finally {
              setBulkApplying(false);
            }
          },
        },
      ]
    );
  };

  const renderFinding = ({ item }: { item: QuestionQaFinding }) => {
    const topic = topics.find(t => t.id === item.question.topicId);
    const visibility = getQuestionVisibilityLabel(item.question);
    const severe = item.issues.some(issue => issue.severity === 'critical');
    return (
      <View style={[styles.card, severe && styles.cardCritical]}>
        <View style={styles.cardTop}>
          <View style={styles.metaGroup}>
            <Text style={[styles.topicText, { color: topic?.color ?? Colors.primary }]}>
              {topic?.icon ?? 'ש'} {topic?.name ?? item.question.topicId}
            </Text>
            <Text style={styles.metaText}>{visibility}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: severe ? Colors.dangerLight : Colors.warningLight }]}>
            <Text style={[styles.severityText, { color: severe ? Colors.danger : Colors.warning }]}>
              {severe ? 'קריטי' : 'שיפור'}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.questionText, { textAlign: ta(item.question.questionText), writingDirection: detectDir(item.question.questionText) }]}
          numberOfLines={3}
        >
          {item.question.questionText}
        </Text>

        <View style={styles.statsRow}>
          <Stat label="ענו" value={String(item.stats.attempts)} />
          <Stat label="דיוק" value={item.stats.accuracy === null ? '—' : `${item.stats.accuracy}%`} />
          <Stat label="דילוגים" value={item.stats.skipRate === null ? '—' : `${item.stats.skipRate}%`} />
          <Stat label="רמה" value={String(item.question.difficulty)} />
        </View>

        <View style={styles.issuesBox}>
          {item.issues.map(issue => (
            <View key={issue.id} style={styles.issueRow}>
              <Text style={[styles.issueTitle, { color: issue.severity === 'critical' ? Colors.danger : issue.severity === 'warning' ? Colors.warning : Colors.cyan }]}>
                {issue.title}
              </Text>
              <Text style={styles.issueDetail}>{issue.detail}</Text>
            </View>
          ))}
        </View>

        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionLabel}>הצעת הסוכן</Text>
          <Text style={styles.suggestionText}>{item.suggestedSummary}</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push({ pathname: '/admin/question-editor', params: { questionId: item.question.id, mode: 'edit' } })}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>עריכה ידנית</Text>
          </Pressable>
          <Pressable
            disabled={applying === item.question.id}
            onPress={() => applyFinding(item)}
            style={({ pressed }) => [styles.primaryBtn, (pressed || applying === item.question.id) && { opacity: 0.72 }]}
          >
            {applying === item.question.id
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>החל תיקון</Text>
            }
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>סוכן QA לשאלות</Text>
        <Text style={styles.subtitle}>
          סריקה חכמה של שאלות, הסברים, מסיחים, סטטוס הצגה וביצועים בפועל. סנכרון אחרון: {lastSyncText}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <Summary label="תקינות" value={cleanCount} color={Colors.success} />
        <Summary label="קריטיות" value={criticalCount} color={Colors.danger} />
        <Summary label="שיפור" value={warningCount} color={Colors.warning} />
        <Summary label="עם נתוני מענה" value={attemptedCount} color={Colors.cyan} />
      </View>

      <View style={styles.bulkPanel}>
        <View style={styles.bulkText}>
          <Text style={styles.bulkTitle}>תיקון וסנכרון אוטומטי</Text>
          <Text style={styles.bulkSub}>כל תיקון נשמר דרך פאנל הניהול ומתעדכן בסופאבייס ובאפליקציה.</Text>
        </View>
        <Pressable
          disabled={bulkApplying || isSyncing}
          onPress={applyBulkFixes}
          style={({ pressed }) => [styles.bulkBtn, (pressed || bulkApplying || isSyncing) && { opacity: 0.7 }]}
        >
          {bulkApplying || isSyncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.bulkBtnText}>תקן הכל</Text>}
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.question.id}
        renderItem={renderFinding}
        ListHeaderComponent={(
          <View style={styles.filtersRow}>
            {FILTERS.map(item => (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>הסוכן לא מצא בעיות</Text>
            <Text style={styles.emptyText}>כל השאלות במסנן הנוכחי נראות תקינות לפי בדיקות המבנה, ההסבר והביצועים.</Text>
          </View>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: color + '55' }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, writingDirection: 'rtl' },
  header: { padding: 16, alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { marginTop: 6, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl', lineHeight: 20 },
  summaryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, padding: 12 },
  summaryCard: { flexGrow: 1, minWidth: '22%', backgroundColor: Colors.surface, borderWidth: 1, borderRadius: Radius.lg, padding: 10, alignItems: 'flex-end' },
  summaryValue: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  summaryLabel: { marginTop: 3, fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  bulkPanel: { marginHorizontal: 12, marginBottom: 10, padding: 12, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.primary + '44', backgroundColor: Colors.primaryLighter, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  bulkText: { flex: 1, alignItems: 'flex-end' },
  bulkTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  bulkSub: { marginTop: 3, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  bulkBtn: { minWidth: 96, minHeight: 42, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingHorizontal: 14 },
  bulkBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  filtersRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  filterChip: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 7 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 12 },
  card: { marginBottom: 10, padding: 14, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, ...Shadow.sm },
  cardCritical: { borderColor: Colors.danger + '66' },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaGroup: { flex: 1, alignItems: 'flex-end' },
  topicText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'right', writingDirection: 'rtl' },
  metaText: { marginTop: 2, fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', writingDirection: 'rtl' },
  severityBadge: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  severityText: { fontFamily: FontFamily.bold, fontSize: 10 },
  questionText: { marginTop: 10, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, lineHeight: 21 },
  statsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  statCard: { flex: 1, minHeight: 54, borderRadius: Radius.lg, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  statLabel: { marginTop: 2, fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
  issuesBox: { marginTop: 12, gap: 8 },
  issueRow: { alignItems: 'flex-end', borderRightWidth: 3, borderRightColor: Colors.borderStrong, paddingRight: 9 },
  issueTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'right', writingDirection: 'rtl' },
  issueDetail: { marginTop: 2, fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl', lineHeight: 18 },
  suggestionBox: { marginTop: 12, borderRadius: Radius.lg, backgroundColor: Colors.successLight, borderWidth: 1, borderColor: Colors.success + '44', padding: 10, alignItems: 'flex-end' },
  suggestionLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.success, textAlign: 'right' },
  suggestionText: { marginTop: 3, fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  actionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  primaryBtn: { flex: 1, minHeight: 42, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  secondaryBtn: { flex: 1, minHeight: 42, borderRadius: Radius.lg, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  empty: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.success, textAlign: 'center', writingDirection: 'rtl' },
  emptyText: { marginTop: 8, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', writingDirection: 'rtl', lineHeight: 20 },
});
