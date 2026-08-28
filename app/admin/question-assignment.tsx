import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius } from '../../constants/theme';
import { AccessLevel, Question, QuestionType, ValidationStatus } from '../../data/types';
import { VisualImage } from '../../components/VisualImage';
import AdminErrorToast, { AdminToastError, showAdminErrorToast } from '../../components/AdminErrorToast';

type Tab = 'topic' | 'target' | 'exam' | 'pool';

const STATUS_COLORS: Record<ValidationStatus, string> = {
  validated: Colors.success,
  pending: Colors.warning,
  rejected: Colors.danger,
  draft: Colors.textTertiary,
};
const STATUS_LABELS: Record<ValidationStatus, string> = {
  validated: 'מאושר', pending: 'ממתין', rejected: 'נדחה', draft: 'טיוטה',
};
const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'בחירה מרובה',
  true_false: 'נכון/לא נכון',
  logic: 'לוגיקה',
  verbal: 'מילולי',
  quantitative: 'כמותי',
  shapes: 'צורות/מרחב',
  reading_comprehension: 'הבנת הנקרא',
  fill_in_the_blank: 'השלמת חסר',
};

export default function QuestionAssignmentScreen() {
  const [tab, setTab] = useState<Tab>('topic');
  const [toastError, setToastError] = useState<AdminToastError | null>(null);

  const TABS: [Tab, string, string][] = [
    ['topic',  '📚', 'נושא'],
    ['target', '🎯', 'מסלול'],
    ['exam',   '📝', 'מבחן'],
    ['pool',   '⚡', 'פול'],
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🔗 שיוך שאלות</Text>
        <Text style={styles.headerSub}>נושא · מסלול · מבחן · פול אדפטיבי</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/admin/question-editor')} style={styles.headerActionBtn}>
            <Text style={styles.headerActionText}>+ שאלה ידנית</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/admin/json-import')} style={styles.headerActionBtnSecondary}>
            <Text style={styles.headerActionText}>ייבוא JSON</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.tabBar}>
        {TABS.map(([id, icon, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
          >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'topic'  && <TopicAssignmentTab onError={setToastError} />}
      {tab === 'target' && <TargetAssignmentTab onError={setToastError} />}
      {tab === 'exam'   && <ExamAssignmentTab onError={setToastError} />}
      {tab === 'pool'   && <AdaptivePoolTab onError={setToastError} />}
      <AdminErrorToast error={toastError} onDismiss={() => setToastError(null)} />
    </SafeAreaView>
  );
}

// ── Shared: question filter row ───────────────────────────────────────────────

function StatusFilter({ value, onChange }: { value: ValidationStatus | 'all'; onChange: (v: ValidationStatus | 'all') => void }) {
  const opts: [ValidationStatus | 'all', string][] = [
    ['all', 'הכל'],
    ['validated', 'מאושר'],
    ['pending', 'ממתין'],
    ['draft', 'טיוטה'],
    ['rejected', 'נדחה'],
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
      {opts.map(([v, label]) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          style={[
            styles.filterChip,
            value === v && { backgroundColor: v === 'all' ? Colors.primary : (STATUS_COLORS[v as ValidationStatus] ?? Colors.primary) },
          ]}
        >
          <Text style={[styles.filterChipText, value === v && { color: '#fff' }]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SelectionBar({
  count, actions, onClear,
}: {
  count: number;
  actions: { label: string; color: string; onPress: () => void }[];
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <View style={styles.selectionBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row-reverse' }}>
        {actions.map((a, i) => (
          <Pressable key={i} onPress={a.onPress} style={[styles.selBtn, { backgroundColor: a.color }]}>
            <Text style={styles.selBtnText}>{a.label} ({count})</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClear} style={styles.clearSelBtn}>
          <Text style={styles.clearSelText}>נקה</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function QuestionRow({
  q, topicName, isSelected, onPress, badge,
}: {
  q: Question; topicName: string; isSelected: boolean; onPress: () => void; badge?: React.ReactNode;
}) {
  const statusColor = STATUS_COLORS[q.validationStatus as ValidationStatus] ?? Colors.textTertiary;
  const statusLabel = STATUS_LABELS[q.validationStatus as ValidationStatus] ?? q.validationStatus;
  const { targets, templates } = useAdminStore();
  const targetNames = q.targetIds.map(tid => targets.find(t => t.id === tid)?.name ?? tid);
  const examNames = templates
    .filter(t => (t.pinnedQuestionIds ?? []).includes(q.id) || t.rules.some(r => r.topicId === q.topicId))
    .map(t => t.name);
  const imageCount = (q.mediaUrl ? 1 : 0) + (q.explanationImageUrl ? 1 : 0) + q.options.filter(o => o.imageUrl).length;
  return (
    <Pressable onPress={onPress} style={[styles.qRow, isSelected && styles.qRowSelected]}>
      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.qThumbWrap}>
        <VisualImage uri={q.mediaUrl ?? q.options.find(o => o.imageUrl)?.imageUrl ?? q.explanationImageUrl} style={styles.qThumb} fallbackLabel="אין תמונה" />
      </View>
      <View style={styles.qInfo}>
        <Text style={styles.qText} numberOfLines={2}>{q.questionText}</Text>
        <View style={styles.qMeta}>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.qMetaText}>📚 {topicName}</Text>
          <Text style={styles.qMetaText}>⚖️ {q.difficulty}</Text>
          <Text style={styles.qMetaText}>{TYPE_LABELS[q.questionType] ?? q.questionType}</Text>
          <Text style={styles.qMetaText}>{q.accessLevel === 'premium' ? 'פרימיום' : 'חינמי'}</Text>
          <Text style={styles.qMetaText}>תמונות: {imageCount}</Text>
          {badge}
        </View>
        <Text style={styles.qMetaLine} numberOfLines={1}>מסלולים/קורסים: {targetNames.join(', ') || 'לא משויך'}</Text>
        <Text style={styles.qMetaLine} numberOfLines={1}>מבחנים: {examNames.slice(0, 3).join(', ') || 'לא מוצמד; יכול להיכנס לפי כלל נושא'}{examNames.length > 3 ? ` +${examNames.length - 3}` : ''}</Text>
        <Text style={styles.qMetaLine} numberOfLines={2}>הסבר: {q.explanation || 'חסר הסבר'}</Text>
        <View style={styles.qQuickActions}>
          <Pressable
            onPress={() => router.push({ pathname: '/admin/question-editor', params: { questionId: q.id, mode: 'edit' } })}
            style={styles.qQuickBtn}
          >
            <Text style={styles.qQuickText}>ערוך מלא</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/practice-session', params: { questionId: q.id, adminPreview: '1' } })}
            style={styles.qQuickBtnSecondary}
          >
            <Text style={styles.qQuickText}>תצוגה</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ── Tab 1: Topic assignment ───────────────────────────────────────────────────

function TopicAssignmentTab({ onError }: { onError: (error: AdminToastError | null) => void }) {
  const insets = useSafeAreaInsets();
  const { questions, topics, assignQuestionsToTopic } = useAdminStore();
  const [sourceTopicId, setSourceTopicId] = useState('');
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const pool = useMemo(() => {
    let q = questions;
    if (sourceTopicId) q = q.filter(x => x.topicId === sourceTopicId);
    if (statusFilter !== 'all') q = q.filter(x => x.validationStatus === statusFilter);
    if (search) q = q.filter(x => x.questionText.includes(search));
    return q.slice(0, 120);
  }, [questions, sourceTopicId, statusFilter, search]);

  const qPerTopic = useMemo(() => {
    const map: Record<string, number> = {};
    questions.forEach(q => { map[q.topicId] = (map[q.topicId] ?? 0) + 1; });
    return map;
  }, [questions]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleAssign = async (targetTopicId: string) => {
    const ids = [...selected];
    if (ids.length === 0) {
      showAdminErrorToast(onError, 'אין שאלות שנבחרו', 'בחר לפחות שאלה אחת לפני שיוך לנושא.', { tab: 'topic', targetTopicId }, 'admin:question-assignment');
      return;
    }
    const target = topics.find(t => t.id === targetTopicId);
    Alert.alert(
      'שיוך לנושא',
      `לשייך ${ids.length} שאלות לנושא "${target?.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שייך',
          onPress: async () => {
            setIsSaving(true);
            setShowTargetModal(false);
            assignQuestionsToTopic(ids, targetTopicId);
            await new Promise(r => setTimeout(r, 400));
            setIsSaving(false);
            setSelected(new Set());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('✅ שויך בהצלחה', `${ids.length} שאלות → "${target?.name}"\nנשמר ב-Supabase`);
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
        <Pressable
          onPress={() => { setSourceTopicId(''); setSelected(new Set()); }}
          style={[styles.filterChip, !sourceTopicId && { backgroundColor: Colors.primary }]}
        >
          <Text style={[styles.filterChipText, !sourceTopicId && { color: '#fff' }]}>הכל ({questions.length})</Text>
        </Pressable>
        {topics.map(t => (
          <Pressable
            key={t.id}
            onPress={() => { setSourceTopicId(t.id); setSelected(new Set()); }}
            style={[styles.filterChip, sourceTopicId === t.id && { backgroundColor: Colors.primary }]}
          >
            <Text style={[styles.filterChipText, sourceTopicId === t.id && { color: '#fff' }]}>
              {t.icon} {t.name} ({qPerTopic[t.id] ?? 0})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <StatusFilter value={statusFilter} onChange={setStatusFilter} />

      <TextInput
        style={styles.searchBar}
        placeholder="חפש שאלה..."
        placeholderTextColor={Colors.textTertiary}
        value={search}
        onChangeText={setSearch}
        textAlign="right"
      />

      <SelectionBar
        count={selected.size}
        actions={[{ label: 'שייך לנושא ←', color: Colors.primary, onPress: () => setShowTargetModal(true) }]}
        onClear={() => setSelected(new Set())}
      />

      {isSaving && (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.savingText}>שומר ב-Supabase...</Text>
        </View>
      )}

      <FlatList
        data={pool}
        keyExtractor={q => q.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item: q }) => (
          <QuestionRow
            q={q}
            topicName={topics.find(t => t.id === q.topicId)?.name ?? q.topicId}
            isSelected={selected.has(q.id)}
            onPress={() => toggle(q.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>אין שאלות להצגה</Text>}
      />

      <Modal visible={showTargetModal} transparent animationType="slide" onRequestClose={() => setShowTargetModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
            <Text style={styles.modalTitle}>בחר נושא יעד</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {topics.map(t => (
                <Pressable key={t.id} onPress={() => handleAssign(t.id)} style={styles.modalOption}>
                  <View style={styles.modalOptionCount}>
                    <Text style={styles.modalOptionCountText}>{qPerTopic[t.id] ?? 0}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.modalOptionName}>{t.icon} {t.name}</Text>
                    <Text style={styles.modalOptionSub}>{t.isPremiumOnly ? '💎 פרמיום' : '🆓 חינמי'}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowTargetModal(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>ביטול</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Tab 2: Target (track) assignment ─────────────────────────────────────────

function TargetAssignmentTab({ onError }: { onError: (error: AdminToastError | null) => void }) {
  const { questions, topics, targets, assignQuestionsToTargets } = useAdminStore();
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set(targets.map(t => t.id)));
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedTargets(prev => {
      if (prev.size > 0 || targets.length === 0) return prev;
      return new Set(targets.map(t => t.id));
    });
  }, [targets]);

  const pool = useMemo(() => {
    let q = questions;
    if (statusFilter !== 'all') q = q.filter(x => x.validationStatus === statusFilter);
    if (search) q = q.filter(x => x.questionText.includes(search));
    return q.slice(0, 120);
  }, [questions, statusFilter, search]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const toggleTarget = (id: string) => setSelectedTargets(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleAssign = () => {
    const ids = [...selected];
    const tIds = [...selectedTargets];
    if (ids.length === 0) {
      showAdminErrorToast(onError, 'אין שאלות שנבחרו', 'בחר לפחות שאלה אחת לפני שיוך למסלול/קורס.', { tab: 'target', selectedTargets: tIds }, 'admin:question-assignment');
      return;
    }
    if (tIds.length === 0) {
      showAdminErrorToast(onError, 'חסר מסלול יעד', 'בחר לפחות מסלול/קורס אחד לפני שמירת השיוך.', { tab: 'target', selectedQuestionIds: ids }, 'admin:question-assignment');
      return;
    }
    const names = tIds.map(id => targets.find(t => t.id === id)?.name ?? id).join(', ');
    Alert.alert(
      'שיוך למסלולים',
      `לשייך ${ids.length} שאלות למסלולים:\n${names}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שייך',
          onPress: async () => {
            setIsSaving(true);
            setShowTargetPicker(false);
            assignQuestionsToTargets(ids, tIds);
            await new Promise(r => setTimeout(r, 400));
            setIsSaving(false);
            setSelected(new Set());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('✅ שויך בהצלחה', `${ids.length} שאלות → ${names}\nנשמר ב-Supabase`);
          },
        },
      ],
    );
  };

  const targetCounts = useMemo(() => {
    const map: Record<string, number> = {};
    questions.forEach(q => q.targetIds.forEach((tid: string) => { map[tid] = (map[tid] ?? 0) + 1; }));
    return map;
  }, [questions]);

  return (
    <View style={{ flex: 1 }}>
      {/* Target stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
        {targets.map(t => (
          <View key={t.id} style={styles.targetStatChip}>
            <Text style={styles.targetStatNum}>{targetCounts[t.id] ?? 0}</Text>
            <Text style={styles.targetStatLabel}>{t.name}</Text>
          </View>
        ))}
      </ScrollView>

      <StatusFilter value={statusFilter} onChange={setStatusFilter} />

      <TextInput
        style={styles.searchBar}
        placeholder="חפש שאלה..."
        placeholderTextColor={Colors.textTertiary}
        value={search}
        onChangeText={setSearch}
        textAlign="right"
      />

      <SelectionBar
        count={selected.size}
        actions={[{ label: 'שייך למסלולים ←', color: Colors.accent, onPress: () => setShowTargetPicker(true) }]}
        onClear={() => setSelected(new Set())}
      />

      {isSaving && (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.savingText}>שומר ב-Supabase...</Text>
        </View>
      )}

      <FlatList
        data={pool}
        keyExtractor={q => q.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item: q }) => {
          const assignedTargets = (q.targetIds as string[]).map((tid: string) => targets.find(t => t.id === tid)?.name ?? tid).join(', ');
          return (
            <QuestionRow
              q={q}
              topicName={topics.find((t: any) => t.id === q.topicId)?.name ?? q.topicId}
              isSelected={selected.has(q.id)}
              onPress={() => toggle(q.id)}
              badge={
                <View style={styles.targetBadge}>
                  <Text style={styles.targetBadgeText} numberOfLines={1}>🎯 {assignedTargets || 'ללא מסלול'}</Text>
                </View>
              }
            />
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>אין שאלות להצגה</Text>}
      />

      {/* Target picker modal */}
      <Modal visible={showTargetPicker} transparent animationType="slide" onRequestClose={() => setShowTargetPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>בחר מסלולים ({selectedTargets.size} נבחרו)</Text>
            <Text style={styles.modalSubtitle}>הסימון יחליף את המסלולים הקיימים</Text>
            {targets.map(t => {
              const isOn = selectedTargets.has(t.id);
              return (
                <Pressable key={t.id} onPress={() => toggleTarget(t.id)} style={[styles.modalOption, isOn && { backgroundColor: Colors.primaryLighter }]}>
                  <View style={[styles.checkbox, isOn && styles.checkboxActive]}>
                    {isOn && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.modalOptionName, isOn && { color: Colors.primary }]}>{t.name}</Text>
                    <Text style={styles.modalOptionSub}>{targetCounts[t.id] ?? 0} שאלות כרגע</Text>
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowTargetPicker(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={handleAssign} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>שייך {selected.size} שאלות ←</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Tab 3: Exam template assignment ──────────────────────────────────────────

function ExamAssignmentTab({ onError }: { onError: (error: AdminToastError | null) => void }) {
  const insets = useSafeAreaInsets();
  const {
    questions, topics, templates,
    pinQuestionToTemplate, unpinQuestionFromTemplate,
    addTopicRuleToTemplate, removeTopicRuleFromTemplate,
  } = useAdminStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id ?? '');
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [showTopicRuleModal, setShowTopicRuleModal] = useState(false);
  const [ruleTopicId, setRuleTopicId] = useState('');
  const [ruleCount, setRuleCount] = useState('10');
  const [ruleMinDiff, setRuleMinDiff] = useState('1');
  const [ruleMaxDiff, setRuleMaxDiff] = useState('10');
  const [ruleAdaptive, setRuleAdaptive] = useState(true);
  const [qSearch, setQSearch] = useState('');
  const [qStatusFilter, setQStatusFilter] = useState<ValidationStatus | 'all'>('validated');

  const template = templates.find(t => t.id === selectedTemplateId);
  const pinned = template?.pinnedQuestionIds ?? [];
  const pinnedQuestions = questions.filter(q => pinned.includes(q.id));

  const pickableQuestions = useMemo(() => {
    let q = questions.filter(x => !pinned.includes(x.id));
    if (qStatusFilter !== 'all') q = q.filter(x => x.validationStatus === qStatusFilter);
    if (qSearch) q = q.filter(x => x.questionText.includes(qSearch));
    return q.slice(0, 80);
  }, [questions, pinned, qSearch, qStatusFilter]);

  const addTopicRule = () => {
    if (!template || !ruleTopicId) {
      showAdminErrorToast(onError, 'חסר נושא במבחן', 'בחר נושא לפני הוספת כלל למבחן.', { selectedTemplateId, ruleTopicId }, 'admin:question-assignment');
      return;
    }
    const count = parseInt(ruleCount, 10);
    const min = parseInt(ruleMinDiff, 10);
    const max = parseInt(ruleMaxDiff, 10);
    if (isNaN(count) || count < 1) {
      showAdminErrorToast(onError, 'כמות שאלות לא תקינה', 'כמות שאלות חייבת להיות מספר חיובי.', { ruleCount, templateId: template.id }, 'admin:question-assignment');
      return;
    }
    if (min > max) {
      showAdminErrorToast(onError, 'טווח קושי לא תקין', 'קושי מינימלי לא יכול להיות גדול מהקושי המקסימלי.', { ruleMinDiff, ruleMaxDiff, templateId: template.id }, 'admin:question-assignment');
      return;
    }
    addTopicRuleToTemplate(template.id, {
      id: `r_${Date.now()}`,
      topicId: ruleTopicId,
      count,
      minDifficulty: min,
      maxDifficulty: max,
      useAdaptive: ruleAdaptive,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowTopicRuleModal(false);
    setRuleTopicId('');
  };

  if (!template) {
    return <Text style={[styles.empty, { padding: 24 }]}>אין תבניות מבחן. צור תבנית בבניית סימולציה.</Text>;
  }

  const qPerTopic: Record<string, number> = {};
  questions.forEach(q => { qPerTopic[q.topicId] = (qPerTopic[q.topicId] ?? 0) + 1; });

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      {/* Template picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips} style={{ marginBottom: 12 }}>
        {templates.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setSelectedTemplateId(t.id)}
            style={[styles.filterChip, selectedTemplateId === t.id && { backgroundColor: Colors.primary }]}
          >
            <Text style={[styles.filterChipText, selectedTemplateId === t.id && { color: '#fff' }]} numberOfLines={1}>
              {t.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Topic Rules */}
      <View style={styles.sectionHeader}>
        <Pressable onPress={() => setShowTopicRuleModal(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ הוסף נושא</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>📚 נושאים במבחן ({template.rules.length})</Text>
      </View>

      {template.rules.length === 0 && (
        <Text style={styles.empty}>אין נושאים מוגדרים. לחץ "+ הוסף נושא".</Text>
      )}

      {template.rules.map(rule => {
        const topic = topics.find(t => t.id === rule.topicId);
        return (
          <View key={rule.id} style={styles.ruleCard}>
            <Pressable
              onPress={() => Alert.alert('הסרת נושא', `להסיר "${topic?.name}"?`, [
                { text: 'ביטול', style: 'cancel' },
                { text: 'הסר', style: 'destructive', onPress: () => removeTopicRuleFromTemplate(template.id, rule.id) },
              ])}
              style={styles.ruleRemoveBtn}
            >
              <Text style={styles.ruleRemoveText}>✕</Text>
            </Pressable>
            <View style={styles.ruleInfo}>
              <Text style={styles.ruleName}>{topic?.icon} {topic?.name ?? rule.topicId}</Text>
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 3 }}>
                <Text style={styles.ruleMeta}>{rule.count} שאלות · קושי {rule.minDifficulty}–{rule.maxDifficulty}</Text>
                <View style={[styles.adaptivePill, rule.useAdaptive ? styles.adaptivePillOn : styles.adaptivePillOff]}>
                  <Text style={[styles.adaptivePillText, rule.useAdaptive ? { color: Colors.primary } : { color: Colors.textTertiary }]}>
                    {rule.useAdaptive ? '⚡ אדפטיבי' : '📋 קבוע'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}

      {/* Pinned Questions */}
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <Pressable onPress={() => setShowQuestionPicker(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ הצמד שאלה</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>📌 מוצמדות ({pinned.length})</Text>
      </View>

      {pinnedQuestions.length === 0 && (
        <Text style={styles.empty}>אין שאלות מוצמדות. שאלות מוצמדות מופיעות תמיד.</Text>
      )}

      {pinnedQuestions.map(q => (
        <View key={q.id} style={styles.pinnedCard}>
          <Pressable onPress={() => unpinQuestionFromTemplate(template.id, q.id)} style={styles.ruleRemoveBtn}>
            <Text style={styles.ruleRemoveText}>✕</Text>
          </Pressable>
          <View style={styles.qInfo}>
            <Text style={styles.qText} numberOfLines={2}>{q.questionText}</Text>
            <Text style={styles.qMetaText}>⚖️ {q.difficulty} · {topics.find(t => t.id === q.topicId)?.name}</Text>
          </View>
        </View>
      ))}

      {/* Topic rule modal */}
      <Modal visible={showTopicRuleModal} transparent animationType="slide" onRequestClose={() => setShowTopicRuleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
            <Text style={styles.modalTitle}>הוסף נושא למבחן</Text>
            <Text style={styles.modalLabel}>בחר נושא:</Text>
            <ScrollView style={{ maxHeight: 160 }}>
              {topics.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setRuleTopicId(t.id)}
                  style={[styles.modalOption, ruleTopicId === t.id && { backgroundColor: Colors.primaryLighter }]}
                >
                  <Text style={[styles.modalOptionName, ruleTopicId === t.id && { color: Colors.primary }]}>
                    {t.icon} {t.name}
                  </Text>
                  <Text style={styles.modalOptionSub}>{qPerTopic[t.id] ?? 0} שאלות</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalInputRow}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>מקס</Text>
                <TextInput style={styles.modalInput} value={ruleMaxDiff} onChangeText={setRuleMaxDiff} keyboardType="numeric" textAlign="center" />
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>מין</Text>
                <TextInput style={styles.modalInput} value={ruleMinDiff} onChangeText={setRuleMinDiff} keyboardType="numeric" textAlign="center" />
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>כמות</Text>
                <TextInput style={styles.modalInput} value={ruleCount} onChangeText={setRuleCount} keyboardType="numeric" textAlign="center" />
              </View>
            </View>
            <Pressable onPress={() => setRuleAdaptive(v => !v)} style={[styles.toggleRow, ruleAdaptive && styles.toggleRowActive]}>
              <Text style={[styles.toggleText, ruleAdaptive && { color: Colors.primary }]}>
                {ruleAdaptive ? '⚡ אדפטיבי — שאלות מותאמות לרמת המשתמש' : '📋 קבוע — שאלות אקראיות מהנושא'}
              </Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowTopicRuleModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={addTopicRule} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>הוסף ←</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Question picker modal */}
      <Modal visible={showQuestionPicker} transparent animationType="slide" onRequestClose={() => setShowQuestionPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%', paddingBottom: Math.max(20, insets.bottom) }]}>
            <Text style={styles.modalTitle}>הצמד שאלה למבחן</Text>
            <StatusFilter value={qStatusFilter} onChange={setQStatusFilter} />
            <TextInput
              style={[styles.searchBar, { marginHorizontal: 0 }]}
              placeholder="חפש שאלה..."
              placeholderTextColor={Colors.textTertiary}
              value={qSearch}
              onChangeText={setQSearch}
              textAlign="right"
            />
            <FlatList
              data={pickableQuestions}
              keyExtractor={q => q.id}
              style={{ maxHeight: 340 }}
              renderItem={({ item: q }) => (
                <Pressable
                  onPress={() => {
                    pinQuestionToTemplate(template.id, q.id);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  style={styles.modalOption}
                >
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.modalOptionName} numberOfLines={2}>{q.questionText}</Text>
                    <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 2 }}>
                      <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[q.validationStatus as ValidationStatus] + '22' }]}>
                        <Text style={[styles.statusPillText, { color: STATUS_COLORS[q.validationStatus as ValidationStatus] }]}>
                          {STATUS_LABELS[q.validationStatus as ValidationStatus]}
                        </Text>
                      </View>
                      <Text style={styles.modalOptionSub}>⚖️ {q.difficulty} · {topics.find(t => t.id === q.topicId)?.name}</Text>
                    </View>
                  </View>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setShowQuestionPicker(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>סגור</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Tab 4: Adaptive pool eligibility + access control ─────────────────────────

function AdaptivePoolTab({ onError }: { onError: (error: AdminToastError | null) => void }) {
  const { questions, topics, setQuestionsAccessLevel, setQuestionsAdaptiveEligibility, updateTopic } = useAdminStore();
  const [filterTopic, setFilterTopic] = useState('');
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    let q = questions;
    if (filterTopic) q = q.filter(x => x.topicId === filterTopic);
    if (statusFilter !== 'all') q = q.filter(x => x.validationStatus === statusFilter);
    if (search) q = q.filter(x => x.questionText.includes(search));
    return q.slice(0, 120);
  }, [questions, filterTopic, statusFilter, search]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const bulkAction = async (label: string, fn: () => void) => {
    const ids = [...selected];
    if (ids.length === 0) {
      showAdminErrorToast(onError, 'אין שאלות שנבחרו', `בחר לפחות שאלה אחת לפני פעולה: ${label}.`, { tab: 'pool', action: label }, 'admin:question-assignment');
      return;
    }
    Alert.alert(label, `לעדכן ${ids.length} שאלות?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'עדכן',
        onPress: async () => {
          setIsSaving(true);
          fn();
          await new Promise(r => setTimeout(r, 400));
          setIsSaving(false);
          setSelected(new Set());
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('✅ עודכן', `${ids.length} שאלות עודכנו.\nנשמר ב-Supabase`);
        },
      },
    ]);
  };

  const smartCount = questions.filter(q => q.smartPracticeEligible).length;
  const generalCount = questions.filter(q => q.generalPracticeEligible).length;
  const freeCount = questions.filter(q => q.accessLevel === 'free').length;
  const premiumCount = questions.filter(q => q.accessLevel === 'premium').length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterChips, { paddingBottom: 4 }]}>
        {[
          { label: '⚡ חכם', val: smartCount, color: Colors.primary },
          { label: '📋 כללי', val: generalCount, color: Colors.accent },
          { label: '🆓 חינמי', val: freeCount, color: Colors.success },
          { label: '💎 פרמיום', val: premiumCount, color: Colors.warning },
        ].map(s => (
          <View key={s.label} style={[styles.statChip, { borderColor: s.color + '60' }]}>
            <Text style={[styles.statChipNum, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.statChipLabel}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Topic filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
        <Pressable
          onPress={() => setFilterTopic('')}
          style={[styles.filterChip, !filterTopic && { backgroundColor: Colors.primary }]}
        >
          <Text style={[styles.filterChipText, !filterTopic && { color: '#fff' }]}>הכל</Text>
        </Pressable>
        {topics.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setFilterTopic(filterTopic === t.id ? '' : t.id)}
            style={[styles.filterChip, filterTopic === t.id && { backgroundColor: Colors.primary }]}
          >
            <Text style={[styles.filterChipText, filterTopic === t.id && { color: '#fff' }]}>{t.icon}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <StatusFilter value={statusFilter} onChange={setStatusFilter} />

      <TextInput
        style={styles.searchBar}
        placeholder="חפש שאלה..."
        placeholderTextColor={Colors.textTertiary}
        value={search}
        onChangeText={setSearch}
        textAlign="right"
      />

      <SelectionBar
        count={selected.size}
        actions={[
          {
            label: '⚡ חכם+כללי',
            color: Colors.primary,
            onPress: () => bulkAction('פול אדפטיבי', () => setQuestionsAdaptiveEligibility([...selected], true, true)),
          },
          {
            label: '📋 כללי בלבד',
            color: Colors.accent,
            onPress: () => bulkAction('פול כללי', () => setQuestionsAdaptiveEligibility([...selected], false, true)),
          },
          {
            label: '💎 פרמיום',
            color: Colors.warning,
            onPress: () => bulkAction('גישה פרמיום', () => setQuestionsAccessLevel([...selected], 'premium')),
          },
          {
            label: '🆓 חינמי',
            color: Colors.success,
            onPress: () => bulkAction('גישה חינמי', () => setQuestionsAccessLevel([...selected], 'free')),
          },
        ]}
        onClear={() => setSelected(new Set())}
      />

      {isSaving && (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.savingText}>שומר ב-Supabase...</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={q => q.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item: q }) => {
          const isSelected = selected.has(q.id);
          return (
            <Pressable onPress={() => toggle(q.id)} style={[styles.qRow, isSelected && styles.qRowSelected]}>
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.qInfo}>
                <Text style={styles.qText} numberOfLines={2}>{q.questionText}</Text>
                <View style={styles.qMeta}>
                  <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[q.validationStatus as ValidationStatus] + '22' }]}>
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[q.validationStatus as ValidationStatus] }]}>
                      {STATUS_LABELS[q.validationStatus as ValidationStatus]}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setQuestionsAdaptiveEligibility([q.id], !q.smartPracticeEligible, q.generalPracticeEligible)}
                    style={[styles.eligibilityPill, { backgroundColor: q.smartPracticeEligible ? Colors.primary + '22' : Colors.border }]}
                  >
                    <Text style={[styles.eligibilityText, { color: q.smartPracticeEligible ? Colors.primary : Colors.textTertiary }]}>⚡</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setQuestionsAdaptiveEligibility([q.id], q.smartPracticeEligible, !q.generalPracticeEligible)}
                    style={[styles.eligibilityPill, { backgroundColor: q.generalPracticeEligible ? Colors.accent + '22' : Colors.border }]}
                  >
                    <Text style={[styles.eligibilityText, { color: q.generalPracticeEligible ? Colors.accent : Colors.textTertiary }]}>📋</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const next: AccessLevel = q.accessLevel === 'free' ? 'premium' : 'free';
                      setQuestionsAccessLevel([q.id], next);
                    }}
                    style={[styles.eligibilityPill, { backgroundColor: q.accessLevel === 'premium' ? Colors.warning + '22' : Colors.successLight }]}
                  >
                    <Text style={[styles.eligibilityText, { color: q.accessLevel === 'premium' ? Colors.warning : Colors.success }]}>
                      {q.accessLevel === 'premium' ? '💎' : '🆓'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>אין שאלות להצגה</Text>}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 16 },
  back: { marginBottom: 8 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
  headerActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  headerActionBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  headerActionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  headerActionText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff', textAlign: 'center' },

  tabBar: { flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  tabLabelActive: { color: Colors.primary, fontFamily: FontFamily.bold },

  filterChips: { paddingHorizontal: 12, paddingVertical: 6, gap: 8, flexDirection: 'row-reverse' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  searchBar: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 10,
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginHorizontal: 12, marginBottom: 6,
  },

  selectionBar: {
    backgroundColor: Colors.primary + '12', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  selBtn: { borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 7 },
  selBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },
  clearSelBtn: { paddingHorizontal: 10, paddingVertical: 7, justifyContent: 'center' },
  clearSelText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  savingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  savingText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },

  qRow: {
    flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 10,
  },
  qRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLighter },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontFamily: FontFamily.bold, fontSize: 13, color: '#fff' },
  qInfo: { flex: 1, alignItems: 'flex-end' },
  qText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },
  qMeta: { flexDirection: 'row-reverse', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' },
  qMetaText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  qMetaLine: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.textSecondary, textAlign: 'right', marginTop: 3, lineHeight: 16 },
  qThumbWrap: { width: 74, height: 58, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, flexShrink: 0 },
  qThumb: { width: '100%', height: '100%' },
  qQuickActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  qQuickBtn: { backgroundColor: Colors.primaryLighter, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary + '33' },
  qQuickBtnSecondary: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  qQuickText: { fontFamily: FontFamily.bold, fontSize: 11, color: Colors.primary, textAlign: 'center' },

  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  statusPillText: { fontFamily: FontFamily.bold, fontSize: 10 },

  targetBadge: { backgroundColor: Colors.accent + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, maxWidth: 140 },
  targetBadgeText: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.accent },

  targetStatChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  targetStatNum: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  targetStatLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  statChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, minWidth: 70,
  },
  statChipNum: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  statChipLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  eligibilityPill: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eligibilityText: { fontSize: 14 },

  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },

  ruleCard: {
    flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 10,
  },
  ruleInfo: { flex: 1, alignItems: 'flex-end' },
  ruleName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  ruleMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  ruleRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  ruleRemoveText: { fontFamily: FontFamily.bold, fontSize: 12, color: Colors.danger },

  adaptivePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  adaptivePillOn: { backgroundColor: Colors.primary + '18' },
  adaptivePillOff: { backgroundColor: Colors.border },
  adaptivePillText: { fontFamily: FontFamily.medium, fontSize: 10 },

  pinnedCard: {
    flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + '40',
    alignItems: 'center', gap: 10,
  },

  toggleRow: {
    padding: 12, borderRadius: Radius.lg, backgroundColor: Colors.border,
    alignItems: 'center',
  },
  toggleRowActive: { backgroundColor: Colors.primary + '18' },
  toggleText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  empty: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary,
    textAlign: 'right', paddingVertical: 20, paddingHorizontal: 12,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'], padding: 20, gap: 10, maxHeight: '80%',
  },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right' },
  modalSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right' },
  modalLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  modalOption: {
    flexDirection: 'row-reverse', alignItems: 'center', padding: 12,
    borderRadius: Radius.lg, gap: 10, marginBottom: 2,
  },
  modalOptionCount: { minWidth: 36, alignItems: 'center' },
  modalOptionCountText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  modalOptionName: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  modalOptionSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  modalInputRow: { flexDirection: 'row-reverse', gap: 10 },
  modalInputGroup: { flex: 1, alignItems: 'center', gap: 4 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 8, fontFamily: FontFamily.medium,
    fontSize: FontSize.base, color: Colors.text, width: '100%',
  },
  modalActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1, padding: 14, borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceSecondary, alignItems: 'center',
  },
  modalConfirmBtn: {
    flex: 1, padding: 14, borderRadius: Radius.xl,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalCancel: { padding: 14, alignItems: 'center' },
  modalCancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textSecondary },
  modalConfirmText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
