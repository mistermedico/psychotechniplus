import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { logger } from '../utils/logger';

export interface AdminToastError {
  title: string;
  message: string;
  details?: unknown;
}

export function formatAdminErrorDetails(error: AdminToastError): string {
  const details = typeof error.details === 'string'
    ? error.details
    : error.details
      ? JSON.stringify(error.details, null, 2)
      : '';
  return [
    error.title,
    error.message,
    details,
  ].filter(Boolean).join('\n\n');
}

export function showAdminErrorToast(
  setToast: (error: AdminToastError | null) => void,
  title: string,
  message: string,
  details?: unknown,
  context = 'admin'
) {
  logger.error(context, message, details);
  setToast({ title, message, details });
}

export default function AdminErrorToast({
  error,
  onDismiss,
}: {
  error: AdminToastError | null;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsText = useMemo(() => error ? formatAdminErrorDetails(error) : '', [error]);
  if (!error) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={() => setExpanded(v => !v)} style={styles.toast}>
        <View style={styles.header}>
          <Pressable onPress={onDismiss} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeText}>x</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{error.title}</Text>
            <Text style={styles.message}>{error.message}</Text>
          </View>
        </View>
        {expanded && (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsText}>{detailsText}</Text>
            <Pressable
              onPress={() => Clipboard.setStringAsync(detailsText)}
              style={styles.copyBtn}
            >
              <Text style={styles.copyText}>העתק לוג מלא</Text>
            </Pressable>
          </View>
        )}
        {!expanded && <Text style={styles.hint}>לחץ לפרטי לוג מלאים</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    zIndex: 999,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 760,
    backgroundColor: '#3B1117',
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: 12,
    ...Shadow.lg,
  },
  header: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  titleWrap: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff', textAlign: 'right' },
  message: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#FCA5A5', textAlign: 'right', marginTop: 3, lineHeight: 18 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  closeText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  hint: { fontFamily: FontFamily.medium, fontSize: 11, color: '#FECACA', textAlign: 'right', marginTop: 8 },
  detailsBox: { marginTop: 10, padding: 10, borderRadius: Radius.lg, backgroundColor: 'rgba(0,0,0,0.22)' },
  detailsText: { fontFamily: FontFamily.regular, fontSize: 11, color: '#FEE2E2', textAlign: 'left', lineHeight: 16 },
  copyBtn: { marginTop: 10, alignSelf: 'flex-end', backgroundColor: Colors.danger, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  copyText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
});
