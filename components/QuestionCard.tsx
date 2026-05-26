import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated, Image,
} from 'react-native';
import { Question } from '../data/types';
import { ThemeColors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow, Spacing } from '../constants/theme';
import { useSettingsStore, FontSizeOption } from '../store/settingsStore';
import { detectDir, textAlign } from '../utils/textDirection';
import { useColors } from '../hooks/useColors';

interface Props {
  question: Question;
  selectedId: string | null;
  revealed: boolean;
  onSelect: (id: string) => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const fontSizeMap: Record<FontSizeOption, number> = {
  small: FontSize.base,
  medium: FontSize.lg,
  large: FontSize.xl,
};

export function QuestionCard({ question, selectedId, revealed, onSelect }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const {
    showDifficultyBadge,
    showEloOnQuestion,
    shuffleOptions,
    collapseReadingPassage,
    questionFontSize,
  } = useSettingsStore();

  const shuffledOptionsRef = useRef<typeof question.options | null>(null);
  const lastQuestionIdRef = useRef<string | null>(null);

  if (lastQuestionIdRef.current !== question.id) {
    lastQuestionIdRef.current = question.id;
    shuffledOptionsRef.current = shuffleOptions
      ? shuffleArray(question.options)
      : question.options;
  }
  const displayOptions = shuffledOptionsRef.current ?? question.options;

  const [passageExpanded, setPassageExpanded] = useState(!collapseReadingPassage);

  useEffect(() => {
    setPassageExpanded(!collapseReadingPassage);
  }, [question.id, collapseReadingPassage]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [question.id]);

  const getOptionStyle = (optId: string) => {
    if (!revealed) {
      return selectedId === optId ? styles.optionSelected : styles.optionDefault;
    }
    const opt = question.options.find(o => o.id === optId);
    if (opt?.isCorrect) return styles.optionCorrect;
    if (selectedId === optId && !opt?.isCorrect) return styles.optionWrong;
    return styles.optionDefault;
  };

  const getOptionTextStyle = (optId: string) => {
    if (!revealed) {
      return selectedId === optId ? styles.optionTextSelected : styles.optionText;
    }
    const opt = question.options.find(o => o.id === optId);
    if (opt?.isCorrect) return styles.optionTextCorrect;
    if (selectedId === optId && !opt?.isCorrect) return styles.optionTextWrong;
    return styles.optionText;
  };

  const getOptionIcon = (optId: string) => {
    if (!revealed) return '○';
    const opt = question.options.find(o => o.id === optId);
    if (opt?.isCorrect) return '✓';
    if (selectedId === optId) return '✗';
    return '○';
  };

  const questionFontSize_ = fontSizeMap[questionFontSize];
  const questionDir = detectDir(question.questionText);
  const passageDir = question.readingPassage ? detectDir(question.readingPassage) : 'rtl';

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {question.readingPassage && (
        <View style={styles.passageBox}>
          <View style={styles.passageHeaderRow}>
            <Text style={styles.passageLabel}>📖 קטע לקריאה</Text>
            {collapseReadingPassage && (
              <Pressable
                onPress={() => setPassageExpanded(v => !v)}
                style={styles.passageToggleBtn}
              >
                <Text style={styles.passageToggleText}>
                  {passageExpanded ? 'הסתר קטע' : 'הצג קטע'}
                </Text>
              </Pressable>
            )}
          </View>
          {passageExpanded && (
            <ScrollView style={styles.passageScroll} nestedScrollEnabled>
              <Text style={[styles.passageText, { textAlign: textAlign(question.readingPassage ?? ''), writingDirection: passageDir }]}>
                {question.readingPassage}
              </Text>
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.questionBox}>
        {(showDifficultyBadge || showEloOnQuestion) && (
          <View style={styles.badgeRow}>
            {showDifficultyBadge && (
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>רמה {question.difficulty}</Text>
              </View>
            )}
            {showEloOnQuestion && (
              <View style={styles.eloBadge}>
                <Text style={styles.eloText}>ELO {question.psychometricStats.elo}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={[styles.questionText, { fontSize: questionFontSize_, textAlign: textAlign(question.questionText), writingDirection: questionDir }]}>
          {question.questionText}
        </Text>
        {question.mediaUrl && question.mediaType === 'image' && (
          <Image
            source={{ uri: question.mediaUrl }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        )}
      </View>

      {(() => {
        const allOptionsHaveImages = displayOptions.every(o => !!o.imageUrl);
        if (allOptionsHaveImages) {
          return (
            <View style={styles.optionsGrid}>
              {displayOptions.map(opt => {
                const isTextEmpty = !opt.text || !opt.text.trim();
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => !revealed && onSelect(opt.id)}
                    disabled={revealed}
                    style={({ pressed }) => [
                      styles.optionGridCell,
                      getOptionStyle(opt.id),
                      pressed && !revealed && { opacity: 0.85 },
                    ]}
                  >
                    <Image
                      source={{ uri: opt.imageUrl! }}
                      style={styles.optionGridImage}
                      resizeMode="contain"
                    />
                    {!isTextEmpty && (
                      <Text style={[styles.optionGridText, getOptionTextStyle(opt.id)]}>
                        {opt.text}
                      </Text>
                    )}
                    <Text style={[styles.optionGridIcon, getOptionTextStyle(opt.id)]}>
                      {getOptionIcon(opt.id)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        }

        return (
          <View style={styles.optionsContainer}>
            {displayOptions.map(opt => {
              const optDir = detectDir(opt.text);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => !revealed && onSelect(opt.id)}
                  disabled={revealed}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedId === opt.id, disabled: revealed }}
                  accessibilityLabel={opt.text}
                  style={({ pressed }) => [
                    styles.optionBase,
                    getOptionStyle(opt.id),
                    { flexDirection: optDir === 'rtl' ? 'row-reverse' : 'row' },
                    pressed && !revealed && { transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={[styles.optionIconBox, getOptionStyle(opt.id)]}>
                    <Text style={getOptionTextStyle(opt.id)}>{getOptionIcon(opt.id)}</Text>
                  </View>
                  <Text style={[styles.optionTextBase, getOptionTextStyle(opt.id), { textAlign: textAlign(opt.text), writingDirection: optDir }]}>
                    {opt.text}
                  </Text>
                  {opt.imageUrl && (
                    <Image
                      source={{ uri: opt.imageUrl }}
                      style={styles.optionThumbnail}
                      resizeMode="cover"
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })()}
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },

    passageBox: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: Radius.lg,
      padding: 14,
      marginBottom: 14,
      borderRightWidth: 3,
      borderRightColor: colors.primary,
    },
    passageHeaderRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    passageLabel: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      color: colors.primary,
      textAlign: 'right',
    },
    passageToggleBtn: {
      backgroundColor: colors.primaryLighter,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    passageToggleText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.xs,
      color: colors.primary,
    },
    passageScroll: { maxHeight: 120 },
    passageText: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      color: colors.text,
      lineHeight: 22,
    },

    questionBox: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: 20,
      marginBottom: 16,
      ...Shadow.md,
    },
    badgeRow: {
      flexDirection: 'row-reverse',
      gap: 6,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    difficultyBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryLighter,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    difficultyText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.xs,
      color: colors.primary,
    },
    eloBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.warningLight,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    eloText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.xs,
      color: colors.warning,
    },
    questionText: {
      fontFamily: FontFamily.semiBold,
      color: colors.text,
      lineHeight: 28,
    },

    questionImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginTop: 8,
    },

    optionsContainer: { gap: 10 },

    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionGridCell: {
      width: '48%',
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      padding: 8,
      alignItems: 'center',
      minHeight: 44,
    },
    optionGridImage: {
      width: '100%',
      height: 110,
      borderRadius: Radius.md,
      marginBottom: 4,
    },
    optionGridText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
      textAlign: 'center',
      marginTop: 2,
    },
    optionGridIcon: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.sm,
      marginTop: 4,
    },

    optionThumbnail: {
      width: 60,
      height: 60,
      borderRadius: Radius.sm,
    },

    optionBase: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 1.5,
      gap: 12,
      minHeight: 56,
    },
    optionDefault: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    optionSelected: {
      backgroundColor: colors.primaryLighter,
      borderColor: colors.primary,
    },
    optionCorrect: {
      backgroundColor: colors.successLight,
      borderColor: colors.success,
    },
    optionWrong: {
      backgroundColor: colors.dangerLight,
      borderColor: colors.danger,
    },

    optionIconBox: {
      width: 28,
      height: 28,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0,
      backgroundColor: 'transparent',
    },

    optionTextBase: {
      flex: 1,
      fontFamily: FontFamily.medium,
      fontSize: FontSize.base,
    },
    optionText: { color: colors.text },
    optionTextSelected: { color: colors.primary },
    optionTextCorrect: { color: colors.success },
    optionTextWrong: { color: colors.danger },
  });
}
