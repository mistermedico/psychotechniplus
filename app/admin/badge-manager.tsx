import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, TextInput, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../../constants/theme';
import { useAdminStore } from '../../store/adminStore';

// ─── Badge definitions ────────────────────────────────────────────────────────
interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  color: [string, string];
}

const BADGE_DEFS: BadgeDef[] = [
  { id: 'first_session',    icon: '🌱', name: 'סשן ראשון',     description: 'השלמת הסשן הראשון',               color: ['#34D399', '#10B981'] },
  { id: 'streak_7',         icon: '🔥', name: 'שבוע של להבה',  description: '7 ימים רצופים של תרגול',           color: ['#F97316', '#EF4444'] },
  { id: 'streak_30',        icon: '🌟', name: 'חודש מצטיין',   description: '30 ימים רצופים',                   color: ['#FBBF24', '#F59E0B'] },
  { id: 'perfect_score',    icon: '💯', name: 'מושלם',          description: '100% דיוק בסשן',                  color: ['#7C6FF7', '#5A52D5'] },
  { id: 'speed_master',     icon: '⚡', name: 'מלך המהירות',   description: 'השלמת מצב מהירות',                 color: ['#22D3EE', '#0EA5E9'] },
  { id: 'topic_complete',   icon: '🏆', name: 'מסיים נושא',    description: 'השלמת כל שאלות הנושא',             color: ['#FBBF24', '#D97706'] },
  { id: 'simulation_pass',  icon: '🎖️', name: 'עובר סימולציה', description: 'עבר סימולציה מלאה',                color: ['#C084FC', '#7C6FF7'] },
  { id: 'level_up',         icon: '⬆️', name: 'עלייה ברמה',   description: 'הגעת לרמה חדשה',                   color: ['#34D399', '#22D3EE'] },
];

// ─── Award dialog (web-safe alternative to Alert.prompt) ─────────────────────
interface AwardDialogProps {
  badge: BadgeDef;
  onClose: () => void;
  onAward: (userId: string) => void;
}

