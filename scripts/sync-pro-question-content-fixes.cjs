const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const sourceRoot = 'C:\\Users\\nitai\\Documents\\Codex\\2026-06-27\\new-chat';
const outputPath = path.join(sourceRoot, 'outputs', 'synced-pro-question-content-fixes.json');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(appRoot, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function loadSourceQuestions() {
  const all = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'work', 'psychotechnipro-all-questions.json'), 'utf8'));
  const spatial = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'work', 'psychotechnipro-spatial-questions.json'), 'utf8'));
  const byId = new Map();
  for (const question of [...all, ...spatial]) {
    if (!question?.id) continue;
    const existing = byId.get(question.id);
    const existingText = existing ? sourceQuestionText(existing) : '';
    const nextText = sourceQuestionText(question);
    if (!existing || (!existingText && nextText)) {
      byId.set(question.id, question);
    }
  }
  return byId;
}

const reviewedSpatialExplanations = {
  q_pro_spatial_6967edbdcd855b2ccd4ea625:
    'התשובה הנכונה היא 2. בדוגמה רואים שהצורה המלאה הופכת לאותה צורה בדיוק אך בקו מתאר, בלי לשנות את סוג הצורה. לכן כאשר מפעילים את אותו כלל על המשולש המלא, התוצאה צריכה להיות משולש ריק בקו מתאר. רק אפשרות 2 שומרת על צורת המשולש ומחליפה את המילוי לקו מתאר.',
  q_pro_spatial_6967f110760db98663c49e77:
    'התשובה הנכונה היא 2. בצמד הראשון העיגול המלא הופך לעיגול ריק, כלומר הכלל הוא שמירה על הצורה והסרת המילוי. כאשר מחילים את אותו כלל על המשולש המלא, מתקבל משולש ריק בקו מתאר. אפשרות 2 היא היחידה שמציגה את אותה צורה ללא מילוי.',
  q_pro_spatial_6967f83846aa4181dbac0b45:
    'התשובה הנכונה היא 2. המעבר בדוגמה שומר על סוג הצורה ועל הכיוון שלה, אך מחליף צורה מלאה לצורה ריקה בקו מתאר. לכן הריבוע המלא צריך להפוך לריבוע ריק. אפשרות 2 היא היחידה ששומרת על ריבוע ומסירה רק את המילוי.',
  q_pro_spatial_6967fdeafd36a5f5e27351d4:
    'התשובה הנכונה היא 3. בדוגמה הצורה החיצונית נשמרת, אך הופכת למלאה, והצורה הפנימית נשארת במרכז כצורה בהירה/ריקה. לכן במקרה של משולש שבתוכו ריבוע, יש לבחור משולש מלא שבתוכו ריבוע קטן ובהיר. רק אפשרות 3 מקיימת את שני התנאים יחד.',
  q_pro_spatial_6968e52714625a36934b64c2:
    'התשובה הנכונה היא 3. בפריסה יש לשמור על יחסי השכנות בין הסימנים שעל הפאות: הסימון המרכזי נשאר על הפאה הקדמית, הסימון שמעליו עובר לפאה העליונה, והסימון שמימינו עובר לפאה הצדדית. מבין הקוביות, רק אפשרות 3 מציגה את שלושת הסימנים באותם יחסי מיקום לאחר הקיפול.',
  q_pro_spatial_69690da278613b3ac96a701d:
    'התשובה הנכונה היא 3. במטריצה יש חוקיות לפי עמודות: בכל עמודה משתנים גם סוג המצולע וגם מיקום הסימון הפנימי באופן עקבי. בתא החסר צריך להופיע אותו מצולע המשלים את רצף השורה והעמודה, עם הסימון במיקום המתאים לפי העמודה. רק אפשרות 3 משלימה את שני הדפוסים יחד.',
  q_pro_spatial_69691a121be4ea4db39f2664:
    'התשובה הנכונה היא 3. הפעולה המבוקשת היא שינוי צבע וסיבוב של האובייקט בזווית של כ-30 עד 60 מעלות נגד כיוון השעון. לכן התשובה צריכה לשמור על אותו מבנה תלת-ממדי בסיסי, ורק לשנות את הצבע ואת הזווית. אפשרות 3 היא היחידה ששומרת על צורת ה-L המקורית ומציגה אותה בצבע ובזווית המתאימים.',
  q_pro_spatial_69691cd503f885ccdaebc686:
    'התשובה הנכונה היא 3. בכל שורה מופיע אותו סוג צורה בשלושה מצבי מילוי: קו מתאר, קו מקווקו/ריק, ואז מילוי מלא. בשורה הראשונה זה עיגול, בשורה השנייה ריבוע, ובשורה השלישית משולש. לכן התא החסר צריך להיות משולש מלא, וזה בדיוק מה שמופיע באפשרות 3.',
  q_pro_spatial_69691d9189fe5fefe038fa53:
    'התשובה הנכונה היא 3. המטריצה מסודרת כך שבכל עמודה נשמר סוג מילוי קבוע: בעמודה הראשונה הצורות ריקות, בעמודה השנייה אפורות, ובעמודה השלישית שחורות. במקביל, סוגי הצורות מתחלפים במחזור עיגול-ריבוע-משולש. לכן בתא החסר נדרש ריבוע שחור, ורק אפשרות 3 מתאימה.',
  q_pro_spatial_6969edf14dd87b5241570c02:
    'התשובה הנכונה היא 1. בכל תא מופיע זוג צורות, והחוקיות היא תזוזה מחזורית של הצורות בתוך השורה והעמודה תוך שמירה על היחס ביניהן. בתא החסר צריך להופיע אותו זוג שממשיך את המחזור ולא צירוף חדש. אפשרות 1 היא היחידה ששומרת על שילוב הצורות והמיקום הנדרש.',
  q_pro_spatial_696a6915cbda878e47cc74d0:
    'התשובה הנכונה היא 1. ברצף מופיעים שני מאפיינים במקביל: הצורה העליונה והצורה התחתונה מתחלפות במחזור קבוע. לאחר שלושת השלבים הראשונים המחזור מתחיל לחזור על עצמו, ולכן התא הבא צריך להציג את אותו שילוב שמופיע בתחילת המחזור. אפשרות 1 היא היחידה שממשיכה את שני המחזורים יחד.',
  q_pro_spatial_696a6f7bdb9d490fa15f109d:
    'התשובה הנכונה היא 1. ברצף נשמרים אותם שלושה סוגי צורות, אך בכל שלב משתנה מי מהן מודגשת/מלאה ומיקומן היחסי מתחלף לפי מחזור קבוע. התא החסר צריך להמשיך את המחזור בלי להוסיף צורה חדשה ובלי לשנות את מספר הצורות. אפשרות 1 היא היחידה ששומרת על המבנה ועל סדר ההדגשה.',
  q_pro_spatial_696a71ca76138af65bb84ed7:
    'התשובה הנכונה היא 3. במטריצה כל תא מתקבל מצירוף של קווי בסיס: קו אנכי, קו אופקי וקווים אלכסוניים. בתא החסר צריכים להופיע יחד קווי האלכסון שממשיכים את החוקיות של השורה והעמודה. רק אפשרות 3 מציגה את הצורה עם שני האלכסונים הדרושים ולכן משלימה את התבנית.',
  q_pro_spatial_696b4ada3f766917489bd919:
    'התשובה הנכונה היא 4. באנלוגיה יש לשמור על היחס בין הצורה החיצונית לבין הסימון הפנימי: הצורה החיצונית משתנה לצורה הבאה, והקו הפנימי משנה כיוון בהתאם. כאשר מחילים את אותו כלל על הצורה השנייה, מתקבלת צורה חיצונית תואמת עם קו פנימי אנכי. רק אפשרות 4 שומרת על היחס הזה.',
  q_pro_spatial_696b4d69877fc422f1823681:
    'התשובה הנכונה היא 1. החוקיות מבוססת על שמירת המבנה הסימטרי והעברת הקווים הפנימיים למיקום המקביל בצורה החדשה. הצורה החיצונית נשארת במסגרת יהלום/מעוין, והקווים הפנימיים צריכים להמשיך את הצירים המרכזיים. אפשרות 1 היא היחידה ששומרת גם על המסגרת וגם על חלוקת הקווים הנכונה.',
  q_pro_spatial_696b4f49cfa26ccefe546f43:
    'התשובה הנכונה היא 1. באנלוגיה יש פעולה עקבית על אותה צורה: שמירה על סוג הצורה ועל היחס הפנימי, לצד שינוי מיקום/כיוון בהתאם לדוגמה. לכן יש לבחור באפשרות ששומרת על אותה חוקיות במקום להחליף לצורה או סימון שאינם מתאימים. רק אפשרות 1 ממשיכה את היחס המוצג בשאלה.',
  q_pro_spatial_696b50b360a08b8c16536290:
    'התשובה הנכונה היא 2. הרצף האנלוגי שומר על אותו כלל מעבר בין הצורות: מאפיין אחד משתנה בכל פעם, בעוד שאר המאפיינים נשמרים כדי ליצור המשך עקבי. התא החסר צריך להתאים לשלב הבא במחזור ולא לחזור לשלב קודם. אפשרות 2 היא היחידה שממשיכה את המחזור בצורה עקבית.',
  q_pro_spatial_6971f6478c1193b13388ce0a:
    'התשובה הנכונה היא 3. בשאלה נדרש להשלים את הצורה לפי אותה טרנספורמציה שמופיעה בדוגמה: שמירה על המבנה המרכזי ושינוי מבוקר של המיקום/הכיוון של הרכיב הפנימי. מבין האפשרויות, רק אפשרות 3 שומרת על היחס בין הצורות וממקמת את הרכיב בהתאם לחוקיות.',
};

