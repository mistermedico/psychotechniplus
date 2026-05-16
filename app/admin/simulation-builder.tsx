import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAdminStore, SmartExamTemplate, SimulationRule } from '../../store/adminStore';
import { TOPICS, TARGETS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

export default function SimulationBuilder() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useAdminStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState(TARGETS[0]?.id ?? '');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('45');
  const [passingScore, setPassingScore] = useState('65');
  const [rules, setRules] = useState<SimulationRule[]>([]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setTargetId(TARGETS[0]?.id ?? '');
    setTimeLimitMinutes('45');
    setPassingScore('65');
    setRules([]);
    setEditId(null);
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (t: SmartExamTemplate) => {
    setName(t.name);
    setDescription(t.description);
    setTargetId(t.targetId);
    setTimeLimitMinutes(String(t.timeLimitMinutes));
    setPassingScore(String(t.passingScore));
    setRules([...t.rules]);
    setEditId(t.id);
    setShowForm(true);
  };

  const addRule = () => {
    const topic = TOPICS.find(t => !rules.map(r => r.topicId).includes(t.id));
    if (!topic) return;
    setRules(prev => [
      ...prev,
      {
        id: `rule_${Date.now()}`,
        topicId: topic.id,
        count: 5,
        minDifficulty: 3,
        maxDifficulty: 7,
        useAdaptive: false,
      },
    ]);
  };

  const updateRule = (id: string, updates: Partial<SimulationRule>) => {
    setRules(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const totalQ = rules.reduce((s, r) => s + r.count, 0);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('שגיאה', 'נא להזין שם'); return; }
    if (rules.length === 0) { Alert.alert('שגיאה', 'הוסף לפחות כלל אחד'); return; }

    const data = {
      name: name.trim(),
      description: description.trim(),
      targetId,
      totalQuestions: totalQ,
      timeLimitMinutes: parseInt(timeLimitMinutes) || 45,
      passingScore: parseInt(passingScore) || 65,
      rules,
      isActive: true,
    };

    if (editId) {
      updateTemplate(editId, data);
      Alert.alert('עודכן!', 'תבנית הסימולציה עודכנה');
    } else {
      addTemplate(data);
      Alert.alert('נוסף!', 'תבנית הסימולציה נוצרה בהצלחה');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    resetForm();
  };

  if (showForm) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editId ? '✏️ עריכת תבנית' : '🏗️ תבנית חדשה'}</Text>
            <Pressable onPress={() => { setShowForm(false); resetForm(); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>ביטול</Text>
            </Pressable>
          </View>

          <FormSection title="📋 פרטי הסימולציה">
            <Text style={styles.label}>שם התבנית</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} textAlign="right" placeholder="לדוגמה: סימולציה פסיכומטרית מלאה" placeholderTextColor={Colors.textTertiary} />

            <Text style={[styles.label, { marginTop: 12 }]}>תיאור</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={description} onChangeText={setDescription} multiline textAlign="right" placeholder="תיאור קצר של הסימולציה" placeholderTextColor={Colors.textTertiary} textAlignVertical="top" />

            <Text style={[styles.label, { marginTop: 12 }]}>מסלול</Text>
            <View style={styles.chipRow}>
              {TARGETS.filter(t => !t.comingSoon).map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setTargetId(t.id)}
                  style={[styles.chip, targetId === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                >
                  <Text style={[styles.chipText, targetId === t.id && { color: '#fff' }]}>{t.icon} {t.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>זמן (דקות)</Text>
                <TextInput style={styles.input} value={timeLimitMinutes} onChangeText={setTimeLimitMinutes} keyboardType="number-pad" textAlign="right" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ציון מעבר (%)</Text>
                <TextInput style={styles.input} value={passingScore} onChangeText={setPassingScore} keyboardType="number-pad" textAlign="right" />
              </View>
            </View>
          </FormSection>

          <FormSection title="📚 כללי שאלות">
            <View style={styles.rulesHeader}>
              <Text style={styles.totalQ}>סה״כ: {totalQ} שאלות</Text>
              <Pressable onPress={addRule} style={styles.addRuleBtn}>
                <Text style={styles.addRuleText}>+ הוסף כלל</Text>
              </Pressable>
            </View>

            {rules.map(rule => {
              const topic = TOPICS.find(t => t.id === rule.topicId);
              return (
                <View key={rule.id} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <Pressable onPress={() => removeRule(rule.id)}>
                      <Text style={{ color: Colors.danger, fontSize: 18 }}>✕</Text>
                    </Pressable>
                    <View style={styles.ruleHeaderRight}>
                      <Text style={styles.ruleTopicLabel}>{topic?.icon} {topic?.name}</Text>
                    </View>
                  </View>

                  {/* Topic picker */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                      {TOPICS.map(t => (
                        <Pressable
                          key={t.id}
                          onPress={() => updateRule(rule.id, { topicId: t.id })}
                          style={[styles.miniChip, rule.topicId === t.id && { backgroundColor: t.color }]}
                        >
                          <Text style={[styles.miniChipText, rule.topicId === t.id && { color: '#fff' }]}>
                            {t.icon} {t.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Count */}
                  <Text style={styles.ruleLabel}>כמות שאלות: {rule.count}</Text>
                  <View style={styles.ruleCountRow}>
                    {[3, 5, 8, 10, 15, 20].map(n => (
                      <Pressable
                        key={n}
                        onPress={() => updateRule(rule.id, { count: n })}
                        style={[styles.countChip, rule.count === n && { backgroundColor: Colors.primary }]}
                      >
                        <Text style={[styles.countChipText, rule.count === n && { color: '#fff' }]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Difficulty range */}
                  <Text style={styles.ruleLabel}>קושי: {rule.minDifficulty} – {rule.maxDifficulty}</Text>
                  <View style={styles.diffRangeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.diffRangeLabel}>מינימום</Text>
                      <View style={styles.diffBtns}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <Pressable key={n} onPress={() => updateRule(rule.id, { minDifficulty: n })}
                            style={[styles.diffSmall, rule.minDifficulty === n && { backgroundColor: Colors.success }]}>
                            <Text style={[styles.diffSmallText, rule.minDifficulty === n && { color: '#fff' }]}>{n}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.diffRangeLabel}>מקסימום</Text>
                      <View style={styles.diffBtns}>
                        {[6, 7, 8, 9, 10].map(n => (
                          <Pressable key={n} onPress={() => updateRule(rule.id, { maxDifficulty: n })}
                            style={[styles.diffSmall, rule.maxDifficulty === n && { backgroundColor: Colors.danger }]}>
                            <Text style={[styles.diffSmallText, rule.maxDifficulty === n && { color: '#fff' }]}>{n}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Adaptive */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>הגרלה אדפטיבית</Text>
                    <Switch
                      value={rule.useAdaptive}
                      onValueChange={v => updateRule(rule.id, { useAdaptive: v })}
                      trackColor={{ true: Colors.primary, false: Colors.border }}
                    />
                  </View>
                </View>
              );
            })}

            {rules.length === 0 && (
              <View style={styles.emptyRules}>
                <Text style={styles.emptyRulesText}>לחץ "הוסף כלל" להגדרת שאלות</Text>
              </View>
            )}
          </FormSection>

          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.saveBtnGrad}>
              <Text style={styles.saveBtnText}>
                {editId ? '💾 שמור שינויים' : '🏗️ צור תבנית'} ({totalQ} שאלות, {timeLimitMinutes} דקות)
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={Colors.gradients.gold} style={styles.hero}>
          <Text style={styles.heroIcon}>🏗️</Text>
          <Text style={styles.heroTitle}>בניית סימולציות</Text>
          <Text style={styles.heroDesc}>
            צור תבניות מבחן חכמות עם כללי הגרלה, זמן מוגבל וסיווג לפי נושאים
          </Text>
        </LinearGradient>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>תבניות קיימות ({templates.length})</Text>
          <Pressable onPress={openNew} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ תבנית חדשה</Text>
          </Pressable>
        </View>

        {templates.map(t => {
          const target = TARGETS.find(x => x.id === t.targetId);
          return (
            <View key={t.id} style={styles.templateCard}>
              <View style={styles.templateHeader}>
                <View style={styles.templateMeta}>
                  <Text style={[styles.templateActive, { color: t.isActive ? Colors.success : Colors.danger }]}>
                    {t.isActive ? '● פעיל' : '● לא פעיל'}
                  </Text>
                </View>
                <View style={styles.templateTitleWrap}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateTarget}>{target?.icon} {target?.name}</Text>
                </View>
              </View>

              {t.description ? <Text style={styles.templateDesc}>{t.description}</Text> : null}

              <View style={styles.templateStats}>
                <StatPill icon="❓" label="שאלות" value={t.totalQuestions} />
                <StatPill icon="⏱️" label="דקות" value={t.timeLimitMinutes} />
                <StatPill icon="📊" label="מעבר %" value={t.passingScore} />
                <StatPill icon="📋" label="כללים" value={t.rules.length} />
              </View>

              {/* Rules summary */}
              <View style={styles.rulesSummary}>
                {t.rules.map(r => {
                  const topic = TOPICS.find(x => x.id === r.topicId);
                  return (
                    <Text key={r.id} style={styles.ruleSummaryText}>
                      {topic?.icon} {topic?.name}: {r.count} שאלות (רמה {r.minDifficulty}-{r.maxDifficulty})
                      {r.useAdaptive ? ' 🧠' : ''}
                    </Text>
                  );
                })}
              </View>

              <View style={styles.templateActions}>
                <Pressable
                  onPress={() => {
                    Alert.alert('מחיקה', `למחוק את "${t.name}"?`, [
                      { text: 'ביטול', style: 'cancel' },
                      { text: 'מחק', style: 'destructive', onPress: () => deleteTemplate(t.id) },
                    ]);
                  }}
                  style={[styles.tAction, { backgroundColor: Colors.dangerLight }]}
                >
                  <Text style={[styles.tActionText, { color: Colors.danger }]}>🗑️ מחק</Text>
                </Pressable>
                <Pressable
                  onPress={() => updateTemplate(t.id, { isActive: !t.isActive })}
                  style={[styles.tAction, { backgroundColor: t.isActive ? Colors.warningLight : Colors.successLight }]}
                >
                  <Text style={[styles.tActionText, { color: t.isActive ? Colors.warning : Colors.success }]}>
                    {t.isActive ? '⏸ השבת' : '▶ הפעל'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => openEdit(t)}
                  style={[styles.tAction, { backgroundColor: Colors.primaryLighter, flex: 1 }]}
                >
                  <Text style={[styles.tActionText, { color: Colors.primary }]}>✏️ ערוך</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={fsStyles.container}>
      <Text style={fsStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

function StatPill({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View style={spStyles.pill}>
      <Text style={spStyles.icon}>{icon}</Text>
      <Text style={spStyles.value}>{value}</Text>
      <Text style={spStyles.label}>{label}</Text>
    </View>
  );
}

const fsStyles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 12 },
});

const spStyles = StyleSheet.create({
  pill: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 8 },
  icon: { fontSize: 14 },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },

  hero: { padding: 24, alignItems: 'flex-end' },
  heroIcon: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  heroDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', textAlign: 'right', lineHeight: 20, marginTop: 6 },

  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  listTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8, ...Shadow.primary },
  newBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  templateCard: { backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadow.md, borderWidth: 1, borderColor: Colors.border },
  templateHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  templateMeta: {},
  templateActive: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  templateTitleWrap: { alignItems: 'flex-end' },
  templateName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right' },
  templateTarget: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  templateDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 10, lineHeight: 18 },
  templateStats: { flexDirection: 'row-reverse', gap: 6, marginBottom: 10 },
  rulesSummary: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 10, marginBottom: 10 },
  ruleSummaryText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 },
  templateActions: { flexDirection: 'row-reverse', gap: 8 },
  tAction: { borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  tActionText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  // Form styles
  formHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  formTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  cancelBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },
  input: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary, borderWidth: 1.5, borderColor: Colors.border },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  row: { flexDirection: 'row-reverse', gap: 12, marginTop: 12 },

  rulesHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalQ: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary },
  addRuleBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 6 },
  addRuleText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  ruleCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  ruleHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  ruleHeaderRight: {},
  ruleTopicLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  ruleLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  ruleCountRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 10 },
  countChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  countChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  diffRangeRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 8 },
  diffRangeLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginBottom: 4 },
  diffBtns: { flexDirection: 'row-reverse', gap: 4 },
  diffSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  diffSmallText: { fontFamily: FontFamily.bold, fontSize: 11, color: Colors.textSecondary },
  switchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },
  miniChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  miniChipText: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textSecondary },

  emptyRules: { alignItems: 'center', padding: 20 },
  emptyRulesText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary },

  saveBtn: { marginHorizontal: 16, marginTop: 8, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  saveBtnGrad: { padding: 18, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
