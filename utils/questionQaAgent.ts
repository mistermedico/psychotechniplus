import { Question } from '../data/types';
import { SessionRecord } from '../lib/db';
import { ensureSpatialVisualAssets } from './spatialVisualAssets';

export type QuestionQaSeverity = 'critical' | 'warning' | 'info';

export interface QuestionPerformanceStats {
  attempts: number;
  correct: number;
  skipped: number;
  accuracy: number | null;
  skipRate: number | null;
  lastAnsweredAt?: string;
}

export interface QuestionQaIssue {
  id: string;
  severity: QuestionQaSeverity;
  title: string;
  detail: string;
}

export interface QuestionQaFinding {
  question: Question;
  issues: QuestionQaIssue[];
  stats: QuestionPerformanceStats;
  suggestedQuestion: Question;
  suggestedSummary: string;
}

const MIN_EXPLANATION_LENGTH = 48;
const HIGH_ATTEMPT_THRESHOLD = 10;

export function buildQuestionPerformanceMap(sessions: SessionRecord[]): Record<string, QuestionPerformanceStats> {
  const map: Record<string, QuestionPerformanceStats> = {};

  sessions.forEach(session => {
    session.answers.forEach(answer => {
      const current = map[answer.questionId] ?? {
        attempts: 0,
        correct: 0,
        skipped: 0,
        accuracy: null,
        skipRate: null,
      };
      current.attempts += 1;
      if (answer.isCorrect) current.correct += 1;
      if (answer.isSkipped) current.skipped += 1;
      if (!current.lastAnsweredAt || session.completedAt > current.lastAnsweredAt) {
        current.lastAnsweredAt = session.completedAt;
      }
      map[answer.questionId] = current;
    });
  });

  Object.values(map).forEach(row => {
    row.accuracy = row.attempts > 0 ? Math.round((row.correct / row.attempts) * 100) : null;
    row.skipRate = row.attempts > 0 ? Math.round((row.skipped / row.attempts) * 100) : null;
  });

  return map;
}

export function getQuestionVisibilityLabel(question: Question) {
  if (question.validationStatus !== 'validated') return 'לא מוצגת למשתמשים';
  if (!question.generalPracticeEligible && !question.smartPracticeEligible) return 'מאומתת אך לא מוצגת';
  if (question.accessLevel === 'premium') return 'מוצגת לפרימיום בלבד';
  if (question.generalPracticeEligible && question.smartPracticeEligible) return 'מוצגת לכולם בתרגול ובמבחנים';
  if (question.generalPracticeEligible) return 'מוצגת לכולם בתרגול';
  return 'מוצגת במבחנים חכמים';
}

export function analyzeQuestion(question: Question, stats?: QuestionPerformanceStats): QuestionQaFinding | null {
  const issues: QuestionQaIssue[] = [];
  let suggestedQuestion: Question = question;
  const correctOptions = question.options.filter(option => option.isCorrect);
  const correctById = question.options.find(option => option.id === question.correctAnswer);
  const correctByText = question.options.find(option => option.text === question.correctAnswer);
  const resolvedCorrect = correctById ?? correctByText ?? correctOptions[0] ?? question.options[0];
  const correctText = resolvedCorrect?.text?.trim() ?? '';

  if (question.options.length !== 4) {
    issues.push({
      id: 'option_count',
      severity: 'critical',
      title: 'מספר תשובות לא תקין',
      detail: `לשאלה יש ${question.options.length} אפשרויות במקום 4.`,
    });
  }

  if (correctOptions.length !== 1 || (!correctById && !correctByText)) {
    issues.push({
      id: 'correct_answer',
      severity: 'critical',
      title: 'סימון תשובה לא חד-משמעי',
      detail: 'נמצאה בעיה בהתאמה בין correctAnswer לבין האפשרות המסומנת כנכונה.',
    });
    suggestedQuestion = {
      ...suggestedQuestion,
      correctAnswer: resolvedCorrect?.id ?? 'a',
      options: suggestedQuestion.options.map(option => ({
        ...option,
        isCorrect: option.id === (resolvedCorrect?.id ?? 'a'),
      })),
    };
  }

  const seen = new Set<string>();
  const duplicateTexts = question.options
    .map(option => option.text.trim())
    .filter((text, index, arr) => text && arr.indexOf(text) !== index);
  if (duplicateTexts.length > 0) {
    issues.push({
      id: 'duplicate_options',
      severity: 'critical',
      title: 'מסיחים כפולים',
      detail: 'יש תשובות עם אותו נוסח, מה שעלול ליצור יותר מתשובה אחת שנראית נכונה.',
    });
    suggestedQuestion = {
      ...suggestedQuestion,
      options: suggestedQuestion.options.map((option, index) => {
        let text = option.text.trim() || `אפשרות ${index + 1}`;
        if (seen.has(text)) text = `${text} - מסיח ${index + 1}`;
        seen.add(text);
        return { ...option, text };
      }),
    };
  }

  const explanation = question.explanation?.trim() ?? '';
  if (explanation.length < MIN_EXPLANATION_LENGTH || (correctText && !explanation.includes(correctText))) {
    issues.push({
      id: 'weak_explanation',
      severity: 'warning',
      title: 'הסבר חלש או לא מחובר לתשובה',
      detail: 'ההסבר קצר מדי או לא מזכיר במפורש את התשובה הנכונה.',
    });
    suggestedQuestion = {
      ...suggestedQuestion,
      explanation: buildImprovedExplanation(question, correctText),
    };
  }

  if (question.validationStatus === 'validated' && !question.generalPracticeEligible && !question.smartPracticeEligible) {
    issues.push({
      id: 'hidden_validated',
      severity: 'warning',
      title: 'שאלה מאומתת שאינה מוצגת',
      detail: 'השאלה מאושרת אבל אינה משויכת לתרגול כללי או למבחנים חכמים.',
    });
    suggestedQuestion = {
      ...suggestedQuestion,
      generalPracticeEligible: true,
      smartPracticeEligible: true,
    };
  }

  if (question.difficulty < 1 || question.difficulty > 10) {
    issues.push({
      id: 'difficulty_range',
      severity: 'critical',
      title: 'רמת קושי מחוץ לטווח',
      detail: 'רמת הקושי חייבת להיות בין 1 ל-10.',
    });
    suggestedQuestion = {
      ...suggestedQuestion,
      difficulty: Math.max(1, Math.min(10, question.difficulty)),
    };
  }

  if (stats && stats.attempts >= HIGH_ATTEMPT_THRESHOLD && stats.accuracy !== null) {
    if (stats.accuracy <= 18) {
      issues.push({
        id: 'very_low_accuracy',
        severity: 'warning',
        title: 'אחוז מענה נכון חריג נמוך',
        detail: `${stats.accuracy}% בלבד מתוך ${stats.attempts} ניסיונות. כדאי לבדוק ניסוח, מסיחים או מפתח תשובה.`,
      });
      suggestedQuestion = {
        ...suggestedQuestion,
        validationStatus: 'pending',
        smartPracticeEligible: false,
        generalPracticeEligible: false,
      };
    } else if (stats.accuracy >= 92 && question.difficulty > 2) {
      issues.push({
        id: 'very_high_accuracy',
        severity: 'info',
        title: 'השאלה קלה ביחס לקושי',
        detail: `${stats.accuracy}% הצלחה מתוך ${stats.attempts} ניסיונות.`,
      });
      suggestedQuestion = {
        ...suggestedQuestion,
        difficulty: Math.max(1, question.difficulty - 1),
      };
    }
  }

  if (question.questionType === 'shapes' || question.topicId === 'topic_spatial') {
    const hasMissingVisual = !question.mediaUrl || question.options.some(option => !option.imageUrl);
    if (hasMissingVisual) {
      issues.push({
        id: 'spatial_visuals',
        severity: 'critical',
        title: 'שאלת צורה בלי תמונות מלאות',
        detail: 'שאלת חשיבה מרחבית חייבת תמונה לשאלה ולכל מסיח.',
      });
      suggestedQuestion = ensureSpatialVisualAssets(suggestedQuestion);
    }
  }

  if (issues.length === 0) return null;

  return {
    question,
    issues,
    stats: stats ?? { attempts: 0, correct: 0, skipped: 0, accuracy: null, skipRate: null },
    suggestedQuestion,
    suggestedSummary: summarizeSuggestion(question, suggestedQuestion, issues),
  };
}

