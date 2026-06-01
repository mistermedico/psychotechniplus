import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, Alert, Share, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore, PromoCode } from '../../store/adminStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

const DISCOUNT_LABELS: Record<PromoCode['discountType'], string> = {
  percent: 'הנחה באחוזים',
  days_free: 'ימים חינמיים',
  full_access: 'גישה מלאה',
};

const DISCOUNT_COLORS: Record<PromoCode['discountType'], string> = {
  percent: Colors.primary,
  days_free: Colors.success,
  full_access: '#F59E0B',
};

function getDiscountBadge(code: PromoCode): string {
  if (code.discountType === 'percent') return `${code.discountValue}% הנחה`;
  if (code.discountType === 'days_free') return `${code.discountValue} ימים חינם`;
  return 'גישה מלאה';
}

export default function PromoCodesScreen() {
  const { promoCodes, addPromoCode, updatePromoCode, deletePromoCode, togglePromoCode } = useAdminStore();

  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [newCode, setNewCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<PromoCode['discountType']>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const activeCodes = promoCodes.filter(c => c.isActive);
  const totalUsesToday = 12; // mock
  const totalSavings = promoCodes.reduce((sum, c) => {
    if (c.discountType === 'percent') return sum + c.usedCount * (c.discountValue / 100) * 59;
    if (c.discountType === 'days_free') return sum + c.usedCount * 2;
    return sum + c.usedCount * 59;
  }, 0);

  const handleCopy = async (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: code });
  };

  const handleDelete = (code: PromoCode) => {
    Alert.alert('מחיקת קוד', `האם למחוק את הקוד "${code.code}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        deletePromoCode(code.id);
      }},
    ]);
  };

  const handleCreate = () => {
    if (!newCode.trim()) { Alert.alert('שגיאה', 'הזן קוד קופון'); return; }
    const val = parseFloat(discountValue);
    if (discountType === 'percent' && (isNaN(val) || val <= 0 || val > 100)) {
      Alert.alert('שגיאה', 'הנחה באחוזים חייבת להיות בין 1 ל-100');
      return;
    }
    if (discountType === 'days_free' && (isNaN(val) || val <= 0)) {
      Alert.alert('שגיאה', 'הזן מספר ימים תקין');
      return;
    }
    const expiryTrimmed = expiresAt.trim();
    if (expiryTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(expiryTrimmed)) {
      Alert.alert('שגיאה', 'תאריך תפוגה חייב להיות בפורמט YYYY-MM-DD');
      return;
    }
    addPromoCode({
      code: newCode.trim().toUpperCase(),
      description: description.trim(),
      discountType,
      discountValue: discountType === 'full_access' ? 100 : val,
      maxUses: parseInt(maxUses) || 0,
      expiresAt: expiryTrimmed || null,
      isActive: true,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
    resetForm();
  };

  const resetForm = () => {
    setNewCode('');
    setDescription('');
    setDiscountType('percent');
    setDiscountValue('');
    setMaxUses('');
    setExpiresAt('');
  };

  const formatExpiry = (date: string | null) => {
    if (!date) return 'ללא תפוגה';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎟️ קודי קופון</Text>
        <Text style={styles.headerSub}>ניהול הנחות וקודי גישה</Text>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatChip label="קודים פעילים" value={activeCodes.length} color={Colors.success} />
        <StatChip label="שימושים היום" value={totalUsesToday} color={Colors.primary} />
        <StatChip label="חסכון ₪" value={`₪${Math.round(totalSavings).toLocaleString()}`} color={Colors.warning} />
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {promoCodes.map(code => {
          const maxU = code.maxUses === 0 ? '∞' : code.maxUses;
          const progress = code.maxUses > 0 ? (code.usedCount / code.maxUses) : 0;
          const badgeColor = DISCOUNT_COLORS[code.discountType];
          return (
            <View key={code.id} style={[styles.card, !code.isActive && styles.cardInactive]}>
              {/* Code + Copy */}
              <View style={styles.cardTop}>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => handleDelete(code)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>🗑</Text>
                  </Pressable>
                  <Pressable onPress={() => handleCopy(code.code)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>📋</Text>
                  </Pressable>
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.codeText}>{code.code}</Text>
                  <Text style={styles.codeDesc}>{code.description}</Text>
                </View>
              </View>

              {/* Type badge */}
              <View style={styles.badgeRow}>
                <Switch
                  value={code.isActive}
                  onValueChange={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    togglePromoCode(code.id);
                  }}
                  trackColor={{ false: '#334155', true: Colors.success + '80' }}
                  thumbColor={code.isActive ? Colors.success : '#64748B'}
                />
                <View style={[styles.typeBadge, { backgroundColor: badgeColor + '25', borderColor: badgeColor }]}>
                  <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{getDiscountBadge(code)}</Text>
                </View>
              </View>

              {/* Progress bar */}
              {code.maxUses > 0 && (
                <View style={styles.progressWrap}>
                  <Text style={styles.progressLabel}>
                    {code.usedCount} / {maxU} שימושים
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[
                      styles.progressFill,
                      { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: progress > 0.8 ? Colors.danger : Colors.primary },
                    ]} />
                  </View>
                </View>
              )}
              {code.maxUses === 0 && (
                <Text style={styles.progressLabel}>{code.usedCount} שימושים · ללא מגבלה</Text>
              )}

              {/* Expiry */}
              <Text style={styles.expiryText}>תפוגה: {formatExpiry(code.expiresAt)}</Text>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModalVisible(true); }}
        style={styles.fab}
      >
        <LinearGradient colors={Colors.gradients.gold} style={styles.fabGrad}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </Pressable>

      {/* Create Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>קוד קופון חדש</Text>

              <Text style={styles.fieldLabel}>קוד</Text>
              <TextInput
                style={styles.input}
                value={newCode}
                onChangeText={v => setNewCode(v.toUpperCase())}
                placeholder="STUDENT2025"
                placeholderTextColor="#475569"
                textAlign="right"
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>תיאור</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="תיאור קצר"
                placeholderTextColor="#475569"
                textAlign="right"
              />

              <Text style={styles.fieldLabel}>סוג הנחה</Text>
              <View style={styles.typePicker}>
                {(['percent', 'days_free', 'full_access'] as PromoCode['discountType'][]).map(t => (
                  <Pressable
                    key={t}
                    onPress={() => setDiscountType(t)}
                    style={[styles.typeOption, discountType === t && styles.typeOptionActive]}
                  >
                    <Text style={[styles.typeOptionText, discountType === t && styles.typeOptionTextActive]}>
                      {DISCOUNT_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {discountType !== 'full_access' && (
                <>
                  <Text style={styles.fieldLabel}>
                    {discountType === 'percent' ? 'אחוז הנחה (0-100)' : 'מספר ימים'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    placeholder={discountType === 'percent' ? '50' : '7'}
                    placeholderTextColor="#475569"
                    textAlign="right"
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>מקסימום שימושים (0 = ללא הגבלה)</Text>
              <TextInput
                style={styles.input}
                value={maxUses}
                onChangeText={setMaxUses}
                placeholder="100"
                placeholderTextColor="#475569"
                textAlign="right"
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>תאריך תפוגה (YYYY-MM-DD, רשות)</Text>
              <TextInput
                style={styles.input}
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="2025-12-31"
                placeholderTextColor="#475569"
                textAlign="right"
              />

              <View style={styles.modalActions}>
                <Pressable onPress={() => { setModalVisible(false); resetForm(); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>ביטול</Text>
                </Pressable>
                <Pressable onPress={handleCreate} style={styles.createBtn}>
                  <LinearGradient colors={Colors.gradients.gold} style={styles.createBtnGrad}>
                    <Text style={styles.createBtnText}>צור קוד</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[statStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: Radius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    ...Shadow.sm,
  },
  value: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  label: { fontFamily: FontFamily.regular, fontSize: 10, color: '#64748B', marginTop: 2 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },

  header: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'flex-end',
  },
  backBtn: { marginBottom: 6 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: '#94A3B8' },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#94A3B8', marginTop: 2 },

  statsRow: { flexDirection: 'row-reverse', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },

  list: { paddingHorizontal: 12, paddingTop: 4, gap: 12 },

  card: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    ...Shadow.md,
    gap: 10,
  },
  cardInactive: { opacity: 0.6 },

  cardTop: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  cardTitleWrap: { flex: 1 },
  cardActions: { flexDirection: 'row-reverse', gap: 4 },
  actionBtn: { padding: 6 },
  actionBtnText: { fontSize: 18 },

  codeText: {
    fontFamily: 'Heebo_700Bold',
    fontSize: FontSize['2xl'],
    color: '#fff',
    letterSpacing: 2,
    textAlign: 'right',
  },
  codeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 2,
  },

  badgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  typeBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1,
  },
  typeBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  progressWrap: { gap: 4 },
  progressLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#64748B', textAlign: 'right' },
  progressTrack: { height: 8, backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  expiryText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#64748B', textAlign: 'right' },

  fab: { position: 'absolute', bottom: 24, left: 24 },
  fabGrad: {
    width: 56, height: 56,
    borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.lg,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: '#fff',
    textAlign: 'right',
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: Radius.md,
    padding: 12,
    color: '#fff',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typePicker: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  typeOption: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#0F172A',
    borderWidth: 1, borderColor: '#334155',
  },
  typeOptionActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  typeOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#94A3B8' },
  typeOptionTextActive: { color: '#fff' },

  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: '#94A3B8' },
  createBtn: { flex: 2, borderRadius: Radius.xl, overflow: 'hidden' },
  createBtnGrad: { padding: 16, alignItems: 'center' },
  createBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
});
