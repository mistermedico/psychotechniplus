import React, { useMemo } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius } from '../constants/theme';

interface VisualImageProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  fallbackLabel?: string;
}

function isSvgUri(uri?: string | null): boolean {
  return !!uri && /^data:image\/svg\+xml/i.test(uri);
}

function decodeBase64(value: string): string | null {
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(
        Array.prototype.map.call(atob(value), (char: string) => (
          `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`
        )).join('')
      );
    }
  } catch {}
  return null;
}

function svgXmlFromUri(uri?: string | null): string | null {
  if (!isSvgUri(uri)) return null;
  const commaIndex = uri!.indexOf(',');
  if (commaIndex < 0) return null;
  const metadata = uri!.slice(0, commaIndex).toLowerCase();
  const payload = uri!.slice(commaIndex + 1);
  if (!payload) return null;
  if (metadata.includes(';base64')) return decodeBase64(payload);
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

export function VisualImage({ uri, style, resizeMode = 'contain', fallbackLabel = 'תמונה לא זמינה' }: VisualImageProps) {
  const xml = useMemo(() => svgXmlFromUri(uri), [uri]);

  if (xml) {
    return (
      <View style={[styles.svgBox, style]}>
        <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
      </View>
    );
  }

  if (uri) {
    return <Image source={{ uri }} style={style as StyleProp<ImageStyle>} resizeMode={resizeMode} />;
  }

  return (
    <View style={[styles.missingBox, style]}>
      <Text style={styles.missingText}>{fallbackLabel}</Text>
    </View>
  );
}

export function isVisualSvg(uri?: string | null): boolean {
  return isSvgUri(uri);
}

const styles = StyleSheet.create({
  svgBox: {
    overflow: 'hidden',
  },
  missingBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  missingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
