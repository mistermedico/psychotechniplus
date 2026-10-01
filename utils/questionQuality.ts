import { Question, QuestionType } from '../data/types';
import { imageTitleMismatch } from './svgTitle';

export function auditPsychotechnicQuestion(
  q: Pick<Question, 'questionText' | 'targetIds' | 'topicId' | 'questionType' | 'options' | 'correctAnswer' | 'explanation' | 'difficulty' | 'mediaUrl'>
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
  const options = Array.isArray(q.options) ? q.options : [];
  const cleanOptions = options.filter(o => String(o?.text ?? '').trim() || o?.imageUrl);
  const correctOptions = cleanOptions.filter(o => o.isCorrect);
  const optionTexts = cleanOptions.map(o => String(o.text ?? '').trim()).filter(Boolean);
  const uniqueOptionTexts = new Set(optionTexts);
  const optionIds = options.map(o => String(o?.id ?? ''));
  const questionText = String(q.questionText ?? '').trim();
  const explanation = String(q.explanation ?? '').trim();

  if (!questionText || questionText.length < 8) issues.push('טקסט השאלה קצר מדי או חסר.');
  if (!q.topicId) issues.push('חסר נושא פסיכוטכני.');
  if (!q.targetIds?.length) issues.push('חסר מסלול/מבחן יעד.');
  if (!allowedTypes.includes(q.questionType)) issues.push('סוג השאלה אינו מתאים למבחן פסיכוטכני.');
  if (q.difficulty < 1 || q.difficulty > 10) issues.push('רמת הקושי חייבת להיות בין 1 ל-10.');
  if (cleanOptions.length < 2) issues.push('חייבות להיות לפחות שתי אפשרויות תשובה.');
  if (uniqueOptionTexts.size !== optionTexts.length) issues.push('יש אפשרויות תשובה כפולות.');
  if (optionIds.some(id => !id) || new Set(optionIds).size !== optionIds.length) issues.push('מזהי אפשרויות כפולים');
  if (correctOptions.length !== 1) issues.push('חייבת להיות תשובה נכונה אחת בלבד.');
  if (correctOptions.length === 1 && q.correctAnswer !== correctOptions[0].id) issues.push('שדה התשובה הנכונה לא תואם לאפשרות המסומנת.');
  if (!explanation || explanation.length < 25) issues.push('חסר הסבר מקיף מספיק למשתמש.');
  const mismatchedTitle = imageTitleMismatch(q.questionText, q.mediaUrl);
  if (mismatchedTitle) issues.push(`התמונה מציגה שאלה אחרת ("${mismatchedTitle}") מזו שבטקסט.`);
  const optionImages = cleanOptions.map(o => o.imageUrl).filter(Boolean) as string[];
  if (new Set(optionImages).size !== optionImages.length) issues.push('יש תמונות תשובה זהות.');
  if (q.questionType === 'shapes') {
    if (!q.mediaUrl) issues.push('שאלת צורות/מרחב חייבת לכלול תמונה מרכזית לשאלה.');
    if (!cleanOptions.every(o => !!o.imageUrl)) issues.push('בשאלת צורות/מרחב לכל תשובה חייבת להיות תמונה.');
  }

  return issues;
}

export function isPsychotechnicQuestionReady(q: Parameters<typeof auditPsychotechnicQuestion>[0]): boolean {
  return auditPsychotechnicQuestion(q).length === 0;
}
