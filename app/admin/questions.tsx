import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { AccessLevel, Question, QuestionType, ValidationStatus } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { detectDir, textAlign as ta } from '../../utils/textDirection';
import { buildQuestionPerformanceMap, getQuestionVisibilityLabel } from '../../utils/questionQaAgent';
import AdminSyncToolbar from '../../components/AdminSyncToolbar';
import { VisualImage } from '../../components/VisualImage';

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

const SORT_OPTIONS = ['חדש → ישן', 'ישן → חדש', 'קושי ↑', 'קושי ↓', 'גישה חופשית', 'גישה פרמיום'];

const TYPE_LABELS: Partial<Record<QuestionType, string>> = {
  quantitative: 'כמותי',
  logic: 'לוגי',
  verbal: 'מילולי',
  shapes: 'מרחבי',
  fill_in_the_blank: 'השלמה',
  reading_comprehension: 'הבנת הנקרא',
  multiple_choice: 'רב ברירה',
};

type QualityFilter = 'all' | 'missingExplanation' | 'weakOptions' | 'invalidAnswer' | 'difficulty';

function hasQualityIssue(q: Question, issue: Exclude<QualityFilter, 'all'>) {
  if (issue === 'missingExplanation') return !q.explanation?.trim() || q.explanation.trim().length < 12;
  if (issue === 'weakOptions') return q.options.length > 0 && q.options.length < 4;
  if (issue === 'difficulty') return q.difficulty < 1 || q.difficulty > 10;
  const markedCorrect = q.options.filter(option => option.isCorrect).length;
  const answerMatchesOption = q.options.some(option => option.id === q.correctAnswer || option.text === q.correctAnswer);
  return q.options.length > 0 && (markedCorrect > 1 || (markedCorrect === 0 && !answerMatchesOption));
}

function isSpatialQuestion(q: Question) {
  const text = `${q.topicId} ${q.questionType} ${q.questionText}`.toLowerCase();
  return q.topicId === 'topic_spatial'
    || q.questionType === 'shapes'
    || text.includes('מרחב')
    || text.includes('צור')
    || text.includes('קוב')
    || text.includes('סיבוב')
    || text.includes('מטריצ');
}

