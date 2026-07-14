const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function setCorrect(options, correctId) {
  return (options ?? []).map(option => ({
    ...option,
    isCorrect: option.id === correctId,
  }));
}

function replaceOptionText(options, id, newText) {
  return (options ?? []).map(option => option.id === id ? { ...option, text: newText } : option);
}

function updateOption(options, id, patch) {
  return (options ?? []).map(option => option.id === id ? { ...option, ...patch } : option);
}

function fixedManualRows(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const fixes = {
    q_logic_002: {
      reason: 'השאלה כוללת אדם חמישי שאין עליו מידע, ולכן אי אפשר לקבוע בוודאות מי הנמוך ביותר.',
      update: {
        question_text: 'בקבוצה יש 5 אנשים: אסף, ברק, גלית, דנה והדר. אסף גבוה מברק. גלית נמוכה מדנה. ברק גבוה מגלית. מי הנמוך ביותר?',
        correct_answer: 'd',
        options: setCorrect(options, 'd'),
        explanation: 'אין מספיק מידע על הדר, ולכן אי אפשר לדעת מי הנמוך ביותר בקבוצה כולה. ניתן להסיק רק שאסף גבוה מברק, שברק גבוה מגלית, ושדנה גבוהה מגלית.',
      },
    },
    q_logic_008: {
      reason: 'סדר הישיבה בהסבר סתר את הנתון "ג יושב משמאל לד"; ג חייב להיות הכי שמאלה.',
      update: {
        correct_answer: 'c',
        options: setCorrect(options, 'c'),
        explanation: 'א מימין לב, ולכן ב נמצא משמאל לא. ב מימין לג, ולכן ג נמצא משמאל לב. בנוסף ג משמאל לד. לכן ג נמצא משמאל לכל האחרים והוא היושב הכי שמאלה.',
      },
    },
    q_logic_011: {
      reason: 'עוזי מבוגר מטלי, אך לא נתון אם הוא מבוגר או צעיר מריבה ומשמעון; לכן המקום השני בגיל אינו נקבע.',
      update: {
        correct_answer: 'd',
        options: setCorrect(updateOption(options, 'd', { text: 'אי אפשר לדעת' }), 'd'),
        explanation: 'מהנתונים ידוע שריבה מבוגרת משמעון, שמעון מבוגר מטלי, ויולנד הצעיר מכולם. על עוזי ידוע רק שהוא מבוגר מטלי, אך לא ידוע יחסו לריבה ולשמעון. לכן אי אפשר לקבוע בוודאות מי השני בגיל.',
      },
    },
    q_logic_019: {
      reason: 'המתחרה ה אינו מוגבל, ולכן האחרון יכול להיות ה או ג בהתאם לסידור; לא ניתן לקבוע בוודאות.',
      update: {
        correct_answer: 'd',
        options: setCorrect(updateOption(options, 'd', { text: 'אי אפשר לדעת' }), 'd'),
        explanation: 'ד מסיים ראשון. א חייב להיות לפני ב, וב חייב להיות מיד לפני ג, אך ה אינו כפוף לאילוץ כלשהו. לכן ייתכן שהסדר יסתיים בג, וייתכן שהסדר יסתיים בה. אין מספיק מידע לקבוע מי אחרון בוודאות.',
      },
    },
    q_logic_021: {
      reason: 'האפשרות "צנחת" אינה ניסוח תקין לחריג; תוקן ל"מצנח" כדי שהחריג יהיה ברור.',
      update: {
        question_text: 'מצא את החריג: כלבת, שפעת, אדמת, דלקת, מצנח',
        options: updateOption(options, 'd', { text: 'מצנח' }),
        explanation: 'כלבת, שפעת, אדמת ודלקת הן מחלות או מצבים רפואיים. מצנח הוא חפץ, ולכן הוא החריג.',
      },
    },
    q_logic_023: {
      reason: 'לפי התנאי, אם B לא מגישה אז A זוכה. C תמיד מגישה ולכן B לא מגישה, ומכאן A זוכה.',
      update: {
        correct_answer: 'a',
        options: setCorrect(options, 'a'),
        explanation: 'C תמיד מגישה, ולכן התנאי של B להגשה אינו מתקיים: B מגישה רק אם C לא מגישה. מכאן ש-B לא מגישה. לפי הנתון A זוכה בתנאי ש-B לא מגישה הצעה, ולכן A היא הזוכה.',
      },
    },
    q_logic_033: {
      reason: 'תוקן ניסוח עברי שגוי: "ישורתו" -> "יקבלו שירות".',
      update: {
        question_text: 'בחנות יש 5 מוכרים. כל מוכר מוכר ל-3 לקוחות ביום. אחד המוכרים חלה. כמה לקוחות פחות יקבלו שירות ביום?',
        explanation: 'מוכר אחד חלה, וכל מוכר משרת 3 לקוחות ביום. לכן 3 לקוחות פחות יקבלו שירות באותו יום.',
      },
    },
    q_logic_036: {
      reason: 'זהו כפיל של שאלת הישיבה; גם כאן ג חייב להיות הכי שמאלה ולא ד.',
      update: {
        correct_answer: 'c',
        options: setCorrect(options, 'c'),
        explanation: 'א מימין לב, ולכן ב נמצא משמאל לא. ב מימין לג, ולכן ג נמצא משמאל לב. בנוסף ג משמאל לד. לכן ג נמצא משמאל לכל האחרים והוא היושב הכי שמאלה.',
      },
    },
    q_logic_039: {
      reason: 'זהו כפיל של שאלת הגילים; עוזי אינו ממוקם ביחס לריבה ושמעון ולכן אין תשובה ודאית.',
      update: {
        correct_answer: 'd',
        options: setCorrect(updateOption(options, 'd', { text: 'אי אפשר לדעת' }), 'd'),
        explanation: 'מהנתונים ידוע שריבה מבוגרת משמעון, שמעון מבוגר מטלי, ויולנד הצעיר מכולם. על עוזי ידוע רק שהוא מבוגר מטלי, אך לא ידוע יחסו לריבה ולשמעון. לכן אי אפשר לקבוע בוודאות מי השני בגיל.',
      },
    },
    q_logic_047: {
      reason: 'זהו כפיל של שאלת התחרות; ה אינו מוגבל ולכן לא ניתן לדעת מי אחרון.',
      update: {
        correct_answer: 'd',
        options: setCorrect(updateOption(options, 'd', { text: 'אי אפשר לדעת' }), 'd'),
        explanation: 'ד מסיים ראשון. א חייב להיות לפני ב, וב חייב להיות מיד לפני ג, אך ה אינו כפוף לאילוץ כלשהו. לכן ייתכן שהסדר יסתיים בג, וייתכן שהסדר יסתיים בה. אין מספיק מידע לקבוע מי אחרון בוודאות.',
      },
    },
    q_logic_049: {
      reason: 'זהו כפיל של שאלת החריג; תוקן ל"מצנח" כדי שהחריג יהיה חד-משמעי.',
      update: {
        question_text: 'מצא את החריג: כלבת, שפעת, אדמת, דלקת, מצנח',
        options: updateOption(options, 'd', { text: 'מצנח' }),
        explanation: 'כלבת, שפעת, אדמת ודלקת הן מחלות או מצבים רפואיים. מצנח הוא חפץ, ולכן הוא החריג.',
      },
    },
    q_logic_051: {
      reason: 'זהו כפיל של שאלת A/B/C; התשובה הנובעת מהתנאים היא A ולא C.',
      update: {
        correct_answer: 'a',
        options: setCorrect(options, 'a'),
        explanation: 'C תמיד מגישה, ולכן התנאי של B להגשה אינו מתקיים: B מגישה רק אם C לא מגישה. מכאן ש-B לא מגישה. לפי הנתון A זוכה בתנאי ש-B לא מגישה הצעה, ולכן A היא הזוכה.',
      },
    },
    q_logic_061: {
      reason: 'זהו כפיל של שאלת המוכרים; תוקן ניסוח עברי שגוי.',
      update: {
        question_text: 'בחנות יש 5 מוכרים. כל מוכר מוכר ל-3 לקוחות ביום. אחד המוכרים חלה. כמה לקוחות פחות יקבלו שירות ביום?',
        explanation: 'מוכר אחד חלה, וכל מוכר משרת 3 לקוחות ביום. לכן 3 לקוחות פחות יקבלו שירות באותו יום.',
      },
    },
    q_exp_logic_deduction_117: {
      reason: 'דנה אינה יכולה להיות האמצע: היא יושבת מימין גם ליואב וגם לרוני. מי שבאמצע אינו נקבע.',
      update: {
        correct_answer: 'b',
        options: setCorrect(options, 'b'),
        explanation: 'דנה יושבת מימין ליואב, ורוני יושב משמאל לדנה. לכן דנה נמצאת מימין לשניהם, אך לא ידוע אם יואב נמצא משמאל לרוני או להפך. האמצע יכול להיות יואב או רוני, ולכן אין מסקנה חד-משמעית.',
      },
    },
    q_exp_logic_series_009: {
      reason: 'הדפוס הוא חיסור חזקות של 2: 2, 4, 8, 16, ולכן ההמשך הוא חיסור 32. התשובה 30 הייתה שגויה.',
      update: {
        correct_answer: 'a',
        options: setCorrect(updateOption(options, 'a', { text: '-2' }), 'a'),
        explanation: 'מחסרים בכל פעם חזקה עוקבת של 2: 60-2=58, 58-4=54, 54-8=46, 46-16=30. ההפרש הבא הוא 32, ולכן 30-32=-2.',
      },
    },
    q_pro_spatial_69564ba92ef39aa110626958: {
      reason: 'החריג הגיאומטרי הוא טרפז: ריבוע, מלבן ומקבילית הם מקרים של מרובעים עם שני זוגות צלעות נגדיות מקבילות.',
      update: {
        correct_answer: '4',
        options: setCorrect(options, '4'),
        explanation: 'התשובה הנכונה היא טרפז. ריבוע, מלבן ומקבילית הם כולם מרובעים שבהם יש שני זוגות של צלעות נגדיות מקבילות. טרפז, לפי ההגדרה המקובלת, כולל רק זוג אחד של צלעות מקבילות, ולכן הוא החריג מבין האפשרויות.',
      },
    },
  };

  return fixes[question.id] ?? null;
}

