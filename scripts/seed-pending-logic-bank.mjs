import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const idsPrefix = 'q_logic_conditions_20260831_';
const letters = ['a', 'b', 'c', 'd'];

const subjects = [
  ['אורי', 'ברק', 'גיל', 'דנה'], ['יעל', 'נועה', 'רותם', 'תמר'], ['אמיר', 'בנימין', 'כרמל', 'דרור'],
  ['אלה', 'גלי', 'הילה', 'לירון'], ['יואב', 'כפיר', 'מתן', 'נדב'], ['אביב', 'הדר', 'עדי', 'שירה'],
  ['אייל', 'זיו', 'חן', 'טל'], ['מאיה', 'נוגה', 'סיון', 'רוני'], ['ארז', 'בועז', 'דור', 'ליאור'],
  ['אפרת', 'דפנה', 'מיכל', 'קרן'],
];
const nouns = [
  ['חוקרים', 'מדענים', 'מוזיקאים'], ['טכנאים', 'מהנדסים', 'מנהלים'], ['ציירים', 'אמנים', 'ספורטאים'],
  ['מתכנתים', 'עובדי הייטק', 'מרצים'], ['נווטים', 'טייסים', 'רופאים'], ['בלשים', 'חוקרים', 'סופרים'],
  ['מתרגמים', 'בלשנים', 'משפטנים'], ['כלכלנים', 'אנליסטים', 'יועצים'], ['אדריכלים', 'מתכננים', 'פסלים'],
  ['מדריכים', 'מורים', 'מנהלים'],
];
const events = [
  ['הדוח אושר', 'הפרויקט יצא לדרך', 'התקציב הועבר'],
  ['המחשב הופעל', 'הבדיקה התחילה', 'התוצאה נשמרה'],
  ['הכרטיס תקף', 'השער נפתח', 'הנוסע נכנס'],
  ['החיישן נדלק', 'האזעקה פעלה', 'הצוות הוזעק'],
  ['הקוד עבר בדיקה', 'הגרסה הופצה', 'המשתמשים קיבלו עדכון'],
  ['הבקשה נקלטה', 'הוועדה התכנסה', 'ההחלטה פורסמה'],
  ['המשלוח הגיע', 'המחסן עודכן', 'הלקוח קיבל הודעה'],
  ['התרגיל הושלם', 'הציון חושב', 'המשוב נשלח'],
  ['הדלת ננעלה', 'הנורה האדומה נדלקה', 'השומר קיבל התראה'],
  ['הטופס נחתם', 'התיק נפתח', 'הדיון נקבע'],
];

function options(correct, wrong, rotation) {
  const values = [...wrong];
  values.splice(rotation % 4, 0, correct);
  return values.map((text, index) => ({ id: letters[index], text, isCorrect: index === rotation % 4 }));
}

function row(index, family, questionText, correct, wrong, explanation, difficulty, rotation = index) {
  const opts = options(correct, wrong, rotation);
  return {
    id: `${idsPrefix}${String(index + 1).padStart(3, '0')}`,
    target_ids: ['target_psychometric', 'target_ktzina', 'target_modiin', 'target_hightech'],
    topic_id: 'topic_logic',
    subtopic_id: null,
    question_type: 'logic',
    question_text: `תרחיש ${index + 1}: ${questionText}`,
    reading_passage: null,
    media_url: null,
    media_type: null,
    options: opts,
    correct_answer: opts.find(option => option.isCorrect).id,
    explanation,
    difficulty,
    psychometric_stats: { elo: 900 + difficulty * 90, discrimination: 0.7, guessProbability: 0.25, family },
    access_level: index % 3 === 0 ? 'free' : 'premium',
    validation_status: 'pending',
    smart_practice_eligible: false,
    general_practice_eligible: false,
  };
}