export default function QuestionsAdmin() {
  const insets = useSafeAreaInsets();
  const { questions, topics, selectedQuestionIds, toggleSelectQuestion, clearSelection,
    selectAll, deleteQuestions, bulkValidate, deleteQuestion, addQuestion,
    setQuestionsAccessLevel, setQuestionsAdaptiveEligibility,
    sessionHistory, loadSessionHistory } = useAdminStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ValidationStatus | 'all'>('all');
  const [filterTopicId, setFilterTopicId] = useState<string>('all');
  const [filterAccess, setFilterAccess] = useState<AccessLevel | 'all'>('all');
  const [filterType, setFilterType] = useState<QuestionType | 'all'>('all');
  const [filterPool, setFilterPool] = useState<'all' | 'smart' | 'general' | 'missing'>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [sortIdx, setSortIdx] = useState(0);
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    loadSessionHistory();
  }, [loadSessionHistory]);

  const filtered = useMemo(() => {
    let q = [...questions];
    if (search.trim()) {
      const s = search.toLowerCase();
      q = q.filter(x => x.questionText.toLowerCase().includes(s) ||
        x.explanation?.toLowerCase().includes(s) ||
        x.id.toLowerCase().includes(s));
    }
    if (filterStatus !== 'all') q = q.filter(x => x.validationStatus === filterStatus);
    if (filterTopicId !== 'all') q = q.filter(x => x.topicId === filterTopicId);
    if (filterAccess !== 'all') q = q.filter(x => x.accessLevel === filterAccess);
    if (filterType !== 'all') q = q.filter(x => x.questionType === filterType);
    if (filterPool === 'smart') q = q.filter(x => x.smartPracticeEligible);
    if (filterPool === 'general') q = q.filter(x => x.generalPracticeEligible);
    if (filterPool === 'missing') q = q.filter(x => !x.smartPracticeEligible && !x.generalPracticeEligible);
    if (qualityFilter !== 'all') q = q.filter(x => hasQualityIssue(x, qualityFilter));

    switch (sortIdx) {
      case 0: q = q.slice().reverse(); break;
      case 1: /* natural order = oldest first */ break;
      case 2: q = q.slice().sort((a, b) => a.difficulty - b.difficulty); break;
      case 3: q = q.slice().sort((a, b) => b.difficulty - a.difficulty); break;
      case 4: q = q.slice().sort((a, b) => (a.accessLevel === 'free' ? -1 : 1) - (b.accessLevel === 'free' ? -1 : 1)); break;
      case 5: q = q.slice().sort((a, b) => (a.accessLevel === 'premium' ? -1 : 1) - (b.accessLevel === 'premium' ? -1 : 1)); break;
    }
    return q;
  }, [questions, search, filterStatus, filterTopicId, filterAccess, filterType, filterPool, qualityFilter, sortIdx]);

  const audit = useMemo(() => {
    const validated = questions.filter(q => q.validationStatus === 'validated').length;
    const premium = questions.filter(q => q.accessLevel === 'premium').length;
    const smart = questions.filter(q => q.smartPracticeEligible).length;
    const missingPool = questions.filter(q => !q.smartPracticeEligible && !q.generalPracticeEligible).length;
    const qualityIssues = questions.filter(q =>
      hasQualityIssue(q, 'missingExplanation') ||
      hasQualityIssue(q, 'weakOptions') ||
      hasQualityIssue(q, 'invalidAnswer') ||
      hasQualityIssue(q, 'difficulty')
    ).length;
    const avgDifficulty = questions.length ? (questions.reduce((sum, q) => sum + q.difficulty, 0) / questions.length).toFixed(1) : '0.0';
    return { validated, premium, smart, missingPool, qualityIssues, avgDifficulty };
  }, [questions]);

  const topicAudit = useMemo(() => {
    return topics.map(topic => {
      const topicQuestions = questions.filter(q => q.topicId === topic.id);
      const validated = topicQuestions.filter(q => q.validationStatus === 'validated').length;
      const pending = topicQuestions.filter(q => q.validationStatus === 'pending').length;
      const premium = topicQuestions.filter(q => q.accessLevel === 'premium').length;
      const spatialWithoutVisuals = topicQuestions.filter(q =>
        isSpatialQuestion(q) && (!q.mediaUrl || q.options.some(option => !option.imageUrl))
      ).length;
      const qualityIssues = topicQuestions.filter(q =>
        hasQualityIssue(q, 'missingExplanation') ||
        hasQualityIssue(q, 'weakOptions') ||
        hasQualityIssue(q, 'invalidAnswer') ||
        hasQualityIssue(q, 'difficulty')
      ).length;
      return { topic, total: topicQuestions.length, validated, pending, premium, spatialWithoutVisuals, qualityIssues };
    }).sort((a, b) => b.qualityIssues - a.qualityIssues || b.pending - a.pending || b.total - a.total);
  }, [questions, topics]);

  const performanceByQuestion = useMemo(
    () => buildQuestionPerformanceMap(sessionHistory),
    [sessionHistory]
  );

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

  const applyBulkAccess = (level: AccessLevel) => {
    if (selectedQuestionIds.length === 0) return;
    setQuestionsAccessLevel(selectedQuestionIds, level);
    clearSelection();
    setBulkMode(false);
  };

  const applyBulkPool = (smart: boolean, general: boolean) => {
    if (selectedQuestionIds.length === 0) return;
    setQuestionsAdaptiveEligibility(selectedQuestionIds, smart, general);
    clearSelection();
    setBulkMode(false);
  };

  const renderItem = ({ item }: { item: Question }) => {
    const topic = topics.find(t => t.id === item.topicId);
    const isSelected = selectedQuestionIds.includes(item.id);
    const itemQualityIssues = ([
      ['missingExplanation', 'הסבר חסר'],
      ['weakOptions', 'מעט אפשרויות'],
      ['invalidAnswer', 'תשובה לבדיקה'],
      ['difficulty', 'קושי חריג'],
    ] as Array<[Exclude<QualityFilter, 'all'>, string]>).filter(([issue]) => hasQualityIssue(item, issue));
    const itemStats = performanceByQuestion[item.id];
    const visibility = getQuestionVisibilityLabel(item);

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

        {itemQualityIssues.length > 0 && (
          <View style={styles.qualityRow}>
            {itemQualityIssues.map(([issue, label]) => (
              <View key={issue} style={styles.qualityBadge}>
                <Text style={styles.qualityBadgeText}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        <QuestionAssetPreview question={item} />

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

        <View style={styles.visibilityPanel}>
          <Text style={styles.visibilityText}>{visibility}</Text>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceText}>ענו: {itemStats?.attempts ?? 0}</Text>
            <Text style={styles.performanceText}>דיוק: {itemStats?.accuracy === null || itemStats?.accuracy === undefined ? '—' : `${itemStats.accuracy}%`}</Text>
            <Text style={styles.performanceText}>דילוגים: {itemStats?.skipRate === null || itemStats?.skipRate === undefined ? '—' : `${itemStats.skipRate}%`}</Text>
          </View>
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
      <AdminSyncToolbar
        title="ניהול שאלות"
        subtitle="עריכה, אימות, שיוך לפרקים, פרימיום ופולי תרגול מסונכרנים מול Supabase."
        counters={[
          { label: 'סה״כ שאלות', value: questions.length, tone: 'primary' },
          { label: 'מאומתות', value: audit.validated, tone: 'success' },
          { label: 'פרימיום', value: audit.premium, tone: 'warning' },
          { label: 'בעיות איכות', value: audit.qualityIssues, tone: audit.qualityIssues ? 'danger' : 'success' },
        ]}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.auditScroll}
        contentContainerStyle={styles.auditGrid}
      >
        <AuditPill label="מאושרות" value={`${audit.validated}/${questions.length}`} color={Colors.success} />
        <AuditPill label="פרימיום" value={audit.premium} color={Colors.warning} />
        <AuditPill label="פול חכם" value={audit.smart} color={Colors.primary} />
        <AuditPill label="ללא פול" value={audit.missingPool} color={audit.missingPool ? Colors.danger : Colors.success} />
        <AuditPill label="בעיות איכות" value={audit.qualityIssues} color={audit.qualityIssues ? Colors.warning : Colors.success} />
        <AuditPill label="קושי ממוצע" value={audit.avgDifficulty} color={Colors.accent} />
      </ScrollView>

      <View style={styles.topicAuditPanel}>
        <View style={styles.topicAuditHeader}>
          <Text style={styles.topicAuditTitle}>בקרת פרקים ושאלות</Text>
          <Text style={styles.topicAuditHint}>לחיצה על פרק מסננת את המאגר</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicAuditRow}>
          {topicAudit.map(row => {
            const hasIssues = row.qualityIssues > 0 || row.pending > 0 || row.spatialWithoutVisuals > 0;
            return (
              <Pressable
                key={row.topic.id}
                onPress={() => setFilterTopicId(filterTopicId === row.topic.id ? 'all' : row.topic.id)}
                style={[
                  styles.topicAuditCard,
                  { borderColor: hasIssues ? Colors.warning + '66' : row.topic.color + '55' },
                  filterTopicId === row.topic.id && { backgroundColor: row.topic.color + '18', borderColor: row.topic.color },
                ]}
              >
                <Text style={[styles.topicAuditName, { color: row.topic.color }]} numberOfLines={1}>
                  {row.topic.icon} {row.topic.name}
                </Text>
                <View style={styles.topicAuditStats}>
                  <Text style={styles.topicAuditStat}>סה"כ {row.total}</Text>
                  <Text style={styles.topicAuditStat}>מאומתות {row.validated}</Text>
                  <Text style={styles.topicAuditStat}>ממתינות {row.pending}</Text>
                  <Text style={styles.topicAuditStat}>פרימיום {row.premium}</Text>
                </View>
                {(row.qualityIssues > 0 || row.spatialWithoutVisuals > 0) && (
                  <View style={styles.topicAuditWarnings}>
                    {row.qualityIssues > 0 && <Text style={styles.topicAuditWarning}>בעיות איכות {row.qualityIssues}</Text>}
                    {row.spatialWithoutVisuals > 0 && <Text style={styles.topicAuditWarning}>מרחב בלי תמונה {row.spatialWithoutVisuals}</Text>}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollWrap}
        contentContainerStyle={styles.filterRow}
      >
        {([
          ['all', 'כל הגישות'],
          ['free', 'חינמי'],
          ['premium', 'פרימיום'],
        ] as Array<[AccessLevel | 'all', string]>).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilterAccess(value)}
            style={[styles.filterChip, filterAccess === value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterAccess === value && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
        {([
          ['all', 'כל הסוגים'],
          ['quantitative', TYPE_LABELS.quantitative ?? 'כמותי'],
          ['logic', TYPE_LABELS.logic ?? 'לוגי'],
          ['verbal', TYPE_LABELS.verbal ?? 'מילולי'],
          ['shapes', TYPE_LABELS.shapes ?? 'מרחבי'],
          ['fill_in_the_blank', TYPE_LABELS.fill_in_the_blank ?? 'השלמה'],
        ] as Array<[QuestionType | 'all', string]>).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilterType(value)}
            style={[styles.filterChip, filterType === value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterType === value && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
        {([
          ['all', 'כל הפולים'],
          ['smart', 'אדפטיבי'],
          ['general', 'כללי'],
          ['missing', 'ללא פול'],
        ] as Array<[typeof filterPool, string]>).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilterPool(value)}
            style={[styles.filterChip, filterPool === value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterPool === value && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollWrap}
        contentContainerStyle={styles.filterRow}
      >
        {([
          ['all', 'כל השאלות'],
          ['missingExplanation', 'בלי הסבר תקין'],
          ['weakOptions', 'מעט אפשרויות'],
          ['invalidAnswer', 'תשובה בעייתית'],
          ['difficulty', 'קושי חריג'],
        ] as Array<[QualityFilter, string]>).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setQualityFilter(value)}
            style={[styles.filterChip, qualityFilter === value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, qualityFilter === value && { color: '#fff' }]}>{label}</Text>
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
        {topics.map(t => (
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

      {bulkMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bulkBarWrap}
          contentContainerStyle={styles.bulkBar}
        >
          <Pressable onPress={() => applyBulkAccess('premium')} style={[styles.bulkAction, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.bulkActionText, { color: Colors.warning }]}>פרימיום</Text>
          </Pressable>
          <Pressable onPress={() => applyBulkAccess('free')} style={[styles.bulkAction, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.bulkActionText, { color: Colors.success }]}>חינמי</Text>
          </Pressable>
          <Pressable onPress={() => applyBulkPool(true, true)} style={[styles.bulkAction, { backgroundColor: Colors.primaryLighter }]}>
            <Text style={[styles.bulkActionText, { color: Colors.primary }]}>פול חכם</Text>
          </Pressable>
          <Pressable onPress={() => applyBulkPool(false, true)} style={[styles.bulkAction, { backgroundColor: Colors.surfaceSecondary }]}>
            <Text style={[styles.bulkActionText, { color: Colors.textSecondary }]}>פול כללי</Text>
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

function AuditPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.auditPill, { borderColor: color + '55', backgroundColor: color + '12' }]}>
      <Text style={[styles.auditValue, { color }]}>{value}</Text>
      <Text style={styles.auditLabel}>{label}</Text>
    </View>
  );
}

function QuestionAssetPreview({ question }: { question: Question }) {
  const hasQuestionImage = !!question.mediaUrl;
  const hasOptionImages = question.options.some(option => !!option.imageUrl);
  const hasExplanationImage = !!question.explanationImageUrl;
  const shouldShow = hasQuestionImage || hasOptionImages || hasExplanationImage || !!question.explanation?.trim();
  if (!shouldShow) return null;

  return (
    <View style={styles.previewPanel}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>תצוגה מלאה לפני פרסום</Text>
        <Text style={styles.previewHint}>שאלה, תשובות, תשובה נכונה והסבר כפי שהמשתמש יקבל</Text>
      </View>

      <View style={styles.previewGrid}>
        <View style={styles.previewMain}>
          <Text style={styles.previewLabel}>תמונת השאלה</Text>
          <VisualImage uri={question.mediaUrl} style={styles.questionPreviewImage} fallbackLabel="אין תמונת שאלה" />
        </View>

        <View style={styles.previewOptions}>
          <Text style={styles.previewLabel}>תמונות התשובות</Text>
          <View style={styles.optionPreviewGrid}>
            {question.options.map(option => (
              <View key={option.id} style={[styles.optionPreviewCard, option.isCorrect && styles.optionPreviewCorrect]}>
                <View style={styles.optionPreviewTop}>
                  <Text style={[styles.optionPreviewId, option.isCorrect && styles.optionPreviewCorrectText]}>
                    {option.id.toUpperCase()}
                  </Text>
                  {option.isCorrect && <Text style={styles.correctBadge}>נכונה</Text>}
                </View>
                <VisualImage uri={option.imageUrl} style={styles.optionPreviewImage} fallbackLabel="אין תמונה" />
                {!!option.text?.trim() && (
                  <Text
                    style={[styles.optionPreviewText, { textAlign: ta(option.text), writingDirection: detectDir(option.text) }]}
                    numberOfLines={2}
                  >
                    {option.text}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.explanationPreview}>
        <View style={styles.explanationPreviewTextWrap}>
          <Text style={styles.previewLabel}>הסבר למשתמש</Text>
          <Text
            style={[styles.explanationPreviewText, { textAlign: ta(question.explanation), writingDirection: detectDir(question.explanation) }]}
            numberOfLines={5}
          >
            {question.explanation?.trim() || 'אין הסבר'}
          </Text>
        </View>
        <VisualImage uri={question.explanationImageUrl} style={styles.explanationPreviewImage} fallbackLabel="אין תמונת הסבר" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, writingDirection: 'rtl' },

  auditScroll: { maxHeight: 76, borderBottomWidth: 1, borderBottomColor: Colors.border },
  auditGrid: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  auditPill: { minWidth: 96, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-end' },
  auditValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  auditLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 2, textAlign: 'right', writingDirection: 'rtl' },

  topicAuditPanel: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    writingDirection: 'rtl',
  },
  topicAuditHeader: { paddingHorizontal: 14, marginBottom: 8, alignItems: 'flex-end' },
  topicAuditTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  topicAuditHint: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 2, writingDirection: 'rtl' },
  topicAuditRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12 },
  topicAuditCard: {
    width: 168,
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: Colors.surfaceSecondary,
    padding: 10,
    alignItems: 'flex-end',
  },
  topicAuditName: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'right', writingDirection: 'rtl', marginBottom: 6 },
  topicAuditStats: { alignItems: 'flex-end', gap: 2 },
  topicAuditStat: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  topicAuditWarnings: { marginTop: 7, gap: 4, alignItems: 'flex-end' },
  topicAuditWarning: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.warning,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    textAlign: 'right',
    overflow: 'hidden',
  },

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
    writingDirection: 'rtl',
    textAlign: 'right',
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
  qualityRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  qualityBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.warningLight, borderWidth: 1, borderColor: Colors.warning + '44' },
  qualityBadgeText: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.warning, textAlign: 'right' },

  previewPanel: {
    marginTop: 12,
    marginBottom: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.background2,
    padding: 12,
    gap: 12,
    writingDirection: 'rtl',
  },
  previewHeader: { alignItems: 'flex-end', gap: 2 },
  previewTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  previewHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  previewGrid: { flexDirection: 'row-reverse', gap: 12, flexWrap: 'wrap' },
  previewMain: { flexGrow: 1, flexBasis: 280, minWidth: 240, alignItems: 'flex-end', gap: 6 },
  previewOptions: { flexGrow: 2, flexBasis: 420, minWidth: 280, alignItems: 'flex-end', gap: 6 },
  previewLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  questionPreviewImage: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundDark,
  },
  optionPreviewGrid: { width: '100%', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  optionPreviewCard: {
    flexGrow: 1,
    flexBasis: 145,
    minWidth: 135,
    maxWidth: 220,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 8,
    gap: 6,
  },
  optionPreviewCorrect: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  optionPreviewTop: {
    minHeight: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  optionPreviewId: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  optionPreviewCorrectText: { color: Colors.success },
  correctBadge: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.success,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  optionPreviewImage: {
    width: '100%',
    height: 104,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundDark,
  },
  optionPreviewText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    minHeight: 18,
  },
  explanationPreview: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  explanationPreviewTextWrap: { flex: 2, minWidth: 260, alignItems: 'flex-end', gap: 6 },
  explanationPreviewText: {
    width: '100%',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  explanationPreviewImage: {
    flex: 1,
    minWidth: 220,
    height: 150,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundDark,
  },

  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  footerMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  topicPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  topicPillText: { fontFamily: FontFamily.medium, fontSize: 11 },
  visibilityPanel: {
    marginTop: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 9,
    alignItems: 'flex-end',
  },
  visibilityText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  performanceRow: {
    marginTop: 6,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  performanceText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceStrong,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    textAlign: 'right',
  },

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