function AwardDialog({ badge, onClose, onAward }: AwardDialogProps) {
  const [userId, setUserId] = useState('');
  return (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialogCard}>
        <Text style={styles.dialogTitle}>הענק תג: {badge.icon} {badge.name}</Text>
        <Text style={styles.dialogLabel}>מזהה משתמש (User ID)</Text>
        <TextInput
          style={styles.dialogInput}
          value={userId}
          onChangeText={setUserId}
          placeholder="הכנס User UUID..."
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
        />
        <View style={styles.dialogActions}>
          <Pressable style={[styles.dialogBtn, styles.dialogBtnCancel]} onPress={onClose}>
            <Text style={styles.dialogBtnText}>ביטול</Text>
          </Pressable>
          <Pressable
            style={[styles.dialogBtn, styles.dialogBtnAward, !userId.trim() && styles.dialogBtnDisabled]}
            onPress={() => { if (userId.trim()) { onAward(userId.trim()); onClose(); } }}
          >
            <Text style={[styles.dialogBtnText, styles.dialogBtnTextAward]}>הענק</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function BadgeManagerScreen() {
  const { logActivity } = useAdminStore();

  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(
    Object.fromEntries(BADGE_DEFS.map(b => [b.id, true]))
  );
  const [awardDialog, setAwardDialog] = useState<BadgeDef | null>(null);

  function toggleBadge(id: string) {
    setEnabledMap((prev: Record<string, boolean>) => {
      const next = { ...prev, [id]: !prev[id] };
      logActivity(
        `תג ${id} ${next[id] ? 'הופעל' : 'הושבת'}`,
        'content'
      );
      return next;
    });
  }

  function handleAwardNative(badge: BadgeDef) {
    Alert.prompt(
      `הענק תג: ${badge.icon} ${badge.name}`,
      'הכנס מזהה משתמש (User UUID)',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הענק',
          onPress: (userId?: string) => {
            const uid = userId?.trim();
            if (!uid) return;
            logActivity(`העניק תג "${badge.name}" למשתמש ${uid}`, 'users');
            Alert.alert('✅ בוצע', `תג "${badge.name}" נרשם עבור ${uid}`);
          },
        },
      ],
      'plain-text',
    );
  }

  function handleAwardPress(badge: BadgeDef) {
    if (Platform.OS === 'web') {
      setAwardDialog(badge);
    } else {
      handleAwardNative(badge);
    }
  }

  function handleWebAward(badge: BadgeDef, userId: string) {
    logActivity(`העניק תג "${badge.name}" למשתמש ${userId}`, 'users');
    Alert.alert('✅ בוצע', `תג "${badge.name}" נרשם עבור ${userId}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Overlay dialog */}
      {awardDialog && Platform.OS === 'web' && (
        <AwardDialog
          badge={awardDialog}
          onClose={() => setAwardDialog(null)}
          onAward={uid => handleWebAward(awardDialog, uid)}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <LinearGradient
          colors={['#1A1740', '#0E0B2A']}
          style={styles.headerCard}
        >
          <Text style={styles.headerIcon}>🏅</Text>
          <Text style={styles.headerTitle}>ניהול תגי הישג</Text>
          <Text style={styles.headerSub}>
            הפעל/השבת תגים והעניק אותם ידנית למשתמשים
          </Text>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNum}>{BADGE_DEFS.length}</Text>
              <Text style={styles.headerStatLabel}>סה״כ תגים</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNum}>
                {Object.values(enabledMap).filter(Boolean).length}
              </Text>
              <Text style={styles.headerStatLabel}>פעילים</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNum}>
                {Object.values(enabledMap).filter(v => !v).length}
              </Text>
              <Text style={styles.headerStatLabel}>מושבתים</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Badge list */}
        <Text style={styles.sectionTitle}>רשימת תגים</Text>

        {BADGE_DEFS.map(badge => {
          const enabled = enabledMap[badge.id] ?? true;
          return (
            <View key={badge.id} style={[styles.badgeCard, !enabled && styles.badgeCardDisabled]}>
              {/* Left accent bar */}
              <LinearGradient
                colors={enabled ? badge.color : ['#334155', '#475569']}
                style={styles.badgeAccent}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />

              {/* Icon */}
              <View style={[styles.badgeIconWrap, { opacity: enabled ? 1 : 0.4 }]}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
              </View>

              {/* Info */}
              <View style={styles.badgeInfo}>
                <Text style={[styles.badgeName, !enabled && styles.textMuted]}>
                  {badge.name}
                </Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
                <Text style={styles.badgeId}>{badge.id}</Text>
              </View>

              {/* Controls */}
              <View style={styles.badgeControls}>
                {/* Toggle */}
                <View style={styles.toggleRow}>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleBadge(badge.id)}
                    trackColor={{ false: Colors.surface, true: Colors.primary }}
                    thumbColor={enabled ? '#fff' : Colors.textTertiary}
                  />
                </View>

                {/* Award button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.awardBtn,
                    enabled && styles.awardBtnActive,
                    pressed && { opacity: 0.7 },
                    !enabled && styles.awardBtnDisabled,
                  ]}
                  onPress={() => enabled && handleAwardPress(badge)}
                  disabled={!enabled}
                >
                  <Text style={[styles.awardBtnText, !enabled && styles.textMuted]}>
                    הענק ידנית
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* Info footer */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            השבתת תג מונעת הענקה אוטומטית חדשה אך לא מסיר תגים קיימים.
            הענקה ידנית מתועדת ביומן הפעילות.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scroll: { flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 0,
  },

  // Header card
  headerCard: {
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  headerIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
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
    marginBottom: 20,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerStatNum: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.text,
  },
  headerStatLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  headerStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },

  // Section title
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 12,
    paddingRight: 4,
  },

  // Badge card
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  badgeCardDisabled: {
    opacity: 0.65,
  },
  badgeAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  badgeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 12,
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 4,
  },
  badgeName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 2,
  },
  badgeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 2,
  },
  badgeId: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  textMuted: {
    color: Colors.textTertiary,
  },
  badgeControls: {
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  toggleRow: {
    alignItems: 'center',
  },
  awardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  awardBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLighter,
  },
  awardBtnDisabled: {
    opacity: 0.4,
  },
  awardBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'center',
  },

  // Award dialog (web)
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialogCard: {
    backgroundColor: '#1E293B',
    borderRadius: Radius.xl,
    padding: 24,
    width: 340,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    ...Shadow.lg,
  },
  dialogTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  dialogLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 6,
  },
  dialogInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    padding: 12,
    marginBottom: 20,
    textAlign: 'right',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  dialogBtnCancel: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dialogBtnAward: {
    backgroundColor: Colors.primary,
  },
  dialogBtnDisabled: {
    opacity: 0.5,
  },
  dialogBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  dialogBtnTextAward: {
    color: '#fff',
  },

  // Info footer
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: { fontSize: 18, marginTop: 1 },
  infoText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
});