const builders = [
  (i, s, e) => row(i, 'conditional_chain',
    `נתון: אם ${e[0]}, אז ${e[1]}. אם ${e[1]}, אז ${e[2]}. ידוע כי ${e[0]}. מה מתחייב?`,
    e[2], [`${e[2]} אינו מתקיים`, `לא ניתן לדעת אם ${e[1]}`, `אף אחד מהאירועים אינו מתקיים`],
    `מן הנתון ${e[0]} והכלל הראשון נובע כי ${e[1]}. כעת מפעילים את הכלל השני ומסיקים כי ${e[2]}. זהו היסק שרשרת תקף; לכן האירוע השלישי מתחייב.`, 2 + (i % 3)),
  (i, s, e) => row(i, 'modus_tollens',
    `אם ${e[0]}, אז ${e[1]}. ידוע כי ${e[1]} לא התקיים. איזו מסקנה הכרחית?`,
    `${e[0]} לא התקיים`, [e[0], `${e[2]} התקיים`, 'לא ניתן להסיק דבר'],
    `הכלל קובע שכל מצב שבו ${e[0]} מתקיים חייב להוביל לכך ש${e[1]}. מאחר שהתוצאה ${e[1]} לא התקיימה, גם התנאי ${e[0]} לא יכול היה להתקיים. זהו היסק בדרך של שלילת הסיפא.`, 3 + (i % 3)),
  (i, s, e, n) => row(i, 'categorical_syllogism',
    `כל ה${n[0]} הם ${n[1]}. אף ${n[1]} אינו ${n[2]}. מה נובע בהכרח?`,
    `אף ${n[0]} אינו ${n[2]}`, [`כל ה${n[2]} הם ${n[0]}`, `חלק מה${n[0]} הם ${n[2]}`, `כל ה${n[1]} הם ${n[0]}`],
    `קבוצת ה${n[0]} מוכלת כולה בקבוצת ה${n[1]}. הקבוצה ${n[1]} זרה לקבוצת ה${n[2]}, ולכן גם תת-הקבוצה ${n[0]} אינה יכולה לכלול אף ${n[2]}.`, 3 + (i % 4)),
  (i, s) => row(i, 'ordering',
    `${s[0]} הגיע לפני ${s[1]}. ${s[1]} הגיע לפני ${s[2]}. ${s[3]} הגיע אחרי ${s[2]}. איזה משפט נכון בהכרח?`,
    `${s[0]} הגיע לפני ${s[3]}`, [`${s[3]} הגיע לפני ${s[1]}`, `${s[2]} הגיע לפני ${s[0]}`, `${s[1]} הגיע אחרי ${s[3]}`],
    `חיבור יחסי הסדר נותן ${s[0]} לפני ${s[1]}, לפני ${s[2]}, לפני ${s[3]}. לכן ${s[0]} בהכרח הגיע לפני ${s[3]}; שלושת המשפטים האחרים סותרים את השרשרת.`, 2 + (i % 4)),
  (i, s) => row(i, 'exclusive_choice',
    `בדיוק אחד מבין ${s[0]} ו${s[1]} משתתף במשימה. ידוע כי ${s[0]} אינו משתתף. מה מתחייב?`,
    `${s[1]} משתתף`, [`${s[1]} אינו משתתף`, `שניהם משתתפים`, 'אי אפשר לקבוע מי משתתף'],
    `הביטוי "בדיוק אחד" מחייב שאחד משתתף והשני אינו משתתף. לאחר שנשללה השתתפותו של ${s[0]}, האפשרות היחידה שנותרה היא ש${s[1]} משתתף.`, 2 + (i % 3)),
  (i, s) => row(i, 'combined_conditions',
    `אם ${s[0]} משתתף, גם ${s[1]} משתתף. ${s[1]} משתתף רק אם ${s[2]} אינו משתתף. ידוע כי ${s[0]} משתתף. מה מתחייב?`,
    `${s[2]} אינו משתתף`, [`${s[2]} משתתף`, `${s[1]} אינו משתתף`, `${s[0]} אינו משתתף`],
    `מהשתתפות ${s[0]} נובעת השתתפות ${s[1]}. הניסוח "${s[1]} משתתף רק אם ${s[2]} אינו משתתף" קובע שאי-השתתפות של ${s[2]} היא תנאי הכרחי להשתתפות ${s[1]}. לכן ${s[2]} אינו משתתף.`, 5 + (i % 3)),
  (i, s) => row(i, 'truth_tellers',
    `${s[0]} אומר: "${s[1]} משקר". ${s[1]} אומר: "${s[0]} ואני מאותו סוג". ידוע שכל אחד מהם תמיד דובר אמת או תמיד משקר. מי דובר אמת?`,
    `${s[0]} דובר אמת ו${s[1]} משקר`, [`שניהם דוברי אמת`, `שניהם משקרים`, `${s[0]} משקר ו${s[1]} דובר אמת`],
    `נניח ש${s[0]} דובר אמת: אז ${s[1]} משקר, וטענת ${s[1]} שהם מאותו סוג אכן שקרית — מצב עקבי. אם ${s[0]} משקר, אז ${s[1]} דובר אמת, אך הם מסוגים שונים ולכן טענת ${s[1]} שהם מאותו סוג תהיה שקרית; מתקבלת סתירה. לכן רק האפשרות שבה ${s[0]} דובר אמת ו${s[1]} משקר אפשרית.`, 7 + (i % 2)),
  (i, s, e, n) => row(i, 'necessary_vs_sufficient',
    `קבלה לתפקיד מחייבת להיות ${n[0]}. ${s[0]} הוא ${n[0]}. מה ניתן להסיק לגבי קבלתו של ${s[0]} לתפקיד?`,
    `לא ניתן לקבוע אם ${s[0]} התקבל`, [`${s[0]} התקבל בוודאות`, `${s[0]} לא התקבל`, `כל ה${n[0]} מתקבלים לתפקיד`],
    `להיות ${n[0]} הוא תנאי הכרחי לקבלה, אך לא נאמר שזה תנאי מספיק. לכן העובדה ש${s[0]} הוא ${n[0]} אינה מוכיחה שהתקבל ואינה מוכיחה שלא התקבל.`, 5 + (i % 3)),
];