function sourceQuestionText(question) {
  return normalizeText(question.questionText ?? question.question_text ?? question.text);
}

function sourceExplanation(question, liveId) {
  return reviewedSpatialExplanations[liveId] ?? normalizeText(question.explanation);
}

function isWorthSyncing(liveQuestion, sourceQuestion, liveId) {
  const sourceText = sourceQuestionText(sourceQuestion);
  const sourceEx = sourceExplanation(sourceQuestion, liveId);
  const liveText = normalizeText(liveQuestion.question_text);
  const liveEx = normalizeText(liveQuestion.explanation);
  if (!sourceText || !sourceEx) return false;
  if (/[?]{3,}/.test(liveText)) return true;
  if (liveQuestion.topic_id === 'topic_spatial' && /^התשובה הנכונה היא אפשרות [a-d1-4]/.test(liveEx)) return true;
  if (liveQuestion.topic_id === 'topic_spatial' && liveEx.length < sourceEx.length && sourceEx.length >= 40) return true;
  return false;
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
  const sources = loadSourceQuestions();
  const questions = await fetchAllQuestions(supabase);
  const changes = [];

  for (const liveQuestion of questions) {
    if (!liveQuestion.id.startsWith('q_pro_spatial_')) continue;
    const sourceId = liveQuestion.id.replace(/^q_pro_spatial_/, '');
    const source = sources.get(sourceId);
    if (!source || !isWorthSyncing(liveQuestion, source, liveQuestion.id)) continue;

    const update = {
      question_text: sourceQuestionText(source),
      explanation: sourceExplanation(source, liveQuestion.id),
    };

    const { error } = await supabase
      .from('questions')
      .update(update)
      .eq('id', liveQuestion.id);
    if (error) throw error;

    changes.push({
      id: liveQuestion.id,
      sourceId,
      changedQuestionText: normalizeText(liveQuestion.question_text) !== update.question_text,
      oldQuestionText: normalizeText(liveQuestion.question_text),
      newQuestionText: update.question_text,
      oldExplanationLength: normalizeText(liveQuestion.explanation).length,
      newExplanationLength: update.explanation.length,
      usedReviewedExplanation: Boolean(reviewedSpatialExplanations[liveQuestion.id]),
    });
  }

  const report = {
    syncedAt: new Date().toISOString(),
    scanned: questions.length,
    updated: changes.length,
    reviewedExplanationsAvailable: Object.keys(reviewedSpatialExplanations).length,
    changes,
  };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
