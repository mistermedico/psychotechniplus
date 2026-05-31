import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';

// ─── Segment definitions ──────────────────────────────────────────────────────
interface SegmentDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  color: [string, string];
  matchHint: string; // human-readable filter description
}

const SEGMENT_DEFS: SegmentDef[] = [
  {
    id: 'active',
    icon: '🟢',
    name: 'משתמשים פעילים',
    description: 'משתמשים שתרגלו בשבוע האחרון',
    matchHint: 'last_practiced_date ≥ 7 ימים אחרונים',
    color: ['#34D399', '#10B981'],
  },
  {
    id: 'veterans',
    icon: '⭐',
    name: 'משתמשים ותיקים',
    description: 'משתמשים ברמה 6 ומעלה',
    matchHint: 'level > 5',
    color: ['#FBBF24', '#F59E0B'],
  },
  {
    id: 'premium',
    icon: '💎',
    name: 'משתמשי פרמיום',
    description: 'מנויים פעילים עם גישה מלאה',
    matchHint: 'is_premium = true',
    color: ['#7C6FF7', '#5A52D5'],
  },
  {
    id: 'beginners',
    icon: '🌱',
    name: 'מתחילים',
    description: 'משתמשים ברמה 1 עד 2',
    matchHint: 'level BETWEEN 1 AND 2',
    color: ['#22D3EE', '#0EA5E9'],
  },
  {
    id: 'inactive',
    icon: '😴',
    name: 'לא פעילים',
    description: 'לא תרגלו 14 ימים ומעלה',
    matchHint: 'last_practiced_date < 14 ימים אחרונים או null',
    color: ['#F87171', '#EF4444'],
  },
];

// ─── Action button ────────────────────────────────────────────────────────────
function ActionButton({
  label,
  icon,
  onPress,
  accent,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        { borderColor: accent },
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      <Text style={styles.actionBtnIcon}>{icon}</Text>
      <Text style={[styles.actionBtnLabel, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Segment card ─────────────────────────────────────────────────────────────
function SegmentCard({ seg }: { seg: SegmentDef }) {
  return (
    <View style={styles.card}>
      {/* Top gradient bar */}
      <LinearGradient
        colors={seg.color}
        style={styles.cardAccentBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      <View style={styles.cardBody}>
        {/* Icon + name */}
        <View style={styles.cardHeader}>
          <View style={[styles.segIconWrap, { backgroundColor: `${seg.color[0]}22` }]}>
            <Text style={styles.segIcon}>{seg.icon}</Text>
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle}>{seg.name}</Text>
            <Text style={styles.cardDesc}>{seg.description}</Text>
          </View>
        </View>

        {/* Filter hint */}
        <View style={styles.hintRow}>
          <Text style={styles.hintIcon}>🔍</Text>
          <Text style={styles.hintText}>{seg.matchHint}</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <ActionButton
            label="שלח הודעה"
            icon="✉️"
            accent={Colors.primary}
            onPress={() => router.push('/admin/inbox-admin')}
          />
          <ActionButton
            label="שלח Push"
            icon="🔔"
            accent={Colors.warning}
            onPress={() => router.push('/admin/notifications')}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function UserSegmentsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={['#1A1740', '#0E0B2A']} style={styles.header}>
          <Text style={styles.headerIcon}>🔬</Text>
          <Text style={styles.headerTitle}>פילוח משתמשים</Text>
          <Text style={styles.headerSub}>
            קבוצות ניתוח לשליחת הודעות ממוקדות
          </Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{SEGMENT_DEFS.length} סגמנטים</Text>
          </View>
        </LinearGradient>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            פילוח משתמשים מאפשר לך לשלוח הודעות ממוקדות לקבוצות מסוימות.
            בחר סגמנט ולחץ על הפעולה הרצויה כדי לנווט לכלי השליחה.
          </Text>
        </View>

        {/* Section title */}
        <Text style={styles.sectionTitle}>סגמנטים מוגדרים</Text>

        {/* Segment cards */}
        {SEGMENT_DEFS.map(seg => (
          <SegmentCard key={seg.id} seg={seg} />
        ))}

        {/* How-to footer */}
        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>איך לשלוח לסגמנט?</Text>
          <View style={styles.footerStep}>
            <Text style={styles.footerStepNum}>1</Text>
            <Text style={styles.footerStepText}>
              בחר את הסגמנט המתאים מהרשימה למעלה
            </Text>
          </View>
          <View style={styles.footerStep}>
            <Text style={styles.footerStepNum}>2</Text>
            <Text style={styles.footerStepText}>
              לחץ על "שלח הודעה" לניווט ל-Inbox, או "שלח Push" להתראה
            </Text>
          </View>
          <View style={styles.footerStep}>
            <Text style={styles.footerStepNum}>3</Text>
            <Text style={styles.footerStepText}>
              הגדר את ההודעה ופנה לפי שם הסגמנט בשדה הכותרת
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0F172A' },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  headerIcon:  { fontSize: 36, marginBottom: 8 },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 14,
  },
  headerBadge: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  headerBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: { fontSize: 18, marginTop: 2 },
  infoText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },

  // Section title
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 12,
    paddingRight: 2,
  },

  // Segment card
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.xl,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  cardAccentBar: {
    height: 4,
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  segIconWrap: {
    width: 50,
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  segIcon: { fontSize: 24 },
  cardTitleBlock: { flex: 1 },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },

  // Filter hint
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
    gap: 6,
  },
  hintIcon: { fontSize: 13 },
  hintText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    flex: 1,
    fontVariant: ['tabular-nums'],
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  actionBtnIcon: { fontSize: 15 },
  actionBtnLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
  },

  // How-to footer
  footerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  footerStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  footerStepNum: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.primary,
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    flexShrink: 0,
  },
  footerStepText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
});
