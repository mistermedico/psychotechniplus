import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
} from 'react-native';
import { Question } from '../data/types';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow, Spacing } from '../constants/theme';
import { useSettingsStore, FontSizeOption } from '../store/settingsStore';

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

  const {
    showDifficultyBadge,
    showEloOnQuestion,
    shuffleOptions,
    collapseReadingPassage,
    questionFontSize,
  } = useSettingsStore();

  // Stable shuffled options order — computed once per question.id
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

  // Reset passage expansion when question changes
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

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Reading passage */}
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
              <Text style={styles.passageText}>{question.readingPassage}</Text>
            </ScrollView>
          )}
        </View>
      )}

      {/* Question text */}
      <View style={styles.questionBox}>
        {/* Badge row: difficulty + ELO */}
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
        <Text style={[styles.questionText, { fontSize: questionFontSize_ }]}>
          {question.questionText}
        </Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {displayOptions.map(opt => (
          <Pressable
            key={opt.id}
            onPress={() => !revealed && onSelect(opt.id)}
            disabled={revealed}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.optionBase,
              getOptionStyle(opt.id),
              pressed && !revealed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={[styles.optionIconBox, getOptionStyle(opt.id)]}>
              <Text style={getOptionTextStyle(opt.id)}>{getOptionIcon(opt.id)}</Text>
            </View>
            <Text style={[styles.optionTextBase, getOptionTextStyle(opt.id)]}>
              {opt.text}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  passageBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 14,
    borderRightWidth: 3,
    borderRightColor: Colors.primary,
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
    color: Colors.primary,
    textAlign: 'right',
  },
  passageToggleBtn: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  passageToggleText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  passageScroll: { maxHeight: 120 },
  passageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 22,
    textAlign: 'right',
  },

  questionBox: {
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.primaryLighter,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  difficultyText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  eloBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  eloText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  questionText: {
    fontFamily: FontFamily.semiBold,
    color: Colors.text,
    lineHeight: 28,
    textAlign: 'right',
  },

  optionsContainer: { gap: 10 },

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
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: Colors.primaryLighter,
    borderColor: Colors.primary,
  },
  optionCorrect: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  optionWrong: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.danger,
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
    textAlign: 'right',
  },
  optionText: { color: Colors.text },
  optionTextSelected: { color: Colors.primary },
  optionTextCorrect: { color: Colors.success },
  optionTextWrong: { color: Colors.danger },
});
