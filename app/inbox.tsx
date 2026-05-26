import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAdminStore, InboxMessage } from '../store/adminStore';
import { useUserStore } from '../store/userStore';
import { ThemeColors } from '../constants/colors';
import { useColors } from '../hooks/useColors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

export default function InboxScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { inboxMessages } = useAdminStore();
  const { userId, isPremium, readMessageIds, markMessageRead } = useUserStore();

  const visibleMessages = useMemo(() => {
    return inboxMessages
      .filter(msg => {
        if (msg.targetType === 'all') return true;
        if (msg.targetType === 'premium') return isPremium;
        if (msg.targetType === 'free') return !isPremium;
        if (msg.targetType === 'specific') return !!userId && msg.targetUserIds.includes(userId);
        return false;
      })
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [inboxMessages, userId, isPremium]);

  useEffect(() => {
    visibleMessages.forEach(msg => {
      if (!readMessageIds.includes(msg.id)) {
        markMessageRead(msg.id);
      }
    });
  }, [visibleMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <LinearGradient colors={colors.gradients.primaryDeep} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📬 הודעות</Text>
        <Text style={styles.headerSub}>הודעות מהמערכת</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visibleMessages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>אין הודעות חדשות</Text>
          </View>
        ) : (
          visibleMessages.map(msg => {
            const isUnread = !readMessageIds.includes(msg.id);
            return (
              <View key={msg.id} style={[styles.card, isUnread && styles.cardUnread]}>
                {isUnread && <View style={styles.unreadDot} />}
                <View style={styles.cardInner}>
                  <View style={styles.iconWrap}>
                    <Text style={styles.icon}>{msg.icon || '📣'}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{msg.title}</Text>
                    <Text style={styles.cardText}>{msg.body}</Text>
                    <Text style={styles.cardDate}>{formatDate(msg.sentAt)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { padding: 20, paddingTop: 16, paddingBottom: 20, alignItems: 'flex-end' },
    backBtn: { marginBottom: 6 },
    backText: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: 'rgba(255,255,255,0.75)' },
    headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
    headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

    content: { padding: 16, gap: 12 },

    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyIcon: { fontSize: 48 },
    emptyText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: colors.textSecondary },

    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Shadow.sm,
    },
    cardUnread: {
      borderColor: colors.primary + '60',
      backgroundColor: colors.primary + '08',
    },
    unreadDot: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      zIndex: 1,
    },
    cardInner: {
      flexDirection: 'row-reverse',
      padding: 16,
      gap: 12,
      alignItems: 'flex-start',
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: Radius.lg,
      backgroundColor: colors.primaryLighter,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    icon: { fontSize: 24 },
    cardBody: { flex: 1, alignItems: 'flex-end', gap: 4 },
    cardTitle: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      color: colors.text,
      textAlign: 'right',
    },
    cardText: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      textAlign: 'right',
      lineHeight: 20,
    },
    cardDate: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.xs,
      color: colors.textTertiary,
      marginTop: 4,
    },
  });
}
