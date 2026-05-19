import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform, Image, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { useAdminStore } from '../../store/adminStore';
import { GenerationPreset } from '../../store/adminStore';
import { TOPICS } from '../../data/mockData';
import { Question, QuestionType, QuestionOption } from '../../data/types';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { detectDir, textAlign as ta } from '../../utils/textDirection';

// ── Types ─────────────────────────────────────────────────────────────────

type GenerationMode = 'quick' | 'custom' | 'passage' | 'varied';

interface GeneratedQuestion {
  questionText: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  questionType: QuestionType;
  mediaUrl?: string;
  imageOnly?: boolean;
}

interface EditableQuestion extends GeneratedQuestion {
  localId: string;
  fadeAnim: Animated.Value;
}

// ── Question type config ──────────────────────────────────────────────────

const QUESTION_TYPES: { type: QuestionType; label: string; icon: string }[] = [
  { type: 'multiple_choice', label: 'בחירה מרובה', icon: '🔤' },
  { type: 'verbal', label: 'מילולי', icon: '💬' },
  { type: 'logic', label: 'היגיון', icon: '🧩' },
  { type: 'quantitative', label: 'כמותי', icon: '🔢' },
  { type: 'shapes', label: 'מרחב/צורות', icon: '🔷' },
  { type: 'reading_comprehension', label: 'הבנת הנקרא', icon: '📖' },
  { type: 'true_false', label: 'נכון/לא נכון', icon: '✅' },
  { type: 'fill_in_the_blank', label: 'השלמת משפט', icon: '✏️' },
];

// ── Mock question templates ───────────────────────────────────────────────