function percentApproxFix(question) {
  const qText = text(question.question_text);
  if (!qText.includes('%') || qText.includes('בקירוב')) return null;
  const match = qText.match(/(\d+(?:\.\d+)?)%\D+(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (!match) return null;
  const percent = Number(match[1]);
  const base = Number(match[2].replace(/,/g, ''));
  const expected = (percent / 100) * base;
  if (Number.isInteger(expected)) return null;

  const options = Array.isArray(question.options) ? question.options : [];
  const correctOption = options.find(option => option.isCorrect);
  const correctNumber = Number(text(correctOption?.text));
  if (!Number.isFinite(correctNumber)) return null;
  if (correctNumber !== Math.round(expected)) return null;

  return {
    reason: `התוצאה המדויקת היא ${expected}, אך האפשרויות מעוגלות; לכן השאלה חייבת לציין "בקירוב".`,
    update: {
      question_text: qText.replace(/\?$/, ' בקירוב?'),
      explanation: `${percent}% מתוך ${base} הם ${base} כפול ${percent / 100}, כלומר ${expected}. מאחר שהתשובות מעוגלות, הערך הקרוב ביותר הוא ${correctNumber}.`,
    },
  };
}

async function fetchAllQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, topic_id, question_text, options, correct_answer, explanation')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  const results = [];

  for (const question of questions) {
    const fix = fixedManualRows(question) ?? percentApproxFix(question);
    if (!fix) continue;
    const { data, error } = await supabase
      .from('questions')
      .update(fix.update)
      .eq('id', question.id)
      .select('id, topic_id, question_text, correct_answer, explanation, options');
    results.push({
      id: question.id,
      topicId: question.topic_id,
      ok: !error,
      reason: fix.reason,
      updatedRows: data?.length ?? 0,
      error: error?.message,
      before: {
        questionText: text(question.question_text),
        correctAnswer: question.correct_answer,
        correctText: text((question.options ?? []).find(option => option.isCorrect)?.text),
        explanation: text(question.explanation),
      },
      after: data?.[0] ? {
        questionText: text(data[0].question_text),
        correctAnswer: data[0].correct_answer,
        correctText: text((data[0].options ?? []).find(option => option.isCorrect)?.text),
        explanation: text(data[0].explanation),
      } : null,
    });
    if (error) throw error;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    fixedAt: new Date().toISOString(),
    scanned: questions.length,
    fixedCount: results.filter(result => result.ok && result.updatedRows > 0).length,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'semantic-question-fixes-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