const rows = Array.from({ length: 240 }, (_, index) => {
  const s = subjects[index % subjects.length];
  const e = events[(index * 3 + Math.floor(index / 10)) % events.length];
  const n = nouns[(index * 7 + Math.floor(index / 20)) % nouns.length];
  return builders[index % builders.length](index, s, e, n);
});

function audit(items) {
  const errors = [];
  const ids = new Set();
  const texts = new Set();
  for (const item of items) {
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
    if (texts.has(item.question_text)) errors.push(`${item.id}: duplicate text`);
    ids.add(item.id);
    texts.add(item.question_text);
    if (item.options.length !== 4) errors.push(`${item.id}: option count`);
    if (item.options.filter(option => option.isCorrect).length !== 1) errors.push(`${item.id}: correct count`);
    if (!item.options.some(option => option.id === item.correct_answer && option.isCorrect)) errors.push(`${item.id}: answer mismatch`);
    if (item.validation_status !== 'pending' || item.smart_practice_eligible || item.general_practice_eligible) errors.push(`${item.id}: unsafe publication state`);
    if (item.explanation.length < 80) errors.push(`${item.id}: short explanation`);
  }
  if (errors.length) throw new Error(errors.slice(0, 20).join('\n'));
}

async function main() {
  audit(rows);
  const summary = {
    total: rows.length,
    families: Object.fromEntries(builders.map((_, i) => [rows[i].psychometric_stats.family, rows.filter(row => row.psychometric_stats.family === rows[i].psychometric_stats.family).length])),
    difficulties: Object.fromEntries([...new Set(rows.map(row => row.difficulty))].sort().map(d => [d, rows.filter(row => row.difficulty === d).length])),
    free: rows.filter(row => row.access_level === 'free').length,
    premium: rows.filter(row => row.access_level === 'premium').length,
    status: 'pending',
  };
  if (!apply) return console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));

  const source = await fs.readFile(path.join(root, 'lib', 'supabase.ts'), 'utf8');
  const read = name => source.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`))?.[1];
  const client = createClient(read('SUPABASE_URL'), read('SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  for (let i = 0; i < rows.length; i += 20) {
    const { error } = await client.from('questions').upsert(rows.slice(i, i + 20), { onConflict: 'id' });
    if (error) throw new Error(`Batch ${i / 20 + 1}: ${error.message}`);
  }
  const { count, error } = await client.from('questions').select('id', { head: true, count: 'exact' }).like('id', `${idsPrefix}%`);
  if (error || count !== rows.length) throw new Error(error?.message || `Expected ${rows.length}, found ${count}`);
  console.log(JSON.stringify({ mode: 'applied', ...summary, verified: count }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