function generateMockQuestions(params: {
  topicId: string;
  topicName: string;
  questionType: QuestionType;
  difficulty: number;
  count: number;
  customPrompt?: string;
  readingPassage?: string;
  mode: GenerationMode;
}): GeneratedQuestion[] {
  const { topicId, questionType, difficulty, count, mode } = params;

  const TEMPLATES: Record<string, Record<string, GeneratedQuestion[]>> = {
    topic_quantitative: {
      quantitative: [
        {
          questionText: 'טרן נסע ממהירות 80 קמ"ש למרחק 240 ק"מ. כמה זמן הנסיעה?',
          options: [{ id: 'a', text: '2 שעות', isCorrect: false }, { id: 'b', text: '3 שעות', isCorrect: true }, { id: 'c', text: '4 שעות', isCorrect: false }, { id: 'd', text: '2.5 שעות', isCorrect: false }],
          correctAnswer: 'b', explanation: 'זמן = מרחק / מהירות = 240 / 80 = 3 שעות.', difficulty, questionType,
        },
        {
          questionText: 'בחנות יש 240 מוצרים. 35% מהם נמכרו. כמה מוצרים נותרו?',
          options: [{ id: 'a', text: '84', isCorrect: false }, { id: 'b', text: '156', isCorrect: true }, { id: 'c', text: '144', isCorrect: false }, { id: 'd', text: '168', isCorrect: false }],
          correctAnswer: 'b', explanation: '35% מ-240 = 84 נמכרו. נותרו: 240 - 84 = 156.', difficulty, questionType,
        },
        {
          questionText: 'ב-5 ימים הדפיסה מדפסת 1,500 עמודים. כמה עמודים תדפיס ב-8 ימים?',
          options: [{ id: 'a', text: '2,200', isCorrect: false }, { id: 'b', text: '2,400', isCorrect: true }, { id: 'c', text: '1,800', isCorrect: false }, { id: 'd', text: '2,000', isCorrect: false }],
          correctAnswer: 'b', explanation: 'קצב: 1500/5 = 300 עמ׳ ביום. ב-8 ימים: 300×8 = 2,400.', difficulty, questionType,
        },
        {
          questionText: 'מה ההסתברות לקבל ראש שלוש פעמים ברציפות בזריקת מטבע?',
          options: [{ id: 'a', text: '1/4', isCorrect: false }, { id: 'b', text: '1/6', isCorrect: false }, { id: 'c', text: '1/8', isCorrect: true }, { id: 'd', text: '3/8', isCorrect: false }],
          correctAnswer: 'c', explanation: 'הסתברות כל זריקה: 1/2. שלוש ברציפות: (1/2)³ = 1/8.', difficulty, questionType,
        },
        {
          questionText: 'אם x² - 5x + 6 = 0, מהם ערכי x?',
          options: [{ id: 'a', text: 'x=1, x=6', isCorrect: false }, { id: 'b', text: 'x=2, x=3', isCorrect: true }, { id: 'c', text: 'x=-2, x=-3', isCorrect: false }, { id: 'd', text: 'x=1, x=5', isCorrect: false }],
          correctAnswer: 'b', explanation: 'פירוק לגורמים: (x-2)(x-3)=0 → x=2 או x=3.', difficulty, questionType,
        },
      ],
      multiple_choice: [
        {
          questionText: 'מהו שטח מלבן שאורכו 12 ס"מ ורוחבו 7 ס"מ?',
          options: [{ id: 'a', text: '84 סמ"ר', isCorrect: true }, { id: 'b', text: '38 סמ"ר', isCorrect: false }, { id: 'c', text: '96 סמ"ר', isCorrect: false }, { id: 'd', text: '76 סמ"ר', isCorrect: false }],
          correctAnswer: 'a', explanation: 'שטח מלבן = אורך × רוחב = 12 × 7 = 84 סמ"ר.', difficulty, questionType: 'multiple_choice' as QuestionType,
        },
        {
          questionText: 'מה הוא המספר הגדול מבין: √144, 11.5, 12.1, 3³?',
          options: [{ id: 'a', text: '√144 = 12', isCorrect: false }, { id: 'b', text: '11.5', isCorrect: false }, { id: 'c', text: '3³ = 27', isCorrect: true }, { id: 'd', text: '12.1', isCorrect: false }],
          correctAnswer: 'c', explanation: '3³ = 27, שהוא הגדול מבין כל האפשרויות.', difficulty, questionType: 'multiple_choice' as QuestionType,
        },
        {
          questionText: 'ריבית פשוטה על הלוואה של 5,000 ₪ ב-4% לשנה — כמה ריבית לאחר 3 שנים?',
          options: [{ id: 'a', text: '600 ₪', isCorrect: true }, { id: 'b', text: '624 ₪', isCorrect: false }, { id: 'c', text: '200 ₪', isCorrect: false }, { id: 'd', text: '400 ₪', isCorrect: false }],
          correctAnswer: 'a', explanation: 'ריבית פשוטה = קרן × ריבית × זמן = 5000 × 0.04 × 3 = 600 ₪.', difficulty, questionType: 'multiple_choice' as QuestionType,
        },
      ],
    },
    topic_verbal: {
      verbal: [
        {
          questionText: 'אנלוגיה: מוזיקאי : תזמורת = שחקן : ___',
          options: [{ id: 'a', text: 'תיאטרון', isCorrect: false }, { id: 'b', text: 'להקה', isCorrect: false }, { id: 'c', text: 'קהל', isCorrect: false }, { id: 'd', text: 'חברה תיאטרונית', isCorrect: true }],
          correctAnswer: 'd', explanation: 'מוזיקאי הוא חלק מתזמורת; שחקן הוא חלק מחברה תיאטרונית.', difficulty, questionType,
        },
        {
          questionText: 'מה ההפך של "גלוי"?',
          options: [{ id: 'a', text: 'נסתר', isCorrect: true }, { id: 'b', text: 'פתוח', isCorrect: false }, { id: 'c', text: 'זמין', isCorrect: false }, { id: 'd', text: 'חשוף', isCorrect: false }],
          correctAnswer: 'a', explanation: '"גלוי" = נראה לעין. ההפך — "נסתר" = מוסתר.', difficulty, questionType,
        },
        {
          questionText: 'מה ההפך של "מצמצם"?',
          options: [{ id: 'a', text: 'מרחיב', isCorrect: true }, { id: 'b', text: 'מחזיק', isCorrect: false }, { id: 'c', text: 'מוסיף', isCorrect: false }, { id: 'd', text: 'מגדיל', isCorrect: false }],
          correctAnswer: 'a', explanation: '"מצמצם" = מקטין, מגביל. ההפך המדויק הוא "מרחיב".', difficulty, questionType,
        },
        {
          questionText: 'אנלוגיה: ספר : סופר = ציור : ___',
          options: [{ id: 'a', text: 'גלריה', isCorrect: false }, { id: 'b', text: 'צבעים', isCorrect: false }, { id: 'c', text: 'צייר', isCorrect: true }, { id: 'd', text: 'מוזיאון', isCorrect: false }],
          correctAnswer: 'c', explanation: 'ספר נוצר על ידי סופר; ציור נוצר על ידי צייר.', difficulty, questionType,
        },
        {
          questionText: 'השלם: "_____ הוא הגדול שבין ילדי המשפחה"',
          options: [{ id: 'a', text: 'הבכור', isCorrect: true }, { id: 'b', text: 'הצעיר', isCorrect: false }, { id: 'c', text: 'האמצעי', isCorrect: false }, { id: 'd', text: 'הקטן', isCorrect: false }],
          correctAnswer: 'a', explanation: '"בכור" = הנולד ראשון, הגדול שבין האחים.', difficulty, questionType,
        },
      ],
      fill_in_the_blank: [
        {
          questionText: 'הדרך הקצרה ביותר בין שתי נקודות היא ___.',
          options: [{ id: 'a', text: 'עקומה', isCorrect: false }, { id: 'b', text: 'קו ישר', isCorrect: true }, { id: 'c', text: 'קשת', isCorrect: false }, { id: 'd', text: 'ספירלה', isCorrect: false }],
          correctAnswer: 'b', explanation: 'אקסיומה גיאומטרית: הדרך הקצרה היא קו ישר.', difficulty, questionType: 'fill_in_the_blank' as QuestionType,
        },
        {
          questionText: 'ה___ של המחשב מאחסן מידע זמנית בזמן עבודה.',
          options: [{ id: 'a', text: 'דיסק קשיח', isCorrect: false }, { id: 'b', text: 'זיכרון RAM', isCorrect: true }, { id: 'c', text: 'מעבד', isCorrect: false }, { id: 'd', text: 'כרטיס מסך', isCorrect: false }],
          correctAnswer: 'b', explanation: 'זיכרון RAM (Random Access Memory) מאחסן נתונים זמניים בזמן ריצת תוכנות.', difficulty, questionType: 'fill_in_the_blank' as QuestionType,
        },
        {
          questionText: 'עונת ה___ מאופיינת בגשמים רבים בישראל.',
          options: [{ id: 'a', text: 'קיץ', isCorrect: false }, { id: 'b', text: 'אביב', isCorrect: false }, { id: 'c', text: 'חורף', isCorrect: true }, { id: 'd', text: 'סתיו', isCorrect: false }],
          correctAnswer: 'c', explanation: 'בישראל, החורף הוא עונת הגשמים העיקרית.', difficulty, questionType: 'fill_in_the_blank' as QuestionType,
        },
      ],
    },
    topic_logic: {
      logic: [
        {
          questionText: 'מצא את ההמשך: 1, 1, 2, 3, 5, 8, ___',
          options: [{ id: 'a', text: '11', isCorrect: false }, { id: 'b', text: '12', isCorrect: false }, { id: 'c', text: '13', isCorrect: true }, { id: 'd', text: '14', isCorrect: false }],
          correctAnswer: 'c', explanation: 'סדרת פיבונאצ׳י — כל איבר שווה לסכום שני הקודמים: 5+8=13.', difficulty, questionType,
        },
        {
          questionText: 'כולם שיחקו שחמט. יוסי לא שיחק שחמט. מה ניתן להסיק?',
          options: [{ id: 'a', text: 'יוסי לא שייך לקבוצה', isCorrect: true }, { id: 'b', text: 'יוסי לא אוהב שחמט', isCorrect: false }, { id: 'c', text: 'יוסי אינו מוכשר', isCorrect: false }, { id: 'd', text: 'אי אפשר להסיק', isCorrect: false }],
          correctAnswer: 'a', explanation: 'אם כולם בקבוצה שיחקו, ויוסי לא שיחק — יוסי אינו חלק מהקבוצה.', difficulty, questionType,
        },
        {
          questionText: 'מצא את ההמשך: 2, 6, 18, 54, ___',
          options: [{ id: 'a', text: '108', isCorrect: false }, { id: 'b', text: '162', isCorrect: true }, { id: 'c', text: '216', isCorrect: false }, { id: 'd', text: '72', isCorrect: false }],
          correctAnswer: 'b', explanation: 'כל איבר מוכפל ב-3: 54×3=162.', difficulty, questionType,
        },
        {
          questionText: 'אם כל הכלבים הם יונקים, וכל היונקים נושמים — האם כל הכלבים נושמים?',
          options: [{ id: 'a', text: 'כן, בהכרח', isCorrect: true }, { id: 'b', text: 'לא, אין קשר', isCorrect: false }, { id: 'c', text: 'אולי', isCorrect: false }, { id: 'd', text: 'רק חלקם', isCorrect: false }],
          correctAnswer: 'a', explanation: 'סילוגיזם: כלב → יונק → נושם. לכן כל כלב נושם.', difficulty, questionType,
        },
        {
          questionText: 'מצא את הסדרה: 1, 4, 9, 16, 25, ___',
          options: [{ id: 'a', text: '30', isCorrect: false }, { id: 'b', text: '34', isCorrect: false }, { id: 'c', text: '36', isCorrect: true }, { id: 'd', text: '32', isCorrect: false }],
          correctAnswer: 'c', explanation: 'מספרים ריבועיים: 1²,2²,3²,4²,5²,6²=36.', difficulty, questionType,
        },
      ],
      true_false: [
        {
          questionText: 'אם א→ב, וב→ג, אז בהכרח א→ג.',
          options: [{ id: 'a', text: 'נכון', isCorrect: true }, { id: 'b', text: 'לא נכון', isCorrect: false }],
          correctAnswer: 'a', explanation: 'זהו חוק הטרנזיטיביות: אם A גורר B וB גורר C, אז A גורר C.', difficulty, questionType: 'true_false' as QuestionType,
        },
        {
          questionText: 'מספר שלם שלא מתחלק ב-2 הוא בהכרח אי-זוגי.',
          options: [{ id: 'a', text: 'נכון', isCorrect: true }, { id: 'b', text: 'לא נכון', isCorrect: false }],
          correctAnswer: 'a', explanation: 'הגדרה: מספר שלם שאינו מתחלק ב-2 הוא אי-זוגי.', difficulty, questionType: 'true_false' as QuestionType,
        },
        {
          questionText: 'כל מספר ראשוני הוא אי-זוגי.',
          options: [{ id: 'a', text: 'נכון', isCorrect: false }, { id: 'b', text: 'לא נכון', isCorrect: true }],
          correctAnswer: 'b', explanation: 'המספר 2 הוא ראשוני וזוגי — לכן לא כל ראשוני אי-זוגי.', difficulty, questionType: 'true_false' as QuestionType,
        },
      ],
    },
    topic_spatial: {
      shapes: [
        {
          questionText: 'כמה ציר סימטריה יש לריבוע?',
          options: [{ id: 'a', text: '2', isCorrect: false }, { id: 'b', text: '4', isCorrect: true }, { id: 'c', text: '1', isCorrect: false }, { id: 'd', text: '8', isCorrect: false }],
          correctAnswer: 'b', explanation: 'ריבוע: 2 לאורך האלכסונות + 2 לאורך האמצעים = 4 צירים.', difficulty, questionType,
        },
        {
          questionText: 'כמה פאות יש לתיבה (קוביה) ב-3 ממדים?',
          options: [{ id: 'a', text: '4', isCorrect: false }, { id: 'b', text: '8', isCorrect: false }, { id: 'c', text: '6', isCorrect: true }, { id: 'd', text: '12', isCorrect: false }],
          correctAnswer: 'c', explanation: 'לקוביה יש 6 פאות: למעלה, למטה, קדמי, אחורי, שמאלי, ימני.', difficulty, questionType,
        },
        {
          questionText: 'איזה גוף תלת-ממדי מתקבל מסיבוב מלבן סביב אחד מצלעותיו?',
          options: [{ id: 'a', text: 'כדור', isCorrect: false }, { id: 'b', text: 'גליל', isCorrect: true }, { id: 'c', text: 'חרוט', isCorrect: false }, { id: 'd', text: 'פירמידה', isCorrect: false }],
          correctAnswer: 'b', explanation: 'סיבוב מלבן סביב צלעו יוצר גליל (צילינדר).', difficulty, questionType,
        },
        {
          questionText: 'כמה מישורי סימטריה יש לכדור?',
          options: [{ id: 'a', text: '2', isCorrect: false }, { id: 'b', text: '4', isCorrect: false }, { id: 'c', text: 'אינסוף', isCorrect: true }, { id: 'd', text: '6', isCorrect: false }],
          correctAnswer: 'c', explanation: 'לכדור יש אינסוף מישורי סימטריה — כל מישור דרך מרכזו.', difficulty, questionType,
        },
        {
          questionText: 'לאיזה צורה 2D יש את היחס השטח/היקף הגדול ביותר?',
          options: [{ id: 'a', text: 'ריבוע', isCorrect: false }, { id: 'b', text: 'עיגול', isCorrect: true }, { id: 'c', text: 'משולש שווה-צלעות', isCorrect: false }, { id: 'd', text: 'משושה', isCorrect: false }],
          correctAnswer: 'b', explanation: 'מבין כל הצורות, לעיגול יחס שטח/היקף מרבי — זהו פתרון בעיית האיזופרימטר.', difficulty, questionType,
        },
      ],
    },
    topic_english: {
      verbal: [
        {
          questionText: 'Choose the word most similar in meaning to "Verbose":',
          options: [{ id: 'a', text: 'Concise', isCorrect: false }, { id: 'b', text: 'Wordy', isCorrect: true }, { id: 'c', text: 'Silent', isCorrect: false }, { id: 'd', text: 'Clear', isCorrect: false }],
          correctAnswer: 'b', explanation: '"Verbose" means using more words than needed — "wordy" is the closest synonym.', difficulty, questionType,
        },
        {
          questionText: 'Choose the antonym of "Benevolent":',
          options: [{ id: 'a', text: 'Kind', isCorrect: false }, { id: 'b', text: 'Generous', isCorrect: false }, { id: 'c', text: 'Malevolent', isCorrect: true }, { id: 'd', text: 'Helpful', isCorrect: false }],
          correctAnswer: 'c', explanation: '"Benevolent" = kind/well-meaning. Its antonym is "malevolent" = wishing harm.', difficulty, questionType,
        },
        {
          questionText: 'Complete: "The scientist made a remarkable ___ that changed medicine."',
          options: [{ id: 'a', text: 'disaster', isCorrect: false }, { id: 'b', text: 'discovery', isCorrect: true }, { id: 'c', text: 'decision', isCorrect: false }, { id: 'd', text: 'departure', isCorrect: false }],
          correctAnswer: 'b', explanation: 'In context, "discovery" fits — scientists make discoveries that change fields.', difficulty, questionType,
        },
        {
          questionText: 'Analogy: Chapter : Book = Scene : ___',
          options: [{ id: 'a', text: 'Actor', isCorrect: false }, { id: 'b', text: 'Stage', isCorrect: false }, { id: 'c', text: 'Play', isCorrect: true }, { id: 'd', text: 'Theatre', isCorrect: false }],
          correctAnswer: 'c', explanation: 'A chapter is a part of a book; a scene is a part of a play.', difficulty, questionType,
        },
        {
          questionText: 'Which sentence uses "affect" correctly?',
          options: [
            { id: 'a', text: 'The affect of rain is flooding.', isCorrect: false },
            { id: 'b', text: 'Rain can affect the crops.', isCorrect: true },
            { id: 'c', text: 'What is the affect?', isCorrect: false },
            { id: 'd', text: 'This has no affect on me.', isCorrect: false },
          ],
          correctAnswer: 'b', explanation: '"Affect" is a verb meaning "to influence". "Effect" is the noun for the result.', difficulty, questionType,
        },
      ],
    },
  };

  // Get the pool for this topic + type
  const topicPool = TEMPLATES[topicId] ?? TEMPLATES['topic_quantitative'];
  const typePool: GeneratedQuestion[] = (topicPool[questionType] ?? topicPool[Object.keys(topicPool)[0]] ?? []) as GeneratedQuestion[];

  const fallbackPool: GeneratedQuestion[] = [
    {
      questionText: `שאלה לדוגמה בנושא ${params.topicName} ברמת קושי ${difficulty}`,
      options: [
        { id: 'a', text: 'תשובה א', isCorrect: false },
        { id: 'b', text: 'תשובה ב (נכונה)', isCorrect: true },
        { id: 'c', text: 'תשובה ג', isCorrect: false },
        { id: 'd', text: 'תשובה ד', isCorrect: false },
      ],
      correctAnswer: 'b',
      explanation: 'זוהי שאלה לדוגמה. במצב ייצור, שאלה זו תגיע מה-API של Claude.',
      difficulty,
      questionType,
    },
  ];

  const pool = typePool.length > 0 ? typePool : fallbackPool;
  const result: GeneratedQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const template = { ...pool[i % pool.length] };
    // Vary difficulty for "varied" mode
    if (mode === 'varied') {
      template.difficulty = Math.max(1, Math.min(10, 1 + Math.round((i / Math.max(count - 1, 1)) * 9)));
    } else {
      template.difficulty = difficulty;
    }
    result.push({ ...template });
  }

  return result;
}

