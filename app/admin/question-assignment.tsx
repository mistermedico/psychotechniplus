import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { AccessLevel } from '../../data/types';

type Tab = 'topic' | 'exam' | 'access';

export default function QuestionAssignmentScreen() {
  const [tab, setTab] = useState<Tab>('topic');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← חזרה</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🔗 שיוך שאלות</Text>
        <Text style={styles.headerSub}>שיוך לנושא · שיוך למבחן · שליטה בגישה</Text>
      </LinearGradient>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([['topic', 'לנושא'], ['exam', 'למבחן'], ['access', 'גישה']] as [Tab, string][]).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'topic' && <TopicAssignmentTab />}
      {tab === 'exam'  && <ExamAssignmentTab />}
      {tab === 'access' && <AccessControlTab />}
    </SafeAreaView>
  );
}

// ── Tab 1: Assign questions to topics ─────────────────────────────────────

function TopicAssignmentTab() {
  const { questions, topics, assignQuestionsToTopic } = useAdminStore();
  const [sourceTopicId, setSourceTopicId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showTargetModal, setShowTargetModal] = useState(false);

  const sourceTopic = topics.find(t => t.id === sourceTopicId);

  const poolQuestions = useMemo(() => {
    let q = sourceTopicId
      ? questions.filter(x => x.topicId === sourceTopicId)
      : questions;
    if (search) q = q.filter(x => x.questionText.includes(search));
    return q.slice(0, 100);
  }, [questions, sourceTopicId, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleAssign = (targetTopicId: string) => {
    const ids = [...selected];
    const target = topics.find(t => t.id === targetTopicId);
    Alert.alert(
      'שיוך לנושא',
      `לשייך ${ids.length} שאלות ל"${target?.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שייך',
          onPress: () => {
            assignQuestionsToTopic(ids, targetTopicId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelected(new Set());
            setShowTargetModal(false);
          },
        },
      ],
    );
  };

  const qPerTopic = useMemo(() => {
    const map: Record<string, number> = {};
    questions.forEach(q => { map[q.topicId] = (map[q.topicId] ?? 0) + 1; });
    return map;
  }, [questions]);

  return (
    <View style={{ flex: 1 }}>
      {/* Source topic picker */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChips}>
          <Pressable
            onPress={() => { setSourceTopicId(''); setSelected(new Set()); }}
            style={[styles.topicChip, !sourceTopicId && styles.topicChipActive]}
          >
            <Text style={[styles.topicChipText, !sourceTopicId && { color: '#fff' }]}>
              הכל ({questions.length})
            </Text>
          </Pressable>
          {topics.map(t => (
            <Pressable
              key={t.id}
              onPress={() => { setSourceTopicId(t.id); setSelected(new Set()); }}
              style={[styles.topicChip, sourceTopicId === t.id && styles.topicChipActive]}
            >
              <Text style={[styles.topicChipText, sourceTopicId === t.id && { color: '#fff' }]}>
                {t.icon} {t.name} ({qPerTopic[t.id] ?? 0})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="חפש שאלה..."
        placeholderTextColor={Colors.textTertiary}
        value={search}
        onChangeText={setSearch}
        textAlign="right"
      />

      {/* Selection bar */}
      {selected.size > 0 && (
        <View style={styles.selectionBar}>
          <Pressable
            onPress={() => setShowTargetModal(true)}
            style={styles.assignBtn}
          >
            <Text style={styles.assignBtnText}>שייך {selected.size} שאלות לנושא ←</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(new Set())} style={styles.clearSelBtn}>
            <Text style={styles.clearSelText}>נקה</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={poolQuestions}
        keyExtractor={q => q.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item: q }) => {
          const isSelected = selected.has(q.id);
          const topicName = topics.find(t => t.id === q.topicId)?.name ?? q.topicId;
          return (
            <Pressable
              onPress={() => toggleSelect(q.id)}
              style={[styles.qRow, isSelected && styles.qRowSelected]}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.qInfo}>
                <Text style={styles.qText} numberOfLines={2}>{q.questionText}</Text>
                <View style={styles.qMeta}>
                  <Text style={styles.qMetaText}>📚 {topicName}</Text>
                  <Text style={styles.qMetaText}>⚖️ {q.difficulty}</Text>
                  <View style={[styles.accessPill, { backgroundColor: q.accessLevel === 'premium' ? Colors.warning + '25' : Colors.successLight }]}>
                    <Text style={[styles.accessPillText, { color: q.accessLevel === 'premium' ? Colors.warning : Colors.success }]}>
                      {q.accessLevel === 'premium' ? '💎' : '🆓'}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>אין שאלות לנושא זה</Text>}
      />

      {/* Target topic modal */}
      <Modal visible={showTargetModal} transparent animationType="slide" onRequestClose={() => setShowTargetModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>בחר נושא יעד</Text>
            <ScrollView>
              {topics.map(t => (
                <Pressable key={t.id} onPress={() => handleAssign(t.id)} style={styles.modalOption}>
                  <View style={styles.modalOptionLeft}>
                    <Text style={styles.modalOptionCount}>{qPerTopic[t.id] ?? 0}</Text>
                  </View>
                  <View style={styles.modalOptionInfo}>
                    <Text style={styles.modalOptionName}>{t.icon} {t.name}</Text>
                    <Text style={styles.modalOptionSub}>{t.isPremiumOnly ? '💎 פרמיום בלבד' : '🆓 חינמי'}</Text>
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

// ── Tab 2: Assign questions to exam templates ──────────────────────────────

function ExamAssignmentTab() {
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
  const [qSearch, setQSearch] = useState('');

  const template = templates.find(t => t.id === selectedTemplateId);
  const pinned = template?.pinnedQuestionIds ?? [];
  const pinnedQuestions = questions.filter(q => pinned.includes(q.id));

  const pickableQuestions = useMemo(() => {
    let q = questions.filter(x => !pinned.includes(x.id));
    if (qSearch) q = q.filter(x => x.questionText.includes(qSearch));
    return q.slice(0, 80);
  }, [questions, pinned, qSearch]);

  const addTopicRule = () => {
    if (!template || !ruleTopicId) return;
    const count = parseInt(ruleCount, 10);
    const min = parseInt(ruleMinDiff, 10);
    const max = parseInt(ruleMaxDiff, 10);
    if (isNaN(count) || count < 1) { Alert.alert('שגיאה', 'כמות שאלות חייבת להיות מספר חיובי'); return; }
    if (min > max) { Alert.alert('שגיאה', 'קושי מינימלי גדול ממקסימלי'); return; }
    addTopicRuleToTemplate(template.id, {
      id: `r_${Date.now()}`,
      topicId: ruleTopicId,
      count,
      minDifficulty: min,
      maxDifficulty: max,
      useAdaptive: true,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowTopicRuleModal(false);
  };

  if (!template) {
    return <Text style={[styles.empty, { padding: 24 }]}>אין תבניות מבחן. צור תבנית קודם בבניית סימולציה.</Text>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      {/* Template picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChips} style={{ marginBottom: 12 }}>
        {templates.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setSelectedTemplateId(t.id)}
            style={[styles.topicChip, selectedTemplateId === t.id && styles.topicChipActive]}
          >
            <Text style={[styles.topicChipText, selectedTemplateId === t.id && { color: '#fff' }]} numberOfLines={1}>
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
        <Text style={styles.sectionTitle}>📚 נושאים במבחן</Text>
      </View>

      {template.rules.length === 0 && (
        <Text style={styles.empty}>אין נושאים מוגדרים. לחץ "+ הוסף נושא".</Text>
      )}

      {template.rules.map(rule => {
        const topic = topics.find(t => t.id === rule.topicId);
        return (
          <View key={rule.id} style={styles.ruleCard}>
            <Pressable
              onPress={() => {
                Alert.alert('הסרת נושא', `להסיר את "${topic?.name}" מהמבחן?`, [
                  { text: 'ביטול', style: 'cancel' },
                  { text: 'הסר', style: 'destructive', onPress: () => removeTopicRuleFromTemplate(template.id, rule.id) },
                ]);
              }}
              style={styles.ruleRemoveBtn}
            >
              <Text style={styles.ruleRemoveText}>✕</Text>
            </Pressable>
            <View style={styles.ruleInfo}>
              <Text style={styles.ruleName}>{topic?.icon} {topic?.name ?? rule.topicId}</Text>
              <Text style={styles.ruleMeta}>
                {rule.count} שאלות · קושי {rule.minDifficulty}–{rule.maxDifficulty}
                {rule.useAdaptive ? ' · אדפטיבי' : ''}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Pinned Questions */}
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <Pressable onPress={() => setShowQuestionPicker(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ הצמד שאלה</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>📌 שאלות מוצמדות ({pinned.length})</Text>
      </View>

      {pinnedQuestions.length === 0 && (
        <Text style={styles.empty}>אין שאלות מוצמדות. שאלות מוצמדות מופיעות תמיד במבחן.</Text>
      )}

      {pinnedQuestions.map(q => (
        <View key={q.id} style={styles.pinnedCard}>
          <Pressable
            onPress={() => unpinQuestionFromTemplate(template.id, q.id)}
            style={styles.ruleRemoveBtn}
          >
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
          <View style={styles.modalSheet}>
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
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalInputRow}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>מקס קושי</Text>
                <TextInput style={styles.modalInput} value={ruleMaxDiff} onChangeText={setRuleMaxDiff} keyboardType="numeric" textAlign="center" />
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>מין קושי</Text>
                <TextInput style={styles.modalInput} value={ruleMinDiff} onChangeText={setRuleMinDiff} keyboardType="numeric" textAlign="center" />
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>כמות</Text>
                <TextInput style={styles.modalInput} value={ruleCount} onChangeText={setRuleCount} keyboardType="numeric" textAlign="center" />
              </View>
            </View>
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
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>הצמד שאלה למבחן</Text>
            <TextInput
              style={styles.searchBar}
              placeholder="חפש שאלה..."
              placeholderTextColor={Colors.textTertiary}
              value={qSearch}
              onChangeText={setQSearch}
              textAlign="right"
            />
            <FlatList
              data={pickableQuestions}
              keyExtractor={q => q.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item: q }) => (
                <Pressable
                  onPress={() => {
                    pinQuestionToTemplate(template.id, q.id);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  style={styles.modalOption}
                >
                  <Text style={styles.modalOptionName} numberOfLines={2}>{q.questionText}</Text>
                  <Text style={styles.modalOptionSub}>⚖️ {q.difficulty} · {topics.find(t => t.id === q.topicId)?.name}</Text>
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

// ── Tab 3: Access control (free/premium per question) ─────────────────────

function AccessControlTab() {
  const { questions, topics, setQuestionsAccessLevel, updateTopic } = useAdminStore();
  const [filterTopic, setFilterTopic] = useState('');
  const [filterAccess, setFilterAccess] = useState<'all' | 'free' | 'premium'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let q = questions;
    if (filterTopic) q = q.filter(x => x.topicId === filterTopic);
    if (filterAccess !== 'all') q = q.filter(x => x.accessLevel === filterAccess);
    if (search) q = q.filter(x => x.questionText.includes(search));
    return q.slice(0, 100);
  }, [questions, filterTopic, filterAccess, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const bulkSetAccess = (level: AccessLevel) => {
    const ids = [...selected];
    Alert.alert(
      'שינוי גישה',
      `לשנות ${ids.length} שאלות ל${level === 'premium' ? 'פרמיום 💎' : 'חינמי 🆓'}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שנה',
          onPress: () => {
            setQuestionsAccessLevel(ids, level);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelected(new Set());
          },
        },
      ],
    );
  };

  const toggleSingleAccess = (id: string, current: AccessLevel) => {
    setQuestionsAccessLevel([id], current === 'free' ? 'premium' : 'free');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const freeCount = questions.filter(q => q.accessLevel === 'free').length;
  const premiumCount = questions.filter(q => q.accessLevel === 'premium').length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats */}
      <View style={styles.accessStats}>
        <View style={[styles.accessStat, { borderColor: Colors.success + '60' }]}>
          <Text style={[styles.accessStatNum, { color: Colors.success }]}>{freeCount}</Text>
          <Text style={styles.accessStatLabel}>🆓 חינמי</Text>
        </View>
        <View style={[styles.accessStat, { borderColor: Colors.warning + '60' }]}>
          <Text style={[styles.accessStatNum, { color: Colors.warning }]}>{premiumCount}</Text>
          <Text style={styles.accessStatLabel}>💎 פרמיום</Text>
        </View>
      </View>

      {/* Topic access toggles */}
      <Text style={styles.subSectionTitle}>נושאים — גישה לנושא</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChips}>
        {topics.map(t => (
          <Pressable
            key={t.id}
            onLongPress={() => {
              Alert.alert(
                t.isPremiumOnly ? 'הפוך לחינמי' : 'הפוך לפרמיום',
                `לשנות את נושא "${t.name}" ל${t.isPremiumOnly ? 'חינמי' : 'פרמיום בלבד'}?`,
                [
                  { text: 'ביטול', style: 'cancel' },
                  { text: 'שנה', onPress: () => { updateTopic(t.id, { isPremiumOnly: !t.isPremiumOnly }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
                ],
              );
            }}
            style={[styles.topicChip, { borderColor: t.isPremiumOnly ? Colors.warning : Colors.border }]}
          >
            <Text style={styles.topicChipText}>
              {t.icon} {t.name} {t.isPremiumOnly ? '💎' : '🆓'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.longPressHint}>לחיצה ארוכה על נושא לשינוי גישה</Text>

      {/* Filter + search */}
      <View style={styles.filterRow}>
        {(['all', 'free', 'premium'] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => setFilterAccess(f)}
            style={[styles.filterChip, filterAccess === f && { backgroundColor: Colors.primary }]}
          >
            <Text style={[styles.filterChipText, filterAccess === f && { color: '#fff' }]}>
              {f === 'all' ? 'הכל' : f === 'free' ? '🆓 חינמי' : '💎 פרמיום'}
            </Text>
          </Pressable>
        ))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {topics.map(t => (
            <Pressable
              key={t.id}
              onPress={() => setFilterTopic(filterTopic === t.id ? '' : t.id)}
              style={[styles.filterChip, filterTopic === t.id && { backgroundColor: Colors.accent }]}
            >
              <Text style={[styles.filterChipText, filterTopic === t.id && { color: '#fff' }]}>
                {t.icon}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <TextInput
        style={[styles.searchBar, { marginHorizontal: 12 }]}
        placeholder="חפש שאלה..."
        placeholderTextColor={Colors.textTertiary}
        value={search}
        onChangeText={setSearch}
        textAlign="right"
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <View style={styles.selectionBar}>
          <Pressable onPress={() => bulkSetAccess('premium')} style={[styles.assignBtn, { backgroundColor: Colors.warning }]}>
            <Text style={styles.assignBtnText}>💎 פרמיום ({selected.size})</Text>
          </Pressable>
          <Pressable onPress={() => bulkSetAccess('free')} style={[styles.assignBtn, { backgroundColor: Colors.success }]}>
            <Text style={styles.assignBtnText}>🆓 חינמי ({selected.size})</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(new Set())} style={styles.clearSelBtn}>
            <Text style={styles.clearSelText}>נקה</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={q => q.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item: q }) => {
          const isPremium = q.accessLevel === 'premium';
          const isSelected = selected.has(q.id);
          return (
            <Pressable
              onPress={() => toggleSelect(q.id)}
              onLongPress={() => toggleSingleAccess(q.id, q.accessLevel)}
              style={[styles.qRow, isSelected && styles.qRowSelected]}
            >
              <Pressable
                onPress={() => toggleSingleAccess(q.id, q.accessLevel)}
                style={[styles.accessToggle, { backgroundColor: isPremium ? Colors.warning + '20' : Colors.successLight }]}
              >
                <Text style={[styles.accessToggleText, { color: isPremium ? Colors.warning : Colors.success }]}>
                  {isPremium ? '💎' : '🆓'}
                </Text>
              </Pressable>
              <View style={styles.qInfo}>
                <Text style={styles.qText} numberOfLines={2}>{q.questionText}</Text>
                <Text style={styles.qMetaText}>
                  {topics.find(t => t.id === q.topicId)?.name} · ⚖️ {q.difficulty}
                </Text>
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>אין שאלות להצגה</Text>}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 16, paddingBottom: 20 },
  back: { marginBottom: 10 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff', textAlign: 'right' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', textAlign: 'right', marginTop: 3 },

  tabBar: { flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.primary, fontFamily: FontFamily.bold },

  filterRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexWrap: 'nowrap' },
  topicChips: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  topicChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  topicChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  topicChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  filterChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  searchBar: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 10,
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginHorizontal: 12, marginBottom: 8,
  },

  selectionBar: {
    flexDirection: 'row-reverse', backgroundColor: Colors.primary + '15',
    padding: 10, gap: 8, marginHorizontal: 12, borderRadius: Radius.lg,
    marginBottom: 8, alignItems: 'center',
  },
  assignBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  assignBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#fff' },
  clearSelBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  clearSelText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

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
  qMeta: { flexDirection: 'row-reverse', gap: 8, marginTop: 4, alignItems: 'center' },
  qMetaText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },
  accessPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  accessPillText: { fontFamily: FontFamily.bold, fontSize: 11 },

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
  ruleMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  ruleRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  ruleRemoveText: { fontFamily: FontFamily.bold, fontSize: 12, color: Colors.danger },

  pinnedCard: {
    flexDirection: 'row-reverse', backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + '40',
    alignItems: 'center', gap: 10,
  },

  subSectionTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text,
    textAlign: 'right', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
  },
  longPressHint: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary,
    textAlign: 'right', paddingHorizontal: 12, marginBottom: 8,
  },

  accessStats: { flexDirection: 'row-reverse', gap: 10, padding: 12, paddingBottom: 0 },
  accessStat: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    alignItems: 'center', borderWidth: 1,
  },
  accessStatNum: { fontFamily: FontFamily.bold, fontSize: FontSize.xl },
  accessStatLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  accessToggle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  accessToggleText: { fontSize: 16 },

  empty: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary,
    textAlign: 'right', paddingVertical: 20, paddingHorizontal: 12,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'], padding: 20, gap: 12, maxHeight: '70%',
  },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right' },
  modalLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  modalOption: {
    flexDirection: 'row-reverse', alignItems: 'center', padding: 12,
    borderRadius: Radius.lg, gap: 10, marginBottom: 2,
  },
  modalOptionLeft: { alignItems: 'center', minWidth: 32 },
  modalOptionCount: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  modalOptionInfo: { flex: 1, alignItems: 'flex-end' },
  modalOptionName: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  modalOptionSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  modalInputRow: { flexDirection: 'row-reverse', gap: 10 },
  modalInputGroup: { flex: 1, alignItems: 'center', gap: 4 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 8, fontFamily: FontFamily.medium,
    fontSize: FontSize.base, color: Colors.text, width: '100%',
  },
  modalActions: { flexDirection: 'row-reverse', gap: 10 },
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
