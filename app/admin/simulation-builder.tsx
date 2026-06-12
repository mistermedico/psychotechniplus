import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, SmartExamTemplate, SimulationRule } from '../../store/adminStore';
import { TOPICS, TARGETS } from '../../data/mockData';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

export default function SimulationBuilder() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, questions } = useAdminStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [templateFilter, setTemplateFilter] = useState<'all' | 'active' | 'inactive' | 'shortage'>('all');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState(TARGETS[0]?.id ?? '');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('45');
  const [passingScore, setPassingScore] = useState('65');
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<SimulationRule[]>([]);
  const [customCounts, setCustomCounts] = useState<Record<string, string>>({});

  const markDirty = () => setIsDirty(true);

  const resetForm = () => {
    setName(''); setDescription('');
    setTargetId(TARGETS[0]?.id ?? '');
    setTimeLimitMinutes('45'); setPassingScore('65');
    setIsActive(true); setRules([]);
    setEditId(null); setIsDirty(false);
    setCustomCounts({});
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (t: SmartExamTemplate) => {
    setName(t.name); setDescription(t.description);
    setTargetId(t.targetId);
    setTimeLimitMinutes(String(t.timeLimitMinutes));
    setPassingScore(String(t.passingScore));
    setIsActive(t.isActive); setRules([...t.rules]);
    setEditId(t.id); setIsDirty(false); setShowForm(true);
    setCustomCounts({});
  };

  const handleCancel = () => {
    if (isDirty) {
      Alert.alert('ביטול עריכה', 'יש שינויים שלא נשמרו. לבטל?', [
        { text: 'המשך עריכה', style: 'cancel' },
        { text: 'בטל', style: 'destructive', onPress: () => { setShowForm(false); resetForm(); } },
      ]);
    } else {
      setShowForm(false); resetForm();
    }
  };

  const cloneTemplate = (t: SmartExamTemplate) => {
    const data = {
      name: `${t.name} (עותק)`,
      description: t.description,
      targetId: t.targetId,
      totalQuestions: t.totalQuestions,
      timeLimitMinutes: t.timeLimitMinutes,
      passingScore: t.passingScore,
      rules: t.rules.map(r => ({ ...r, id: `rule_${Date.now()}_${Math.random().toString(36).slice(2,5)}` })),
      isActive: false,
    };
    addTemplate(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('שוכפל!', `"${t.name} (עותק)" נוצר`);
  };

  const addRule = () => {
    const usedTopics = new Set(rules.map(r => r.topicId));
    const topic = TOPICS.find(t => !usedTopics.has(t.id));
    if (!topic) {
      Alert.alert('כל הנושאים כבר נוספו', 'לא ניתן להוסיף כלל נוסף - כל הנושאים כבר קיימים ברשימה');
      return;
    }
    const newRule: SimulationRule = {
      id: `rule_${Date.now()}`,
      topicId: topic.id,
      count: 5,
      minDifficulty: 3,
      maxDifficulty: 7,
      useAdaptive: false,
    };
    setRules(prev => [...prev, newRule]);
    markDirty();
  };

  const updateRule = (id: string, updates: Partial<SimulationRule>) => {
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const merged = { ...r, ...updates };
      // enforce min ≤ max
      if (updates.minDifficulty !== undefined && merged.minDifficulty > merged.maxDifficulty) {
        merged.maxDifficulty = merged.minDifficulty;
      }
      if (updates.maxDifficulty !== undefined && merged.maxDifficulty < merged.minDifficulty) {
        merged.minDifficulty = merged.maxDifficulty;
      }
      return merged;
    }));
    markDirty();
  };

  const changeRuleTopic = (ruleId: string, newTopicId: string) => {
    const alreadyUsed = rules.some(r => r.id !== ruleId && r.topicId === newTopicId);
    if (alreadyUsed) {
      Alert.alert('נושא כפול', 'נושא זה כבר קיים בכלל אחר. כל נושא יכול להופיע פעם אחת בלבד.');
      return;
    }
    updateRule(ruleId, { topicId: newTopicId });
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    setCustomCounts(prev => { const c = { ...prev }; delete c[id]; return c; });
    markDirty();
  };

  const totalQ = rules.reduce((s, r) => s + r.count, 0);

  const questionsPerTopic = useMemo(() => {
    const map: Record<string, number> = {};
    questions.filter(q => q.validationStatus === 'validated').forEach(q => {
      if (q.topicId) { map[q.topicId] = (map[q.topicId] ?? 0) + 1; }
    });
    return map;
  }, [questions]);

  const getTemplateAudit = (template: Pick<SmartExamTemplate, 'rules' | 'totalQuestions' | 'timeLimitMinutes'>) => {
    const shortages = template.rules.filter(rule => rule.count > (questionsPerTopic[rule.topicId] ?? 0));
    const adaptiveRules = template.rules.filter(rule => rule.useAdaptive).length;
    const avgSeconds = template.totalQuestions > 0 ? Math.round((template.timeLimitMinutes * 60) / template.totalQuestions) : 0;
    const strictRules = template.rules.filter(rule => rule.minDifficulty >= 8 || rule.maxDifficulty <= 3).length;
    return { shortages, adaptiveRules, avgSeconds, strictRules };
  };

  const contentAudit = useMemo(() => {
    const rows = templates.map(template => ({ template, audit: getTemplateAudit(template) }));
    const shortageCount = rows.filter(row => row.audit.shortages.length > 0).length;
    const inactiveCount = rows.filter(row => !row.template.isActive).length;
    const tooFastCount = rows.filter(row => row.audit.avgSeconds > 0 && row.audit.avgSeconds < 45).length;
    const adaptiveReadyCount = rows.filter(row => row.template.rules.length > 0 && row.audit.adaptiveRules === row.template.rules.length).length;
    return { shortageCount, inactiveCount, tooFastCount, adaptiveReadyCount };
  }, [templates, questionsPerTopic]);

  const fixTemplateShortages = (template: SmartExamTemplate) => {
    const fixedRules = template.rules.map(rule => {
      const available = questionsPerTopic[rule.topicId] ?? 0;
      return available > 0 && rule.count > available ? { ...rule, count: available } : rule;
    });
    const totalQuestions = fixedRules.reduce((sum, rule) => sum + rule.count, 0);
    updateTemplate(template.id, { rules: fixedRules, totalQuestions });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const applyBalancedTiming = () => {
    const suggestedMinutes = Math.max(5, Math.ceil((totalQ * 75) / 60));
    setTimeLimitMinutes(String(suggestedMinutes));
    markDirty();
  };

  const fixCurrentRuleShortages = () => {
    setRules(prev => prev.map(rule => {
      const available = questionsPerTopic[rule.topicId] ?? 0;
      return available > 0 && rule.count > available ? { ...rule, count: available } : rule;
    }));
    markDirty();
  };

  const setCurrentRulesAdaptive = () => {
    setRules(prev => prev.map(rule => ({ ...rule, useAdaptive: true })));
    markDirty();
  };

  const handleSave = () => {
    const trimName = name.trim();
    if (!trimName) { Alert.alert('שגיאה', 'נא להזין שם לתבנית'); return; }
    if (trimName.length < 3) { Alert.alert('שגיאה', 'שם חייב להכיל לפחות 3 תווים'); return; }
    if (rules.length === 0) { Alert.alert('שגיאה', 'הוסף לפחות כלל שאלה אחד'); return; }

    const time = parseInt(timeLimitMinutes) || 45;
    const pass = parseInt(passingScore) || 65;
    if (time < 5 || time > 300) { Alert.alert('שגיאה', 'זמן חייב להיות בין 5 ל-300 דקות'); return; }
    if (pass < 0 || pass > 100) { Alert.alert('שגיאה', 'ציון מעבר חייב להיות בין 0 ל-100%'); return; }

    const data = {
      name: trimName,
      description: description.trim(),
      targetId,
      totalQuestions: totalQ,
      timeLimitMinutes: time,
      passingScore: pass,
      isActive,
      rules,
    };

    if (editId) {
      updateTemplate(editId, data);
      Alert.alert('עודכן!', 'תבנית הסימולציה עודכנה בהצלחה');
    } else {
      addTemplate(data);
      Alert.alert('נוצר!', 'תבנית הסימולציה נוצרה בהצלחה');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false); resetForm();
  };

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (templateFilter === 'active') list = list.filter(t => t.isActive);
    if (templateFilter === 'inactive') list = list.filter(t => !t.isActive);
    if (templateFilter === 'shortage') list = list.filter(t => getTemplateAudit(t).shortages.length > 0);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(t =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [templates, search, templateFilter, questionsPerTopic]);

  const bulkUpdateVisibleTemplates = (updates: Partial<SmartExamTemplate>, label: string) => {
    if (filteredTemplates.length === 0) return;
    Alert.alert(label, `לעדכן ${filteredTemplates.length} מבחנים מוצגים?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'עדכן',
        onPress: () => {
          filteredTemplates.forEach(template => updateTemplate(template.id, updates));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const fixVisibleTemplateShortages = () => {
    if (filteredTemplates.length === 0) return;
    filteredTemplates.forEach(template => {
      const fixedRules = template.rules.map(rule => {
        const available = questionsPerTopic[rule.topicId] ?? 0;
        return available > 0 && rule.count > available ? { ...rule, count: available } : rule;
      });
      const totalQuestions = fixedRules.reduce((sum, rule) => sum + rule.count, 0);
      updateTemplate(template.id, { rules: fixedRules, totalQuestions });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const setVisibleTemplatesAdaptive = () => {
    if (filteredTemplates.length === 0) return;
    filteredTemplates.forEach(template => {
      updateTemplate(template.id, {
        rules: template.rules.map(rule => ({ ...rule, useAdaptive: true })),
      });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (showForm) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editId ? '✏️ עריכת תבנית' : '🏗️ תבנית חדשה'}</Text>
            <Pressable onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>ביטול</Text>
            </Pressable>
          </View>

          <FormSection title="📋 פרטי הסימולציה">
            <Text style={styles.label}>שם התבנית *</Text>
            <TextInput
              style={styles.input} value={name}
              onChangeText={v => { setName(v); markDirty(); }}
              textAlign="right" placeholder="לדוגמה: סימולציה פסיכוטכנית מלאה"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.charCount}>{name.length} / 60</Text>

            <Text style={[styles.label, { marginTop: 12 }]}>תיאור</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]} value={description}
              onChangeText={v => { setDescription(v); markDirty(); }}
              multiline textAlign="right" placeholder="תיאור קצר של הסימולציה"
              placeholderTextColor={Colors.textTertiary} textAlignVertical="top"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>מסלול</Text>
            <View style={styles.chipRow}>
              {TARGETS.filter(t => !t.comingSoon).map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => { setTargetId(t.id); markDirty(); }}
                  style={[styles.chip, targetId === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                >
                  <Text style={[styles.chipText, targetId === t.id && { color: '#fff' }]}>{t.icon} {t.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>זמן (דקות)</Text>
                <TextInput
                  style={styles.input} value={timeLimitMinutes}
                  onChangeText={v => { setTimeLimitMinutes(v); markDirty(); }}
                  keyboardType="number-pad" textAlign="right"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ציון מעבר (%)</Text>
                <TextInput
                  style={styles.input} value={passingScore}
                  onChangeText={v => { setPassingScore(v); markDirty(); }}
                  keyboardType="number-pad" textAlign="right"
                />
              </View>
            </View>

            <View style={[styles.switchRow, { marginTop: 12 }]}>
              <Text style={styles.switchLabel}>תבנית פעילה</Text>
              <Switch
                value={isActive}
                onValueChange={v => { setIsActive(v); markDirty(); }}
                trackColor={{ true: Colors.success, false: Colors.border }}
              />
            </View>
          </FormSection>

          <FormSection title="📚 כללי שאלות">
            <View style={styles.rulesHeader}>
              <Text style={styles.totalQ}>סה״כ: {totalQ} שאלות</Text>
              <Pressable onPress={addRule} style={styles.addRuleBtn}>
                <Text style={styles.addRuleText}>+ הוסף כלל</Text>
              </Pressable>
            </View>

            <View style={styles.formTools}>
              <Pressable onPress={setCurrentRulesAdaptive} style={[styles.formToolBtn, { borderColor: Colors.primary + '66' }]}>
                <Text style={[styles.formToolText, { color: Colors.primary }]}>הפוך הכל לאדפטיבי</Text>
              </Pressable>
              <Pressable onPress={fixCurrentRuleShortages} style={[styles.formToolBtn, { borderColor: Colors.warning + '66' }]}>
                <Text style={[styles.formToolText, { color: Colors.warning }]}>תקן מחסורי שאלות</Text>
              </Pressable>
              <Pressable onPress={applyBalancedTiming} style={[styles.formToolBtn, { borderColor: Colors.success + '66' }]}>
                <Text style={[styles.formToolText, { color: Colors.success }]}>זמן מומלץ</Text>
              </Pressable>
            </View>

            {rules.map(rule => {
              const topic = TOPICS.find(t => t.id === rule.topicId);
              const available = questionsPerTopic[rule.topicId] ?? 0;
              const customVal = customCounts[rule.id] ?? '';
              return (
                <View key={rule.id} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <Pressable onPress={() => removeRule(rule.id)}>
                      <Text style={{ color: Colors.danger, fontSize: 18 }}>✕</Text>
                    </Pressable>
                    <View style={styles.ruleHeaderRight}>
                      <Text style={styles.ruleTopicLabel}>{topic?.icon} {topic?.name}</Text>
                      <Text style={styles.ruleAvail}>({available} שאלות זמינות)</Text>
                    </View>
                  </View>

                  {/* Topic picker — exclude already-used topics */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                      {TOPICS.map(t => {
                        const usedElsewhere = rules.some(r => r.id !== rule.id && r.topicId === t.id);
                        return (
                          <Pressable
                            key={t.id}
                            onPress={() => changeRuleTopic(rule.id, t.id)}
                            style={[
                              styles.miniChip,
                              rule.topicId === t.id && { backgroundColor: t.color },
                              usedElsewhere && { opacity: 0.35 },
                            ]}
                          >
                            <Text style={[styles.miniChipText, rule.topicId === t.id && { color: '#fff' }]}>
                              {t.icon} {t.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Count — presets + custom */}
                  <Text style={styles.ruleLabel}>כמות שאלות: {rule.count}</Text>
                  <View style={styles.ruleCountRow}>
                    {[3, 5, 8, 10, 15, 20].map(n => (
                      <Pressable
                        key={n}
                        onPress={() => {
                          updateRule(rule.id, { count: n });
                          setCustomCounts(prev => { const c = { ...prev }; delete c[rule.id]; return c; });
                        }}
                        style={[styles.countChip, rule.count === n && !customCounts[rule.id] && { backgroundColor: Colors.primary }]}
                      >
                        <Text style={[styles.countChipText, rule.count === n && !customCounts[rule.id] && { color: '#fff' }]}>{n}</Text>
                      </Pressable>
                    ))}
                    <TextInput
                      style={[styles.countInput, customCounts[rule.id] ? { borderColor: Colors.primary, color: Colors.primary } : {}]}
                      value={customVal}
                      onChangeText={v => {
                        setCustomCounts(prev => ({ ...prev, [rule.id]: v }));
                        const parsed = parseInt(v);
                        if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
                          updateRule(rule.id, { count: parsed });
                        }
                      }}
                      keyboardType="number-pad"
                      placeholder="אחר"
                      placeholderTextColor={Colors.textTertiary}
                      textAlign="center"
                    />
                  </View>

                  {/* Difficulty range — full 1-10 with smart enforcement */}
                  <Text style={styles.ruleLabel}>קושי: {rule.minDifficulty} – {rule.maxDifficulty}</Text>
                  <View style={styles.diffRangeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.diffRangeLabel}>מינימום</Text>
                      <View style={styles.diffBtns}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <Pressable key={n} onPress={() => updateRule(rule.id, { minDifficulty: n })}
                            style={[
                              styles.diffSmall,
                              rule.minDifficulty === n && { backgroundColor: Colors.success },
                              n > rule.maxDifficulty && { opacity: 0.3 },
                            ]}>
                            <Text style={[styles.diffSmallText, rule.minDifficulty === n && { color: '#fff' }]}>{n}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.diffRangeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.diffRangeLabel}>מקסימום</Text>
                      <View style={styles.diffBtns}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <Pressable key={n} onPress={() => updateRule(rule.id, { maxDifficulty: n })}
                            style={[
                              styles.diffSmall,
                              rule.maxDifficulty === n && { backgroundColor: Colors.danger },
                              n < rule.minDifficulty && { opacity: 0.3 },
                            ]}>
                            <Text style={[styles.diffSmallText, rule.maxDifficulty === n && { color: '#fff' }]}>{n}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Adaptive */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>הגרלה אדפטיבית 🧠</Text>
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
                <Text style={styles.emptyRulesIcon}>📋</Text>
                <Text style={styles.emptyRulesText}>לחץ "הוסף כלל" להגדרת שאלות לפי נושא</Text>
              </View>
            )}
          </FormSection>

          {/* Summary preview */}
          {rules.length > 0 && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>📊 סיכום תבנית</Text>
              <Text style={styles.summaryLine}>שאלות: {totalQ} | זמן: {timeLimitMinutes} דקות | מעבר: {passingScore}%</Text>
              <Text style={styles.summaryLine}>
                זמן ממוצע לשאלה: ~{totalQ > 0 ? Math.round((parseInt(timeLimitMinutes) || 45) * 60 / totalQ) : 0} שניות
              </Text>
              {rules.map(r => {
                const t = TOPICS.find(x => x.id === r.topicId);
                const avail = questionsPerTopic[r.topicId] ?? 0;
                const shortage = r.count > avail;
                return (
                  <Text key={r.id} style={[styles.summaryLine, shortage && { color: Colors.danger }]}>
                    {t?.icon} {t?.name}: {r.count} שאלות (ניתן: {avail}){shortage ? ' ⚠️ חסר' : ''}
                  </Text>
                );
              })}
            </View>
          )}

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

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill icon="📋" label="סה״כ תבניות" value={templates.length} />
          <StatPill icon="✅" label="פעילות" value={templates.filter(t => t.isActive).length} />
          <StatPill icon="⏸" label="מושבתות" value={templates.filter(t => !t.isActive).length} />
        </View>

        <View style={styles.auditPanel}>
          <Text style={styles.auditTitle}>בקרת מבחנים</Text>
          <View style={styles.auditGrid}>
            <AuditBox label="מחסור בשאלות" value={contentAudit.shortageCount} color={contentAudit.shortageCount ? Colors.danger : Colors.success} />
            <AuditBox label="מבחנים מושבתים" value={contentAudit.inactiveCount} color={contentAudit.inactiveCount ? Colors.warning : Colors.success} />
            <AuditBox label="זמן צפוף מדי" value={contentAudit.tooFastCount} color={contentAudit.tooFastCount ? Colors.warning : Colors.success} />
            <AuditBox label="אדפטיבי מלא" value={contentAudit.adaptiveReadyCount} color={Colors.primary} />
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>תבניות קיימות</Text>
          <Pressable onPress={openNew} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ תבנית חדשה</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput} value={search}
            onChangeText={setSearch} textAlign="right"
            placeholder="🔍 חיפוש תבנית..."
            placeholderTextColor={Colors.textTertiary}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.searchClear}>
              <Text style={{ color: Colors.textSecondary }}>✕</Text>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateFilters}>
          {([
            ['all', 'הכל'],
            ['active', 'פעילים'],
            ['inactive', 'מושבתים'],
            ['shortage', 'עם מחסור'],
          ] as Array<[typeof templateFilter, string]>).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setTemplateFilter(value)}
              style={[styles.templateFilterChip, templateFilter === value && styles.templateFilterChipActive]}
            >
              <Text style={[styles.templateFilterText, templateFilter === value && styles.templateFilterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.bulkTemplateBar}>
          <Pressable onPress={() => bulkUpdateVisibleTemplates({ isActive: true }, 'הפעלת מבחנים')} style={[styles.bulkTemplateBtn, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.bulkTemplateText, { color: Colors.success }]}>הפעל מוצגים</Text>
          </Pressable>
          <Pressable onPress={() => bulkUpdateVisibleTemplates({ isActive: false }, 'השבתת מבחנים')} style={[styles.bulkTemplateBtn, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.bulkTemplateText, { color: Colors.warning }]}>השבת מוצגים</Text>
          </Pressable>
          <Pressable onPress={fixVisibleTemplateShortages} style={[styles.bulkTemplateBtn, { backgroundColor: Colors.dangerLight }]}>
            <Text style={[styles.bulkTemplateText, { color: Colors.danger }]}>תקן מחסורים</Text>
          </Pressable>
          <Pressable onPress={setVisibleTemplatesAdaptive} style={[styles.bulkTemplateBtn, { backgroundColor: Colors.primaryLighter }]}>
            <Text style={[styles.bulkTemplateText, { color: Colors.primary }]}>הכל אדפטיבי</Text>
          </Pressable>
        </View>

        {filteredTemplates.length === 0 && (
          <View style={styles.emptyRules}>
            <Text style={styles.emptyRulesIcon}>🏗️</Text>
            <Text style={styles.emptyRulesText}>
              {search.length > 0 ? 'לא נמצאו תבניות' : 'לא קיימות תבניות עדיין. לחץ "+ תבנית חדשה"'}
            </Text>
          </View>
        )}

        {filteredTemplates.map(t => {
          const target = TARGETS.find(x => x.id === t.targetId);
          const audit = getTemplateAudit(t);
          return (
            <View key={t.id} style={styles.templateCard}>
              <View style={styles.templateHeader}>
                <View style={styles.templateMeta}>
                  <Text style={[styles.templateActive, { color: t.isActive ? Colors.success : Colors.danger }]}>
                    {t.isActive ? '● פעיל' : '● מושבת'}
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
                <StatPill icon="📊" label="מעבר%" value={t.passingScore} />
                <StatPill icon="📋" label="כללים" value={t.rules.length} />
              </View>

              <View style={styles.templateHealthRow}>
                <HealthPill label="מחסור" value={audit.shortages.length} color={audit.shortages.length ? Colors.danger : Colors.success} />
                <HealthPill label="ש׳ לשאלה" value={audit.avgSeconds} color={audit.avgSeconds < 45 ? Colors.warning : Colors.primary} />
                <HealthPill label="כללים אדפטיביים" value={`${audit.adaptiveRules}/${t.rules.length}`} color={Colors.primary} />
                <HealthPill label="קשיחות חריגה" value={audit.strictRules} color={audit.strictRules ? Colors.warning : Colors.success} />
              </View>

              {/* Rules summary */}
              <View style={styles.rulesSummary}>
                {t.rules.map(r => {
                  const topic = TOPICS.find(x => x.id === r.topicId);
                  const avail = questionsPerTopic[r.topicId] ?? 0;
                  const shortage = r.count > avail;
                  return (
                    <Text key={r.id} style={[styles.ruleSummaryText, shortage && { color: Colors.warning }]}>
                      {topic?.icon} {topic?.name}: {r.count} שאלות (רמה {r.minDifficulty}-{r.maxDifficulty})
                      {r.useAdaptive ? ' 🧠' : ''}{shortage ? ' ⚠️' : ''}
                    </Text>
                  );
                })}
              </View>

              <View style={styles.templateActions}>
                <Pressable
                  onPress={() => Alert.alert('מחיקה', `למחוק את "${t.name}"?`, [
                    { text: 'ביטול', style: 'cancel' },
                    { text: 'מחק', style: 'destructive', onPress: () => deleteTemplate(t.id) },
                  ])}
                  style={[styles.tAction, { backgroundColor: Colors.dangerLight }]}
                >
                  <Text style={[styles.tActionText, { color: Colors.danger }]}>🗑️ מחק</Text>
                </Pressable>
                <Pressable
                  onPress={() => cloneTemplate(t)}
                  style={[styles.tAction, { backgroundColor: Colors.successLight }]}
                >
                  <Text style={[styles.tActionText, { color: Colors.success }]}>📋 שכפל</Text>
                </Pressable>
                <Pressable
                  onPress={() => updateTemplate(t.id, { isActive: !t.isActive })}
                  style={[styles.tAction, { backgroundColor: t.isActive ? Colors.warningLight : Colors.successLight }]}
                >
                  <Text style={[styles.tActionText, { color: t.isActive ? Colors.warning : Colors.success }]}>
                    {t.isActive ? '⏸ השבת' : '▶ הפעל'}
                  </Text>
                </Pressable>
                {audit.shortages.length > 0 && (
                  <Pressable
                    onPress={() => fixTemplateShortages(t)}
                    style={[styles.tAction, { backgroundColor: Colors.warningLight }]}
                  >
                    <Text style={[styles.tActionText, { color: Colors.warning }]}>תקן מחסור</Text>
                  </Pressable>
                )}
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

function AuditBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.auditBox, { borderColor: color + '55', backgroundColor: color + '12' }]}>
      <Text style={[styles.auditBoxValue, { color }]}>{value}</Text>
      <Text style={styles.auditBoxLabel}>{label}</Text>
    </View>
  );
}

function HealthPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.healthPill, { borderColor: color + '44' }]}>
      <Text style={[styles.healthPillValue, { color }]}>{value}</Text>
      <Text style={styles.healthPillLabel}>{label}</Text>
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
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, direction: 'rtl', writingDirection: 'rtl' },
  content: { paddingBottom: 40, direction: 'rtl', writingDirection: 'rtl' },

  hero: { padding: 24, alignItems: 'flex-end' },
  heroIcon: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  heroDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', textAlign: 'right', lineHeight: 20, marginTop: 6 },

  statsRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  auditPanel: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 12, ...Shadow.sm },
  auditTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 10 },
  auditGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  auditBox: { flex: 1, minWidth: 118, borderRadius: Radius.lg, borderWidth: 1, padding: 10, alignItems: 'flex-end' },
  auditBoxValue: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, textAlign: 'right' },
  auditBoxLabel: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  listTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8, ...Shadow.primary },
  newBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  searchWrap: { flexDirection: 'row-reverse', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  searchInput: { flex: 1, padding: 10, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', writingDirection: 'rtl' },
  searchClear: { padding: 10 },
  templateFilters: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  templateFilterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  templateFilterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  templateFilterText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  templateFilterTextActive: { color: '#fff' },
  bulkTemplateBar: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 10, direction: 'rtl', writingDirection: 'rtl' },
  bulkTemplateBtn: { flexGrow: 1, minWidth: 128, borderRadius: Radius.lg, paddingVertical: 9, paddingHorizontal: 10, alignItems: 'center' },
  bulkTemplateText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'center', writingDirection: 'rtl' },

  templateCard: { backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadow.md, borderWidth: 1, borderColor: Colors.border },
  templateHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  templateMeta: {},
  templateActive: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  templateTitleWrap: { alignItems: 'flex-end' },
  templateName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text, textAlign: 'right' },
  templateTarget: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  templateDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 10, lineHeight: 18 },
  templateStats: { flexDirection: 'row-reverse', gap: 6, marginBottom: 10 },
  templateHealthRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  healthPill: { minWidth: 86, flexGrow: 1, borderRadius: Radius.lg, borderWidth: 1, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 7, alignItems: 'flex-end' },
  healthPillValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, textAlign: 'right' },
  healthPillLabel: { fontFamily: FontFamily.regular, fontSize: 9, color: Colors.textTertiary, textAlign: 'right', marginTop: 1 },
  rulesSummary: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 10, marginBottom: 10 },
  ruleSummaryText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 },
  templateActions: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  tAction: { borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  tActionText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  // Form styles
  formHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  formTitle: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: Colors.text },
  cancelBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 8 },
  charCount: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },
  input: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary, borderWidth: 1.5, borderColor: Colors.border },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  row: { flexDirection: 'row-reverse', gap: 12, marginTop: 12 },
  switchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text },

  rulesHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalQ: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primary },
  addRuleBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 6 },
  addRuleText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  formTools: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  formToolBtn: { flexGrow: 1, borderRadius: Radius.lg, borderWidth: 1, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  formToolText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, textAlign: 'center' },

  ruleCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  ruleHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  ruleHeaderRight: { alignItems: 'flex-end' },
  ruleTopicLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  ruleAvail: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary },
  ruleLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  ruleCountRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' },
  countChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  countChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  countInput: { width: 50, height: 32, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, textAlign: 'center', fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.text, paddingHorizontal: 4 },
  diffRangeRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 8 },
  diffRangeLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginBottom: 4 },
  diffBtns: { flexDirection: 'row-reverse', gap: 4, flexWrap: 'wrap' },
  diffSmall: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  diffSmallText: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.textSecondary },
  miniChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  miniChipText: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textSecondary },

  summaryBox: { backgroundColor: Colors.primaryLighter, borderRadius: Radius.xl, padding: 14, marginHorizontal: 0, marginBottom: 12, borderWidth: 1, borderColor: Colors.primaryLight },
  summaryTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary, textAlign: 'right', marginBottom: 6 },
  summaryLine: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 },

  emptyRules: { alignItems: 'center', padding: 24 },
  emptyRulesIcon: { fontSize: 36, marginBottom: 8 },
  emptyRulesText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },

  saveBtn: { marginHorizontal: 0, marginTop: 8, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  saveBtnGrad: { padding: 18, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
