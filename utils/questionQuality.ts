import { Question, QuestionType } from '../data/types';

export function auditPsychotechnicQuestion(
  q: Pick<Question, 'questionText' | 'targetIds' | 'topicId' | 'questionType' | 'options' | 'correctAnswer' | 'explanation' | 'difficulty'>
): string[] {
  const issues: string[] = [];
  const allowedTypes: QuestionType[] = [
    'multiple_choice',
    'verbal',
    'logic',
    'quantitative',
    'shapes',
    'reading_comprehension',
    'true_false',
    'fill_in_the_blank',
  ];
  const cleanOptions = q.options.filter(o => o.text.trim() || o.imageUrl);
  const correctOptions = cleanOptions.filter(o => o.isCorrect);
  const optionTexts = cleanOptions.map(o => o.text.trim()).filter(Boolean);
  const uniqueOptionTexts = new Set(optionTexts);

  if (!q.questionText.trim() || q.questionText.trim().length < 8) issues.push('טקסט השאלה קצר מדי או חסר.');
  if (!q.topicId) issues.push('חסר נושא פסיכוטכני.');
  if (!q.targetIds.length) issues.push('חסר מסלול/מבחן יעד.');
  if (!allowedTypes.includes(q.questionType)) issues.push('סוג השאלה אינו מתאים למבחן פסיכוטכני.');
  if (q.difficulty < 1 || q.difficulty > 10) issues.push('רמת הקושי חייבת להיות בין 1 ל-10.');
  if (cleanOptions.length < 2) issues.push('חייבות להיות לפחות שתי אפשרויות תשובה.');
  if (uniqueOptionTexts.size !== optionTexts.length) issues.push('יש אפשרויות תשובה כפולות.');
  if (correctOptions.length !== 1) issues.push('חייבת להיות תשובה נכונה אחת בלבד.');
  if (correctOptions.length === 1 && q.correctAnswer !== correctOptions[0].id) issues.push('שדה התשובה הנכונה לא תואם לאפשרות המסומנת.');
  if (!q.explanation.trim() || q.explanation.trim().length < 25) issues.push('חסר הסבר מקיף מספיק למשתמש.');

  return issues;
}

export function isPsychotechnicQuestionReady(q: Parameters<typeof auditPsychotechnicQuestion>[0]): boolean {
  return auditPsychotechnicQuestion(q).length === 0;
}