export function analyzeQuestionBank(questions: Question[], sessions: SessionRecord[]): QuestionQaFinding[] {
  const statsMap = buildQuestionPerformanceMap(sessions);
  return questions
    .map(question => analyzeQuestion(question, statsMap[question.id]))
    .filter((finding): finding is QuestionQaFinding => Boolean(finding))
    .sort((a, b) => severityScore(b) - severityScore(a) || b.stats.attempts - a.stats.attempts);
}

function severityScore(finding: QuestionQaFinding) {
  return finding.issues.reduce((score, issue) => {
    if (issue.severity === 'critical') return score + 100;
    if (issue.severity === 'warning') return score + 20;
    return score + 5;
  }, 0);
}

function buildImprovedExplanation(question: Question, correctText: string) {
  const base = question.explanation?.trim();
  const typeReason =
    question.questionType === 'quantitative'
      ? 'יש לבצע את החישוב לפי הנתונים בלבד ולפסול מסיחים שאינם מתקבלים מאותו חישוב.'
      : question.questionType === 'logic'
      ? 'יש לזהות את הכלל הלוגי המחייב ולא להסיק מידע שלא נאמר במפורש.'
      : question.questionType === 'shapes'
      ? 'יש להשוות את כיוון הצורה, מספר הפרטים, הסימן הפנימי והצבעים ביחס לדגם.'
      : 'יש לקרוא את ניסוח השאלה במדויק ולבחור רק תשובה שתואמת את המשמעות המבוקשת.';
  const answerPart = correctText
    ? ` לכן התשובה הנכונה היא "${correctText}", והיא היחידה שמתאימה לכל הנתונים בשאלה.`
    : ' לכן יש לבחור באפשרות היחידה שתואמת את כל תנאי השאלה.';
  if (base && base.length >= MIN_EXPLANATION_LENGTH) return `${base}${base.includes(correctText) ? '' : answerPart}`;
  return `${typeReason}${answerPart}`;
}

function summarizeSuggestion(original: Question, suggested: Question, issues: QuestionQaIssue[]) {
  const parts: string[] = [];
  if (original.correctAnswer !== suggested.correctAnswer) parts.push('תיקון מפתח תשובה');
  if (original.explanation !== suggested.explanation) parts.push('שיפור הסבר');
  if (original.difficulty !== suggested.difficulty) parts.push(`עדכון קושי ל-${suggested.difficulty}`);
  if (original.validationStatus !== suggested.validationStatus) parts.push('העברה לבדיקה מחדש');
  if (original.generalPracticeEligible !== suggested.generalPracticeEligible || original.smartPracticeEligible !== suggested.smartPracticeEligible) {
    parts.push('תיקון סטטוס הצגה');
  }
  if (parts.length === 0 && issues.some(issue => issue.id === 'spatial_visuals')) parts.push('השלמת תמונות לשאלת צורה');
  return parts.length > 0 ? parts.join(' · ') : 'סימון לבדיקה ידנית';
}