// ── API call ──────────────────────────────────────────────────────────────

async function callGenerateAPI(params: {
  topicId: string;
  topicName: string;
  questionType: QuestionType;
  difficulty: number;
  count: number;
  customPrompt?: string;
  readingPassage?: string;
  mode: GenerationMode;
}): Promise<GeneratedQuestion[]> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-questions', {
      body: {
        topicId: params.topicId,
        topicName: params.topicName,
        questionType: params.questionType,
        difficulty: params.difficulty,
        count: params.count,
        customPrompt: params.customPrompt,
        readingPassage: params.readingPassage,
        language: 'he',
      },
    });
    if (!error && data?.questions?.length) {
      return data.questions as GeneratedQuestion[];
    }
  } catch {
    // fall through to mock
  }
  return generateMockQuestions(params);
}

// ── Difficulty colors ─────────────────────────────────────────────────────

function difficultyColor(d: number): string {
  if (d <= 3) return Colors.success;
  if (d <= 6) return Colors.warning;
  return Colors.danger;
}

function difficultyBg(d: number): string {
  if (d <= 3) return Colors.successLight;
  if (d <= 6) return Colors.warningLight;
  return Colors.dangerLight;
}

// ── Main component ────────────────────────────────────────────────────────

export default function AiGenerator() {
  const { addQuestion, addGenerationSession, generationSessions, generationPresets, addGenerationPreset, deleteGenerationPreset } = useAdminStore();

  // Tab
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);

  // Settings tab state
  const [mode, setMode] = useState<GenerationMode>('custom');
  const [selectedTopicId, setSelectedTopicId] = useState(TOPICS[0]?.id ?? '');
  const [selectedType, setSelectedType] = useState<QuestionType>('multiple_choice');
  const [difficulty, setDifficulty] = useState(5);
  const [count, setCount] = useState(5);
  const [customPrompt, setCustomPrompt] = useState('');
  const [passage, setPassage] = useState('');

  // Results tab state
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);

  // Preset save modal
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [presetName, setPresetName] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  // ── Generate ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    setQuestions([]);
    setActiveTab(1);
    setSavedCount(0);
    setDiscardedCount(0);

    // If "quick" mode, jump straight to API with last used settings
    const topic = TOPICS.find(t => t.id === selectedTopicId) ?? TOPICS[0];
    const effectiveCount = mode === 'quick' ? Math.min(count, 3) : count;
    const effectiveType = mode === 'passage' ? 'reading_comprehension' as QuestionType : selectedType;

    const raw = await callGenerateAPI({
      topicId: selectedTopicId,
      topicName: topic?.name ?? '',
      questionType: effectiveType,
      difficulty,
      count: effectiveCount,
      customPrompt,
      readingPassage: mode === 'passage' ? passage : undefined,
      mode,
    });

    setIsGenerating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reveal questions one by one
    const editable: EditableQuestion[] = raw.map((q, i) => ({
      ...q,
      localId: `q_${Date.now()}_${i}`,
      fadeAnim: new Animated.Value(0),
    }));

    for (let i = 0; i < editable.length; i++) {
      setQuestions(prev => [...prev, editable[i]]);
      Animated.timing(editable[i].fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      if (i < editable.length - 1) {
        await new Promise(res => setTimeout(res, 600));
      }
    }
  }, [mode, selectedTopicId, selectedType, difficulty, count, customPrompt, passage]);

  // ── Save / Discard ──────────────────────────────────────────────────────

  const saveQuestion = useCallback((eq: EditableQuestion) => {
    const q: Omit<Question, 'id'> = {
      targetIds: ['target_psychometric'],
      topicId: selectedTopicId,
      questionType: eq.questionType,
      questionText: eq.questionText,
      options: eq.options,
      correctAnswer: eq.correctAnswer,
      explanation: eq.explanation,
      difficulty: eq.difficulty,
      psychometricStats: { elo: 900 + eq.difficulty * 90, discrimination: 0.65, guessProbability: 0.25 },
      accessLevel: 'free',
      validationStatus: 'pending',
      smartPracticeEligible: false,
      generalPracticeEligible: false,
    };
    addQuestion(q);
    setSavedCount(c => c + 1);
    setQuestions(prev => prev.filter(x => x.localId !== eq.localId));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addQuestion, selectedTopicId]);

  const discardQuestion = useCallback((localId: string) => {
    setDiscardedCount(c => c + 1);
    setQuestions(prev => prev.filter(x => x.localId !== localId));
  }, []);

  const saveAll = useCallback(() => {
    const topic = TOPICS.find(t => t.id === selectedTopicId);
    questions.forEach(eq => {
      const q: Omit<Question, 'id'> = {
        targetIds: ['target_psychometric'],
        topicId: selectedTopicId,
        questionType: eq.questionType,
        questionText: eq.questionText,
        options: eq.options,
        correctAnswer: eq.correctAnswer,
        explanation: eq.explanation,
        difficulty: eq.difficulty,
        psychometricStats: { elo: 900 + eq.difficulty * 90, discrimination: 0.65, guessProbability: 0.25 },
        accessLevel: 'free',
        validationStatus: 'pending',
        smartPracticeEligible: false,
        generalPracticeEligible: false,
      };
      addQuestion(q);
    });
    addGenerationSession({
      topicId: selectedTopicId,
      topicName: topic?.name ?? '',
      questionType: selectedType,
      difficulty,
      count,
      customPrompt,
      savedCount: questions.length,
      discardedCount,
    });
    setSavedCount(c => c + questions.length);
    setQuestions([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('נשמר!', `${questions.length} שאלות נוספו למאגר כ"ממתינות".\nיש לאשר אותן בתור הולידציה.`);
  }, [questions, addQuestion, addGenerationSession, selectedTopicId, selectedType, difficulty, count, customPrompt, discardedCount]);

  const discardAll = useCallback(() => {
    Alert.alert('מחיקת הכל', `למחוק את כל ${questions.length} השאלות?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק הכל', style: 'destructive', onPress: () => {
          setDiscardedCount(c => c + questions.length);
          setQuestions([]);
        },
      },
    ]);
  }, [questions]);

  // ── Update question field ───────────────────────────────────────────────

  const updateQuestionField = useCallback((localId: string, field: keyof EditableQuestion, value: string) => {
    setQuestions(prev => prev.map(q => q.localId === localId ? { ...q, [field]: value } : q));
  }, []);

  const updateOptionText = useCallback((localId: string, optId: string, text: string) => {
    setQuestions(prev => prev.map(q =>
      q.localId === localId
        ? { ...q, options: q.options.map(o => o.id === optId ? { ...o, text } : o) }
        : q
    ));
  }, []);

  const toggleImageOnly = useCallback((localId: string, value: boolean) => {
    setQuestions(prev => prev.map(q =>
      q.localId === localId ? { ...q, imageOnly: value } : q
    ));
  }, []);

  const setCorrectOption = useCallback((localId: string, optId: string) => {
    setQuestions(prev => prev.map(q =>
      q.localId === localId
        ? {
          ...q,
          correctAnswer: optId,
          options: q.options.map(o => ({ ...o, isCorrect: o.id === optId })),
        }
        : q
    ));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Presets ─────────────────────────────────────────────────────────────

  const loadPreset = useCallback((preset: GenerationPreset) => {
    setSelectedTopicId(preset.topicId);
    setSelectedType(preset.questionType as QuestionType);
    setDifficulty(preset.difficulty);
    setCount(preset.count);
    setCustomPrompt(preset.customPrompt);
    setActiveTab(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    addGenerationPreset({
      name: presetName.trim(),
      topicId: selectedTopicId,
      questionType: selectedType,
      difficulty,
      count,
      customPrompt,
    });
    setPresetName('');
    setShowPresetInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [presetName, addGenerationPreset, selectedTopicId, selectedType, difficulty, count, customPrompt]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const topic = TOPICS.find(t => t.id === selectedTopicId);
  const typeConfig = QUESTION_TYPES.find(t => t.type === selectedType);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#1E1B4B', '#312E81']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ חזור</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🤖 מחולל AI</Text>
        </View>
        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { label: 'הגדרות', icon: '⚙️' },
            { label: 'תוצאות', icon: '✨' },
            { label: 'היסטוריה', icon: '📋' },
          ].map((t, i) => (
            <Pressable
              key={i}
              onPress={() => setActiveTab(i as 0 | 1 | 2)}
              style={[styles.tab, activeTab === i && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {t.icon} {t.label}
                {i === 1 && questions.length > 0 ? ` (${questions.length})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Tab 0: Settings */}
      {activeTab === 0 && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mode chips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>מצב יצירה</Text>
              <View style={styles.modeRow}>
                {([
                  { key: 'quick', icon: '⚡', label: 'מהיר' },
                  { key: 'custom', icon: '📝', label: 'מותאם' },
                  { key: 'passage', icon: '📖', label: 'מקטע' },
                  { key: 'varied', icon: '🔄', label: 'שונות' },
                ] as { key: GenerationMode; icon: string; label: string }[]).map(m => (
                  <Pressable
                    key={m.key}
                    onPress={() => setMode(m.key)}
                    style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeChipText, mode === m.key && styles.modeChipTextActive]}>
                      {m.icon} {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Question type grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>סוג שאלה</Text>
              <View style={styles.typeGrid}>
                {QUESTION_TYPES.map(qt => (
                  <Pressable
                    key={qt.type}
                    onPress={() => setSelectedType(qt.type)}
                    style={[styles.typeCell, selectedType === qt.type && styles.typeCellActive]}
                  >
                    <Text style={styles.typeCellIcon}>{qt.icon}</Text>
                    <Text style={[styles.typeCellLabel, selectedType === qt.type && styles.typeCellLabelActive]}>
                      {qt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Topic horizontal scroll */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>נושא</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicScroll}>
                {TOPICS.map(t => (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedTopicId(t.id)}
                    style={[styles.topicChip, selectedTopicId === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                  >
                    <Text style={[styles.topicChipText, selectedTopicId === t.id && { color: '#fff' }]}>
                      {t.icon} {t.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Difficulty dots */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                רמת קושי: <Text style={{ color: difficultyColor(difficulty) }}>{difficulty}/10</Text>
              </Text>
              <View style={styles.diffRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <Pressable
                    key={n}
                    onPress={() => setDifficulty(n)}
                    style={[styles.diffDot, { backgroundColor: n <= difficulty ? difficultyColor(n) : Colors.surfaceTertiary }]}
                  >
                    <Text style={[styles.diffDotText, { color: n <= difficulty ? '#fff' : Colors.textTertiary }]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Count */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>כמות שאלות</Text>
              <View style={styles.countRow}>
                {[1, 3, 5, 10, 20].map(n => (
                  <Pressable
                    key={n}
                    onPress={() => setCount(n)}
                    style={[styles.countBtn, count === n && styles.countBtnActive]}
                  >
                    <Text style={[styles.countBtnText, count === n && { color: '#fff' }]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Passage or prompt */}
            {mode === 'passage' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>קטע לקריאה</Text>
                <TextInput
                  style={[styles.promptInput, { minHeight: 120 }]}
                  multiline
                  value={passage}
                  onChangeText={setPassage}
                  placeholder="הדבק כאן את קטע הקריאה..."
                  placeholderTextColor={Colors.textTertiary}
                  textAlign="right"
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>הנחיה חופשית (אופציונלי)</Text>
                <TextInput
                  style={styles.promptInput}
                  multiline
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  placeholder='לדוגמה: "שאלות על הסתברות עם תנאי", "אנלוגיות עם מילים מדעיות"...'
                  placeholderTextColor={Colors.textTertiary}
                  textAlign="right"
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Presets */}
            {generationPresets.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>פריסות שמורות</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicScroll}>
                  {generationPresets.map(p => (
                    <Pressable
                      key={p.id}
                      onPress={() => loadPreset(p)}
                      onLongPress={() => {
                        Alert.alert('מחק פריסה', `למחוק את הפריסה "${p.name}"?`, [
                          { text: 'ביטול', style: 'cancel' },
                          { text: 'מחק', style: 'destructive', onPress: () => deleteGenerationPreset(p.id) },
                        ]);
                      }}
                      style={styles.presetChip}
                    >
                      <Text style={styles.presetChipName}>{p.name}</Text>
                      <Text style={styles.presetChipMeta}>קושי {p.difficulty} · {p.count} שאלות</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Generate button */}
            <Pressable
              onPress={handleGenerate}
              disabled={isGenerating}
              style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.9 }]}
            >
              <LinearGradient
                colors={isGenerating ? ['#6D28D9', '#6D28D9'] : ['#8B5CF6', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateBtnGrad}
              >
                {isGenerating ? (
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.generateBtnText}>מייצר שאלות...</Text>
                  </View>
                ) : (
                  <Text style={styles.generateBtnText}>
                    🤖 יצור {count} שאלות · {typeConfig?.icon} {typeConfig?.label} · {topic?.icon} {topic?.name}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Tab 1: Results */}
      {activeTab === 1 && (
        <View style={{ flex: 1 }}>
          {/* Results header bar */}
          {questions.length > 0 && (
            <View style={styles.resultsHeaderBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultsHeaderTitle}>{questions.length} שאלות נוצרו</Text>
              </View>
              <Pressable onPress={discardAll} style={[styles.resultHeaderBtn, { backgroundColor: Colors.dangerLight, borderColor: Colors.danger }]}>
                <Text style={[styles.resultHeaderBtnText, { color: Colors.danger }]}>🗑️ מחק הכל</Text>
              </Pressable>
              <Pressable onPress={saveAll} style={[styles.resultHeaderBtn, { backgroundColor: Colors.primaryLighter, borderColor: Colors.primary }]}>
                <Text style={[styles.resultHeaderBtnText, { color: Colors.primary }]}>💾 שמור הכל</Text>
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Loading skeleton */}
            {isGenerating && (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>מייצר שאלות עם AI...</Text>
                <Text style={styles.loadingSubtext}>זה יכול לקחת כמה שניות</Text>
              </View>
            )}

            {/* Empty state */}
            {!isGenerating && questions.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🤖</Text>
                <Text style={styles.emptyTitle}>אין שאלות עדיין</Text>
                <Text style={styles.emptySubtitle}>הגדר שאלות בלשונית הגדרות ולחץ "יצור"</Text>
                <Pressable onPress={() => setActiveTab(0)} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>⚙️ עבור להגדרות</Text>
                </Pressable>
              </View>
            )}

            {/* Question cards */}
            {questions.map((eq, idx) => (
              <QuestionCard
                key={eq.localId}
                question={eq}
                index={idx}
                onSave={() => saveQuestion(eq)}
                onDiscard={() => discardQuestion(eq.localId)}
                onUpdateText={(v) => updateQuestionField(eq.localId, 'questionText', v)}
                onUpdateExplanation={(v) => updateQuestionField(eq.localId, 'explanation', v)}
                onUpdateOptionText={(optId, text) => updateOptionText(eq.localId, optId, text)}
                onSetCorrect={(optId) => setCorrectOption(eq.localId, optId)}
                onToggleImageOnly={(v) => toggleImageOnly(eq.localId, v)}
              />
            ))}

            {/* Save preset */}
            {questions.length === 0 && savedCount > 0 && (
              <View style={styles.section}>
                {!showPresetInput ? (
                  <Pressable onPress={() => setShowPresetInput(true)} style={styles.savePresetBtn}>
                    <Text style={styles.savePresetBtnText}>💾 שמור הגדרות כפריסה</Text>
                  </Pressable>
                ) : (
                  <View style={styles.presetInputRow}>
                    <TextInput
                      style={styles.presetNameInput}
                      value={presetName}
                      onChangeText={setPresetName}
                      placeholder="שם הפריסה..."
                      placeholderTextColor={Colors.textTertiary}
                      textAlign="right"
                    />
                    <Pressable onPress={handleSavePreset} style={styles.presetSaveConfirmBtn}>
                      <Text style={styles.presetSaveConfirmText}>שמור</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowPresetInput(false)} style={styles.presetCancelBtn}>
                      <Text style={styles.presetCancelText}>ביטול</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Tab 2: History */}
      {activeTab === 2 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Presets section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📌 הגדרות שמורות</Text>
            {generationPresets.length === 0 ? (
              <Text style={styles.emptySubtitle}>אין פריסות שמורות עדיין</Text>
            ) : (
              generationPresets.map(p => {
                const tConfig = QUESTION_TYPES.find(t => t.type === p.questionType);
                const tTopic = TOPICS.find(t => t.id === p.topicId);
                return (
                  <View key={p.id} style={styles.historyCard}>
                    <View style={styles.historyCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyCardTitle}>{p.name}</Text>
                        <Text style={styles.historyCardMeta}>
                          {tConfig?.icon} {tConfig?.label} · {tTopic?.icon} {tTopic?.name}
                        </Text>
                      </View>
                      <View style={styles.historyCardBadges}>
                        <View style={[styles.badge, { backgroundColor: difficultyBg(p.difficulty) }]}>
                          <Text style={[styles.badgeText, { color: difficultyColor(p.difficulty) }]}>קושי {p.difficulty}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: Colors.primaryLighter }]}>
                          <Text style={[styles.badgeText, { color: Colors.primary }]}>{p.count} שאלות</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.historyCardActions}>
                      <Pressable
                        onPress={() => { loadPreset(p); setActiveTab(0); }}
                        style={styles.historyLoadBtn}
                      >
                        <Text style={styles.historyLoadBtnText}>📂 טען הגדרות</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert('מחק פריסה', `למחוק "${p.name}"?`, [
                            { text: 'ביטול', style: 'cancel' },
                            { text: 'מחק', style: 'destructive', onPress: () => deleteGenerationPreset(p.id) },
                          ]);
                        }}
                        style={styles.historyDeleteBtn}
                      >
                        <Text style={styles.historyDeleteBtnText}>🗑️</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Sessions section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕐 סשנים אחרונים</Text>
            {generationSessions.length === 0 ? (
              <Text style={styles.emptySubtitle}>אין סשנים עדיין</Text>
            ) : (
              generationSessions.map(s => {
                const tConfig = QUESTION_TYPES.find(t => t.type === s.questionType);
                const savedRatio = s.count > 0 ? s.savedCount / s.count : 0;
                const sessionColor = savedRatio >= 0.6 ? Colors.success : savedRatio >= 0.3 ? Colors.warning : Colors.danger;
                const sessionBg = savedRatio >= 0.6 ? Colors.successLight : savedRatio >= 0.3 ? Colors.warningLight : Colors.dangerLight;
                const date = new Date(s.createdAt);
                const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <View key={s.id} style={[styles.historyCard, { borderRightColor: sessionColor, borderRightWidth: 4 }]}>
                    <View style={styles.historyCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyCardTitle}>{tConfig?.icon} {s.topicName} — {tConfig?.label}</Text>
                        <Text style={styles.historyCardDate}>{dateStr}</Text>
                        {s.customPrompt ? <Text style={styles.historyCardPrompt}>"{s.customPrompt}"</Text> : null}
                      </View>
                      <View style={styles.historyCardBadges}>
                        <View style={[styles.badge, { backgroundColor: difficultyBg(s.difficulty) }]}>
                          <Text style={[styles.badgeText, { color: difficultyColor(s.difficulty) }]}>קושי {s.difficulty}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.sessionStats}>
                      <View style={[styles.sessionStatBadge, { backgroundColor: Colors.successLight }]}>
                        <Text style={[styles.sessionStatText, { color: Colors.success }]}>✅ {s.savedCount} נשמרו</Text>
                      </View>
                      <View style={[styles.sessionStatBadge, { backgroundColor: Colors.dangerLight }]}>
                        <Text style={[styles.sessionStatText, { color: Colors.danger }]}>🗑️ {s.discardedCount} נמחקו</Text>
                      </View>
                      <View style={[styles.sessionStatBadge, { backgroundColor: sessionBg }]}>
                        <Text style={[styles.sessionStatText, { color: sessionColor }]}>{s.count} סה"כ</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Question Card ─────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: EditableQuestion;
  index: number;
  onSave: () => void;
  onDiscard: () => void;
  onUpdateText: (v: string) => void;
  onUpdateExplanation: (v: string) => void;
  onUpdateOptionText: (optId: string, text: string) => void;
  onSetCorrect: (optId: string) => void;
  onToggleImageOnly: (v: boolean) => void;
}

function QuestionCard({ question, index, onSave, onDiscard, onUpdateText, onUpdateExplanation, onUpdateOptionText, onSetCorrect, onToggleImageOnly }: QuestionCardProps) {
  const typeConfig = QUESTION_TYPES.find(t => t.type === question.questionType);

  return (
    <Animated.View style={[styles.qCard, { opacity: question.fadeAnim }]}>
      {/* Card header */}
      <View style={styles.qCardHeader}>
        <Text style={styles.qCardNum}>#{index + 1}</Text>
        <View style={styles.qCardBadges}>
          <View style={[styles.badge, { backgroundColor: Colors.primaryLighter }]}>
            <Text style={[styles.badgeText, { color: Colors.primary }]}>{typeConfig?.icon} {typeConfig?.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: difficultyBg(question.difficulty) }]}>
            <Text style={[styles.badgeText, { color: difficultyColor(question.difficulty) }]}>קושי {question.difficulty}</Text>
          </View>
          {question.mediaUrl && (
            <View style={[styles.badge, { backgroundColor: Colors.warningLight }]}>
              <Text style={[styles.badgeText, { color: Colors.warning }]}>🖼️ תמונה</Text>
            </View>
          )}
        </View>
      </View>

      {/* Question image preview */}
      {question.mediaUrl && (
        <Image
          source={{ uri: question.mediaUrl }}
          style={styles.qImagePreview}
          resizeMode="contain"
        />
      )}

      {/* Image-only toggle */}
      <View style={styles.qImageOnlyRow}>
        <Text style={styles.qImageOnlyLabel}>שאלת תמונה בלבד</Text>
        <Switch
          value={!!question.imageOnly}
          onValueChange={onToggleImageOnly}
          trackColor={{ true: Colors.primary, false: Colors.border }}
        />
      </View>

      {/* Question text */}
      <TextInput
        style={[styles.qTextInput, { writingDirection: detectDir(question.questionText) }]}
        value={question.questionText}
        onChangeText={onUpdateText}
        multiline
        textAlign={ta(question.questionText)}
        textAlignVertical="top"
      />

      {/* Options */}
      <View style={styles.qOptions}>
        {question.options.map(opt => {
          const optDir = detectDir(opt.text);
          return (
          <View key={opt.id} style={[styles.qOptionRow, { flexDirection: optDir === 'rtl' ? 'row-reverse' : 'row' }, opt.isCorrect && styles.qOptionCorrect]}>
            <Pressable onPress={() => onSetCorrect(opt.id)} style={styles.qRadio}>
              <View style={[styles.qRadioInner, opt.isCorrect && styles.qRadioCorrect]} />
            </Pressable>
            <TextInput
              style={[styles.qOptionInput, opt.isCorrect && { color: Colors.success }, { writingDirection: optDir }]}
              value={opt.text}
              onChangeText={(t) => onUpdateOptionText(opt.id, t)}
              textAlign={ta(opt.text)}
            />
            <Text style={styles.qOptionId}>{opt.id.toUpperCase()}</Text>
          </View>
          );
        })}
      </View>

      {/* Explanation */}
      <View style={styles.qExplanationBox}>
        <Text style={styles.qExplanationLabel}>💡 הסבר:</Text>
        <TextInput
          style={[styles.qExplanationInput, { writingDirection: detectDir(question.explanation) }]}
          value={question.explanation}
          onChangeText={onUpdateExplanation}
          multiline
          textAlign={ta(question.explanation)}
          textAlignVertical="top"
        />
      </View>

      {/* Actions */}
      <View style={styles.qActions}>
        <Pressable onPress={onDiscard} style={styles.discardBtn}>
          <Text style={styles.discardBtnText}>🗑️ מחק</Text>
        </Pressable>
        <Pressable onPress={onSave} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>💾 שמור שאלה</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 48 },

  // Header
  header: { paddingTop: 12, paddingBottom: 0, paddingHorizontal: Spacing.base },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  backBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  backBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  // Tabs
  tabRow: { flexDirection: 'row-reverse', gap: 4, paddingBottom: 0 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#fff' },
  tabText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: '#fff', fontFamily: FontFamily.bold },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right', marginBottom: 10 },

  // Mode chips
  modeRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  modeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  modeChipTextActive: { color: '#fff', fontFamily: FontFamily.bold },

  // Type grid
  typeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  typeCell: {
    width: '47%', paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: Radius.lg, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', flexDirection: 'row-reverse', gap: 8,
    ...Shadow.sm,
  },
  typeCellActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLighter },
  typeCellIcon: { fontSize: 20 },
  typeCellLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  typeCellLabelActive: { color: Colors.primary, fontFamily: FontFamily.bold },

  // Topic scroll
  topicScroll: { paddingVertical: 4, gap: 8, flexDirection: 'row-reverse' },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1.5, borderColor: Colors.border,
  },
  topicChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  // Difficulty
  diffRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  diffDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  diffDotText: { fontFamily: FontFamily.bold, fontSize: 12 },

  // Count
  countRow: { flexDirection: 'row-reverse', gap: 8 },
  countBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  countBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  countBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textSecondary },

  // Prompt / passage
  promptInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: 70, textAlignVertical: 'top',
  },

  // Presets chips
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.lg, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border, marginRight: 8,
    ...Shadow.sm,
  },
  presetChipName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  presetChipMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  // Generate button
  generateBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary, marginTop: 8 },
  generateBtnGrad: { padding: 18, alignItems: 'center' },
  generateBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff', textAlign: 'center' },

  // Results header bar
  resultsHeaderBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  resultsHeaderTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  resultHeaderBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.lg, borderWidth: 1 },
  resultHeaderBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  // Loading / empty states
  loadingState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  loadingSubtext: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.text },
  emptySubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },

  // Question card
  qCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.md,
  },
  qCardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  qCardNum: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.primary },
  qCardBadges: { flexDirection: 'row-reverse', gap: 6 },

  qImagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: Colors.surfaceSecondary,
  },
  qImageOnlyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  qImageOnlyLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  qTextInput: {
    fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.text,
    textAlign: 'right', lineHeight: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 8, marginBottom: 12,
  },

  qOptions: { gap: 6, marginBottom: 12 },
  qOptionRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.surfaceSecondary, gap: 8,
  },
  qOptionCorrect: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  qRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qRadioInner: { width: 10, height: 10, borderRadius: 5 },
  qRadioCorrect: { backgroundColor: Colors.success },
  qOptionInput: {
    flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.text, textAlign: 'right',
  },
  qOptionId: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textTertiary, width: 18, textAlign: 'center' },

  qExplanationBox: {
    backgroundColor: Colors.primaryLighter, borderRadius: Radius.lg,
    padding: 10, marginBottom: 12,
  },
  qExplanationLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', marginBottom: 4 },
  qExplanationInput: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.text,
    textAlign: 'right', lineHeight: 18,
  },

  qActions: { flexDirection: 'row-reverse', gap: 8 },
  discardBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.lg, backgroundColor: Colors.dangerLight,
    borderWidth: 1, borderColor: Colors.danger,
  },
  discardBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.danger },
  saveBtn: {
    flex: 1, paddingVertical: 9, borderRadius: Radius.lg,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  // History cards
  historyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.sm,
  },
  historyCardRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  historyCardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text, textAlign: 'right' },
  historyCardMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 3 },
  historyCardDate: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 3 },
  historyCardPrompt: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 3, fontStyle: 'italic' },
  historyCardBadges: { gap: 4, alignItems: 'flex-end' },
  historyCardActions: { flexDirection: 'row-reverse', gap: 8 },
  historyLoadBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLighter, borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center',
  },
  historyLoadBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  historyDeleteBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.lg, backgroundColor: Colors.dangerLight,
    borderWidth: 1, borderColor: Colors.danger,
  },
  historyDeleteBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.danger },

  // Session stats
  sessionStats: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  sessionStatBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  sessionStatText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  // Save preset
  savePresetBtn: {
    padding: 14, borderRadius: Radius.lg, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: Colors.primary,
    alignItems: 'center',
  },
  savePresetBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },
  presetInputRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  presetNameInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 10, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text,
  },
  presetSaveConfirmBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  presetSaveConfirmText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  presetCancelBtn: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  presetCancelText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
});
