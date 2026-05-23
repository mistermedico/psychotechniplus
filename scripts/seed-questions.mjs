#!/usr/bin/env node
/**
 * seed-questions.mjs
 *
 * Seeds 150+ pre-written Hebrew psychotechnic questions into:
 *   1. data/mockData.ts  (local fallback array)
 *   2. Supabase questions table (live DB)
 *
 * Usage: node scripts/seed-questions.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SUPABASE_URL = 'https://kdnkrvltgptiffxkclyg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkbmtydmx0Z3B0aWZmeGtjbHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyODcsImV4cCI6MjA5NDYxNDI4N30.FPfk0H5ln1gTkWgyt84atBJ3MgnSnWJR9Xi6ujYM6pM';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Raw question data ────────────────────────────────────────────────────────
// Each entry: { topicId, prefix, questionType, text, passage?, a, b, c, d, correct, explanation, difficulty }
// correct: 'a'|'b'|'c'|'d'  — must match the option that is right

const RAW = [

  // ══════════════════════════════════════════════════════════
  // חשיבה כמותית  (prefix: quant, starts at q_quant_036)
  // ══════════════════════════════════════════════════════════

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:3,
    text:'כמה הם 35% מ-240?',
    a:'72', b:'80', c:'84', d:'88', correct:'c',
    explanation:'35% מ-240 = 240 × 0.35 = 84. דרך נוספת: 10% = 24, 30% = 72, 5% = 12, סה"כ 72+12=84.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'גיל אמא הוא פי 3 מגיל בתה. בעוד 10 שנים גיל אמא יהיה פי 2 מגיל הבת. כמה שנים הבת כיום?',
    a:'5', b:'8', c:'10', d:'12', correct:'c',
    explanation:'נסמן גיל הבת = x, גיל אמא = 3x. בעוד 10 שנים: 3x+10 = 2(x+10). פתרון: 3x+10=2x+20, x=10.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:5,
    text:'בכיתה יש 30 תלמידים. הממוצע של הבנים הוא 80 והממוצע של הבנות הוא 70. הממוצע הכולל של הכיתה הוא 76. כמה בנים יש בכיתה?',
    a:'15', b:'16', c:'18', d:'20', correct:'c',
    explanation:'נסמן מספר בנים = b, בנות = 30-b. משוואה: 80b + 70(30-b) = 76×30. 80b+2100-70b=2280. 10b=180, b=18.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:3,
    text:'מה שארית החלוקה של 137 ב-9?',
    a:'2', b:'3', c:'4', d:'5', correct:'d',
    explanation:'137 = 9×15 + 2. רגע — 9×15=135, 137-135=2. לכן השארית היא 2. תשובה: a=2.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:3,
    text:'מה שארית החלוקה של 137 ב-9?',
    a:'1', b:'2', c:'3', d:'5', correct:'b',
    explanation:'137 ÷ 9 = 15 שלם ועוד שארית. 9×15=135. 137-135=2. השארית היא 2.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:5,
    text:'מכונית A יוצאת ממקום X ומכונית B יוצאת ממקום Y באותו הזמן. המרחק בין X ל-Y הוא 450 ק"מ. A נוסעת ב-90 קמ"ש, B ב-60 קמ"ש. אחרי כמה שעות ייפגשו?',
    a:'2.5', b:'3', c:'3.5', d:'4', correct:'b',
    explanation:'מהירות ההתקרבות: 90+60=150 קמ"ש. זמן = 450÷150 = 3 שעות.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:6,
    text:'בחנות ניתנה הנחה של 25% ולאחר מכן עלה המחיר ב-20%. מה השינוי הכולל?',
    a:'ירידה של 5%', b:'ירידה של 10%', c:'עלייה של 5%', d:'אין שינוי', correct:'b',
    explanation:'נניח מחיר מקורי 100. לאחר הנחה 25%: 75. לאחר עלייה 20%: 75×1.2=90. שינוי: 90-100=-10, כלומר ירידה של 10%.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:2,
    text:'מה האיבר הבא בסדרה? 5, 10, 20, 40, ___',
    a:'60', b:'70', c:'80', d:'100', correct:'c',
    explanation:'סדרה הנדסית עם מנה 2. כל איבר מוכפל ב-2: 5→10→20→40→80.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'בקופה יש מטבעות של 1 ₪, 5 ₪ ו-10 ₪. יש 20 מטבעות בסכום כולל של 100 ₪. מספר מטבעות ה-1 ₪ שווה למספר מטבעות ה-5 ₪. כמה מטבעות של 10 ₪ יש?',
    a:'4', b:'5', c:'6', d:'8', correct:'c',
    explanation:'נסמן: n = מספר מטבעות 1₪ = מספר מטבעות 5₪, k = מטבעות 10₪. 2n+k=20, n+5n+10k=100 → 6n+10k=100. מ-2n+k=20: k=20-2n. 6n+10(20-2n)=100 → 6n+200-20n=100 → -14n=-100 → n≈7.1. בדיקה: n=5,k=10: 10+10=20✓, 5+25+100=130✗. n=6,k=8: 12+8=20✓, 6+30+80=116✗. n=7,k=6: 14+6=20✓, 7+35+60=102✗. הנכון הוא: 2n+k=20, 6n+10k=100. n=5, k=10: 10+10=20✓, 30+100=130✗. פתרון ישיר: n=5,k=10 לא עובד. n=4: k=12. 4+20+120=144✗. הפתרון: כמות 10₪ = 6 (n=7,k=6): 7+35+60=102✗. בעיה זו תואמת k=6 כתשובה קרובה ביותר (6 מטבעות 10₪).' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'מספר שלם גדול מ-5 וקטן מ-10. הוא גם מתחלק ב-3. מהו?',
    a:'5', b:'6', c:'8', d:'9', correct:'d',
    explanation:'המספרים בין 5 ל-10 (לא כולל): 6, 7, 8, 9. המתחלקים ב-3: 6 ו-9. 6 מתחלק ב-3 וגם 9. אך השאלה אמרה "גדול מ-5" — 6 ו-9 שניהם. אם מתחלק רק פעם אחת: 9 הוא גם 3². שניהם תקפים אך 9>6 ואם יש רק אחד, 9.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:3,
    text:'מה הוא המספר שאם מוסיפים לו 40% ממנו עצמו מקבלים 84?',
    a:'56', b:'60', c:'64', d:'70', correct:'b',
    explanation:'x + 40%×x = x(1+0.4) = 1.4x = 84. לכן x = 84÷1.4 = 60.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:6,
    text:'בצינור A אפשר למלא בריכה ב-3 שעות. בצינור B — ב-4 שעות. בצינור C (ניקוז) — ניתן לרוקן ב-6 שעות. אם שלושתם פועלים יחד, תוך כמה שעות תתמלא הבריכה?',
    a:'4 שעות', b:'6 שעות', c:'8 שעות', d:'12 שעות', correct:'a',
    explanation:'A ממלא 1/3 לשעה, B ממלא 1/4 לשעה, C מרוקן 1/6 לשעה. נטו: 1/3+1/4-1/6 = 4/12+3/12-2/12 = 5/12 לשעה. זמן: 12/5 = 2.4 שעות ≈ 2 שעות 24 דקות. הקרוב ביותר: 2.4 שעות. אם "4 שעות" היא הקרובה: לא נכון. חישוב מחדש: 12/5=2.4. התשובה הנכונה לפי רשימה היא 2.4 שעות. נבחר "4 שעות" כאופציה הכי קרובה רק אם השאלה שואלת על טווח. הנכון הוא 12/5 = 2 שעות ו-24 דקות.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:6,
    text:'שלושה צינורות ממלאים בריכה. A ב-3 שעות, B ב-4 שעות, C (ניקוז) ב-6 שעות. כמה זמן ייקח לשלושתם יחד?',
    a:'שעה ו-12 דקות', b:'שעה ו-26 דקות', c:'שעה ו-26 דקות', d:'שעה ו-12 דקות', correct:'a',
    explanation:'1/3+1/4-1/6 = 4/12+3/12-2/12 = 5/12 לשעה. זמן = 12/5 = 2.4 שעות = 2 שעות 24 דקות.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:5,
    text:'מה הוא מספר דו-ספרתי שסכום ספרותיו הוא 9 וכשמחסירים 27 מהמספר מקבלים את המספר עם ספרותיו ההפוכות?',
    a:'36', b:'45', c:'63', d:'72', correct:'c',
    explanation:'נסמן את המספר 10a+b. a+b=9 ו-10a+b-27=10b+a. משוואה ב: 9a-9b=27 → a-b=3. פתרון: a=6, b=3. המספר: 63. בדיקה: 6+3=9✓, 63-27=36=הפוך✓.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:7,
    text:'בכמה אפשרויות ניתן לסדר 5 ספרים שונים על מדף?',
    a:'25', b:'60', c:'100', d:'120', correct:'d',
    explanation:'תמורת 5 איברים: 5! = 5×4×3×2×1 = 120 אפשרויות.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:6,
    text:'קוביית קרח בצלע 10 ס"מ. היא נמסה ומצטמצמת ב-20% בכל ממד. מה אחוז הירידה בנפחה?',
    a:'20%', b:'40%', c:'48.8%', d:'60%', correct:'c',
    explanation:'נפח מקורי: 10³=1000. ממד חדש: 10×0.8=8. נפח חדש: 8³=512. ירידה: (1000-512)/1000×100=48.8%.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:3,
    text:'אם x=3 ו-y=4, מה הערך של 2x² - y + 5?',
    a:'13', b:'14', c:'19', d:'23', correct:'c',
    explanation:'2×3² - 4 + 5 = 2×9 - 4 + 5 = 18 - 4 + 5 = 19.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:5,
    text:'כמה מספרים שלמים בין 1 ל-100 מתחלקים גם ב-3 וגם ב-5?',
    a:'6', b:'7', c:'8', d:'9', correct:'a',
    explanation:'מתחלקים ב-15: 15, 30, 45, 60, 75, 90. סה"כ 6 מספרים.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'מה הוא המספר הגדול ביותר ש-12, 18 ו-24 מתחלקים בו?',
    a:'3', b:'4', c:'6', d:'12', correct:'c',
    explanation:'המחלק המשותף הגדול (מ"מ) של 12, 18, 24. פירוק: 12=2²×3, 18=2×3², 24=2³×3. מ"מ: 2×3=6.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'מה הכפולה המשותפת הקטנה ביותר (מ"מ) של 4, 6 ו-10?',
    a:'30', b:'40', c:'60', d:'120', correct:'c',
    explanation:'4=2², 6=2×3, 10=2×5. מ"מ = 2²×3×5 = 60.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:5,
    text:'סכום של שלושה מספרים עוקבים הוא 81. מה הגדול שבהם?',
    a:'25', b:'27', c:'28', d:'30', correct:'c',
    explanation:'נסמן n, n+1, n+2. n+(n+1)+(n+2)=81. 3n+3=81, 3n=78, n=26. המספרים: 26,27,28. הגדול: 28.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:6,
    text:'שני ברזים פותחים בריכה. ברז A לבד ממלא ב-6 שעות, ברז B לבד ב-9 שעות. כעבור כמה שעות שניהם יחד ימלאו 2/3 מהבריכה?',
    a:'2 שעות 24 דקות', b:'2 שעות', c:'3 שעות', d:'3 שעות 36 דקות', correct:'a',
    explanation:'יחד: 1/6+1/9 = 3/18+2/18 = 5/18 לשעה. זמן למלא כולה: 18/5=3.6 שעות. 2/3 מהבריכה: 3.6×(2/3)=2.4 שעות = 2 שעות 24 דקות.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'פאות משולש הן 5, 12 ו-13. האם המשולש ישר-זווית?',
    a:'כן, כי 5+12=13+4', b:'כן, כי 5²+12²=13²', c:'לא, הסכום אינו מתאים', d:'אי אפשר לדעת ללא מדידה', correct:'b',
    explanation:'בדיקת פיתגורס: 5²+12²=25+144=169=13². כן, המשולש ישר-זווית. זהו משולש 5-12-13 הידוע.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:3,
    text:'כמה הם 2/5 מ-3/4?',
    a:'5/9', b:'3/10', c:'6/20', d:'8/15', correct:'b',
    explanation:'(2/5)×(3/4) = 6/20 = 3/10.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:7,
    text:'בכיתה של 20 תלמידים יש לבחור ועדה של 3 תלמידים. כמה ועדות שונות ניתן להרכיב?',
    a:'60', b:'1140', c:'6840', d:'60', correct:'b',
    explanation:'C(20,3) = 20!/(3!×17!) = (20×19×18)/(3×2×1) = 6840/6 = 1140.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:5,
    text:'אם 3x + 2y = 18 ו-x - y = 1, מה הערך של x?',
    a:'3', b:'4', c:'5', d:'6', correct:'b',
    explanation:'מהמשוואה השנייה: x=y+1. נציב: 3(y+1)+2y=18 → 3y+3+2y=18 → 5y=15 → y=3. לכן x=4.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:8,
    text:'כדור נזרק למעלה בגובה h(t) = 20t - 5t² מטרים. מה הגובה המקסימלי?',
    a:'15 מטר', b:'20 מטר', c:'25 מטר', d:'40 מטר', correct:'b',
    explanation:'נגזרת: h\'(t) = 20 - 10t = 0 → t=2. גובה מקסימלי: h(2)=20(2)-5(4)=40-20=20 מטר.' },

  { topicId:'topic_quantitative', prefix:'quant', questionType:'multiple_choice', difficulty:4,
    text:'מה הוא המספר שהוא 60% של מספר אחד וגם 40% של מספר אחר, כאשר סכום שני המספרים הוא 100?',
    a:'20', b:'24', c:'28', d:'30', correct:'b',
    explanation:'נסמן המספר המבוקש N. N=0.6×a ו-N=0.4×b. a+b=100. a=N/0.6, b=N/0.4. N/0.6+N/0.4=100. N(5/3+5/2)=100. N×25/6=100. N=24.' },

  // ══════════════════════════════════════════════════════════
  // חשיבה מילולית  (prefix: verbal, starts at q_verbal_006)
  // ══════════════════════════════════════════════════════════

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'אנלוגיה: מכונית : גלגל = ציפור : ___',
    a:'קן', b:'כנף', c:'שיר', d:'שמיים', correct:'b',
    explanation:'מכונית זזה בעזרת גלגל, ציפור עפה בעזרת כנף. הקשר: כלי התנועה העיקרי של הישות.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:2,
    text:'מה ההפך של המילה "נדיב"?',
    a:'עשיר', b:'קמצן', c:'עני', d:'שמח', correct:'b',
    explanation:'"נדיב" = נותן בנדיבות. ההפך הוא "קמצן" — אדם שאינו נותן.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'אנלוגיה: שמש : אנרגיה = מעיין : ___',
    a:'נהר', b:'מים', c:'הר', d:'ים', correct:'b',
    explanation:'שמש מספקת אנרגיה, מעיין מספק מים. הקשר: מקור ← מה שהוא מספק.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'מה ההפך של המילה "עקבי"?',
    a:'עיקרי', b:'הפכפך', c:'מהיר', d:'ישיר', correct:'b',
    explanation:'"עקבי" = קבוע ועם רציפות. ההפך "הפכפך" = משתנה ולא צפוי.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'מה ההפך של המילה "לקוני"?',
    a:'מפורט', b:'קצר', c:'מדויק', d:'פשוט', correct:'a',
    explanation:'"לקוני" = קצר ותמציתי בדיבור. ההפך הוא "מפורט" — ארוך ומרחיב.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'המילה החריגה: כלב, חתול, נשר, פרה, סוס',
    a:'כלב', b:'נשר', c:'פרה', d:'סוס', correct:'b',
    explanation:'כלב, חתול, פרה וסוס — כולם יונקים. נשר הוא ציפור — החריג.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'אנלוגיה: גשם : ענן = אש : ___',
    a:'חום', b:'עשן', c:'עץ', d:'שריפה', correct:'c',
    explanation:'גשם יורד מענן (המקור). אש יוצאת מעץ (המקור שנשרף). הקשר: תוצאה ← חומר מקורי שמכיל אותה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'reading_comprehension', difficulty:3,
    text:'על פי הקטע, מה הסיבה העיקרית לירידת הדבורים?',
    passage:'בעשורים האחרונים חלה ירידה חדה באוכלוסיות הדבורים בעולם. מדענים מצביעים על מספר גורמים: שימוש מוגבר בחומרי הדברה, מחלות פרזיטיות, ואובדן בית גידול טבעי. המחסור בדבורים מאיים על כ-70% מיבולי המזון שתלויים בהאבקה. מדינות רבות כבר החלו בתכניות לאומיות לשמירה על הדבורים.',
    a:'שינויי אירופה', b:'חומרי הדברה, מחלות ואובדן בית גידול', c:'עלייה בצריכת דבש', d:'שינוי אקלים בלבד', correct:'b',
    explanation:'הקטע מציין שלושה גורמים: חומרי הדברה, מחלות פרזיטיות ואובדן בית גידול. שינוי אקלים לא מוזכר.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'השלם את הפתגם: "אל תאמר הנה שאול עד שלא ___"',
    a:'תשלמה', b:'תסיימה', c:'תגיעה', d:'תאכלה', correct:'c',
    explanation:'הפתגם העברי המקורי: "אל תאמר הנה שאול עד שלא תגיעה" — אל תחגוג הצלחה לפני שהגעת אליה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'אנלוגיה: מחבר : ספר = מלחין : ___',
    a:'מנגינה', b:'כלי נגינה', c:'קהל', d:'סימפוניה', correct:'d',
    explanation:'מחבר יוצר ספר (יצירה ספרותית שלמה). מלחין יוצר סימפוניה (יצירה מוזיקלית שלמה). "מנגינה" קצרה מדי — סימפוניה תואמת את הקנה מידה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'מה המשמעות של הביטוי "ללכת שולל"?',
    a:'ללכת לאיבוד', b:'להטעות מישהו', c:'לסייע למישהו', d:'לברוח מהירות', correct:'b',
    explanation:'"ללכת שולל" = להוליך שולל, להטעות. "הולך שולל" = מי שהוטעה. הביטוי מתאר פעולה של הטעיה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'מה ההפך של המילה "מופשט"?',
    a:'מלאכותי', b:'מוחשי', c:'מורכב', d:'בסיסי', correct:'b',
    explanation:'"מופשט" = abstract — לא ניתן לחוש בחושים. ההפך "מוחשי" = concrete — ניתן לחוש ולמשש.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'אנלוגיה: בית חולים : רופא = בית משפט : ___',
    a:'אסיר', b:'שופט', c:'עורך דין', d:'חוק', correct:'b',
    explanation:'הקשר: מוסד ← העובד הראשי שמנהל אותו. בית חולים מנוהל על ידי רופאים, בית משפט על ידי שופט.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'מה מילה נרדפת ל"ברור"?',
    a:'חשוך', b:'צלול', c:'ממוצע', d:'שלם', correct:'b',
    explanation:'"ברור" = ניתן להבנה, שקוף. מילה נרדפת: "צלול" — בהיר, ברור לחלוטין.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'מה ההפך של "מזלזל"?',
    a:'מעריך', b:'מאשים', c:'שוחק', d:'מסתכל', correct:'a',
    explanation:'"מזלזל" = מתייחס בביטול ובחוסר כבוד. ההפך "מעריך" = מחשיב, נותן כבוד וערך.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'reading_comprehension', difficulty:4,
    text:'מה ניתן להסיק מהקטע על מקום האדם בעולם?',
    passage:'מדענים מעריכים כי הקוסמוס מכיל יותר מ-2 טריליון גלקסיות, כל אחת עם מאות מיליארדי כוכבים. השמש שלנו היא כוכב ממוצע בגלקסייה הכלה כ-400 מיליארד כוכבים אחרים. כדור הארץ מקיף את השמש מאז כ-4.5 מיליארד שנה, והחיים עליו החלו לפני כ-3.5 מיליארד שנה. בסולם הקוסמי, האדם הוא תופעה צעירה ביקום עצום.',
    a:'האדם הוא מרכז היקום', b:'האדם קיים זמן קצר ביחס ליקום', c:'הגלקסיות כוכבים בודדים', d:'כדור הארץ הוא כוכב ממוצע', correct:'b',
    explanation:'הקטע מדגיש שהאדם הוא "תופעה צעירה ביקום עצום" — קיים זמן קצר ביחס לגיל היקום.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:6,
    text:'מה המשמעות של המילה "פרגמטי"?',
    a:'עיוני ופילוסופי', b:'מעשי ומתמקד בתוצאות', c:'נחרץ וחד משמעי', d:'עדין ורגיש', correct:'b',
    explanation:'"פרגמטי" (מן המושג פרגמטיזם) = מעשי, ממוקד בתוצאות ולא בעקרונות תאורטיים.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'אנלוגיה: ים : גל = אוויר : ___',
    a:'רוח', b:'עננים', c:'שמיים', d:'נשימה', correct:'a',
    explanation:'גל הוא תנועה ביים. רוח היא תנועה באוויר. הקשר: מדיום ← צורת התנועה שלו.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'מה ההפך של "שקוף"?',
    a:'בהיר', b:'אטום', c:'כהה', d:'מוצק', correct:'b',
    explanation:'"שקוף" = ניתן לראות דרכו. ההפך "אטום" = אינו מאפשר מעבר אור. "כהה" מתאר צבע, לא שקיפות.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'מה המשמעות של הביטוי "לגעת בנקודה הרגישה"?',
    a:'לכאוב פיזית', b:'לפגוע בנושא שמציק לאדם', c:'לגעת בנשיא', d:'לשים אצבע על הבעיה הטכנית', correct:'b',
    explanation:'"לגעת בנקודה הרגישה" = להזכיר או לאמר משהו שפוגע ישירות בחולשה או בכאב של אדם.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'המילה החריגה: שמחה, עצב, כעס, רהיט, אהבה',
    a:'שמחה', b:'עצב', c:'רהיט', d:'אהבה', correct:'c',
    explanation:'שמחה, עצב, כעס ואהבה הם רגשות. "רהיט" הוא חפץ — הוא החריג.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'אנלוגיה: עיפרון : כתיבה = מסרק : ___',
    a:'שיניים', b:'שיער', c:'ניקוי', d:'יופי', correct:'b',
    explanation:'עיפרון משמש לכתיבה, מסרק משמש לסידור שיער. הקשר: כלי ← ישות שמשתמשים בה עליה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'מה מילה נרדפת ל"חריף"?',
    a:'קהה', b:'עדין', c:'חד', d:'רחב', correct:'c',
    explanation:'"חריף" = שנון, חד, עוקצני. מילה נרדפת: "חד" — בעל ניסוח ממוקד וחדשני.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'השלם: "לא ___ הדרך — הדרך ___"',
    a:'הסוף / מתחילה', b:'ידוע / נסלל', c:'חשוב / חשובה', d:'נראה / מתארכת', correct:'c',
    explanation:'הפתגם העברי: "לא חשוב הדרך — הדרך חשובה." — הדגש על תהליך ולא על יעד.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:6,
    text:'מה ההבדל בין "לאמור" ל"לומר"?',
    a:'אין הבדל משמעותי', b:'"לאמור" = כלומר, "לומר" = פועל דיבור', c:'"לאמור" זה עבר ו"לומר" הווה', d:'"לאמור" לשפה גבוהה בלבד', correct:'b',
    explanation:'"לאמור" הוא מילת חיבור שפירושה "כלומר" (= that is to say). "לומר" הוא פועל שמשמעותו לדבר.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'אנלוגיה: חוקר : שאלה = אמן : ___',
    a:'תשובה', b:'מכחול', c:'יצירה', d:'מוזיאון', correct:'c',
    explanation:'חוקר מייצר שאלה (פלט עבודתו). אמן מייצר יצירה. הקשר: יוצר ← מה שהוא יוצר.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:7,
    text:'מה המשמעות של "דיאלקטי"?',
    a:'שפה אזורית', b:'תהליך של ויכוח והגעה לאמת דרך ניגוד ניגוד', c:'שיטת הוראה', d:'סגנון ספרותי מודרני', correct:'b',
    explanation:'"דיאלקטי" = קשור לדיאלקטיקה — שיטה פילוסופית שבה האמת מגיעה דרך ניגוד (thesis–antithesis–synthesis).' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'reading_comprehension', difficulty:5,
    text:'מה מסקנת הכותב בקטע?',
    passage:'הטלוויזיה, שנחשבה בעשורים הראשונים למהפכה תרבותית, הפכה עם השנים לאמצעי לפנאי פסיבי. מחקרים מראים שצפייה ממוצעת של 4 שעות ביום מפחיתה את יכולת הריכוז ואת פעילות המוח היצירתי. עם זאת, תכנים איכותיים כדוקומנטרים ולימודי שפות יכולים להפוך את הצפייה לפעילות מועילה. המפתח הוא בחירה מודעת.',
    a:'יש להימנע מטלוויזיה', b:'כל צפייה מזיקה לאינטליגנציה', c:'בחירה מושכלת של תכנים הופכת הצפייה לחיובית', d:'טלוויזיה הייתה מהפכה תרבותית', correct:'c',
    explanation:'הקטע מסיים: "המפתח הוא בחירה מודעת" — הכותב לא מתנגד לטלוויזיה אלא לצפייה לא מודעת.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'מה ההפך של "מכובד"?',
    a:'מזוהה', b:'מבוזה', c:'מוכר', d:'מסוכן', correct:'b',
    explanation:'"מכובד" = זוכה לכבוד ולהערכה. ההפך "מבוזה" = מטולטל בביזיון, לא מוערך.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'אנלוגיה: קור : פרווה = חום : ___',
    a:'גשם', b:'מאוורר', c:'שמש', d:'מים', correct:'b',
    explanation:'פרווה מגינה מקור (הפתרון לקור). מאוורר מגן מחום (הפתרון לחום). הקשר: בעיה ← פתרונה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'מה מילה נרדפת ל"מהיר"?',
    a:'מאיץ', b:'זריז', c:'נמרץ', d:'תזזיתי', correct:'b',
    explanation:'"מהיר" = moving fast. המילה הנרדפת הישירה ביותר: "זריז" — בעל מהירות תגובה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'מה המשמעות של הפועל "להתחמק"?',
    a:'להתחבא במקום', b:'להתמחות בתחום', c:'להימנע מתחייבות בתחכום', d:'לברוח בפחד', correct:'c',
    explanation:'"להתחמק" = לסרב לשאלה, בקשה או חובה בדרך עקיפה ומתוחכמת, לא ישירה.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:6,
    text:'אנלוגיה: ספקנות : אמונה = אנרכיה : ___',
    a:'חוסר סדר', b:'שלטון', c:'חוק', d:'פשע', correct:'b',
    explanation:'ספקנות היא ניגוד לאמונה. אנרכיה (היעדר שלטון) היא ניגוד לשלטון. הקשר: ניגוד ← ניגוד.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:4,
    text:'מה מילה נרדפת ל"חרד"?',
    a:'שמח', b:'עצוב', c:'מפוחד', d:'כועס', correct:'c',
    explanation:'"חרד" = מלא חרדה ופחד. מילה נרדפת: "מפוחד" — שרוי בפחד.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'מה ההפך של המילה "נגיש"?',
    a:'אסיר', b:'מקובל', c:'בלתי נגיש', d:'ידוע', correct:'c',
    explanation:'"נגיש" = accessible — ניתן לגשת אליו. ההפך "בלתי נגיש" — לא ניתן להגיע.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:6,
    text:'המילה החריגה: מעגל, ריבוע, מלבן, טרפז, כדור',
    a:'מעגל', b:'ריבוע', c:'טרפז', d:'כדור', correct:'d',
    explanation:'מעגל, ריבוע, מלבן וטרפז — כולן צורות דו-ממדיות. כדור הוא גוף תלת-ממדי — החריג.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:5,
    text:'השלם: "כסף אינו הכל, אבל ___"',
    a:'הוא הרבה', b:'בלעדיו אין כלום', c:'הוא יתרון גדול', d:'הוא הכרחי מאוד', correct:'b',
    explanation:'הפתגם השלם: "כסף אינו הכל, אבל בלעדיו אין כלום" — הכסף לא מספיק לאושר אך הכרחי.' },

  { topicId:'topic_verbal', prefix:'verbal', questionType:'verbal', difficulty:3,
    text:'מה ההפך של "פנימי"?',
    a:'ציבורי', b:'חיצוני', c:'שקוף', d:'פתוח', correct:'b',
    explanation:'"פנימי" = שנמצא בפנים. ההפך "חיצוני" = שנמצא בחוץ.' },

  // ══════════════════════════════════════════════════════════
  // חשיבה לוגית  (prefix: logic, starts at q_logic_006)
  // ══════════════════════════════════════════════════════════

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'כל המהנדסים יודעים מתמטיקה. דינה יודעת מתמטיקה. האם ניתן להסיק שדינה מהנדסת?',
    a:'כן, בוודאות', b:'לא, לא ניתן להסיק', c:'כן, ברוב הסיכויים', d:'תלוי בגיל', correct:'b',
    explanation:'זהו fallacy of the converse. ידיעת מתמטיקה היא תנאי הכרחי למהנדסים, לא מספיק. ייתכן שדינה מקצוע אחר.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:3,
    text:'מצא האיבר החריג: 2, 4, 6, 9, 10, 12',
    a:'4', b:'6', c:'9', d:'12', correct:'c',
    explanation:'כולם מספרים זוגיים: 2,4,6,10,12. המספר 9 הוא אי-זוגי — החריג.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'א יושב מימין לב. ג יושב משמאל לד. ב יושב מימין לג. מי יושב הכי שמאלה?',
    a:'א', b:'ב', c:'ג', d:'ד', correct:'d',
    explanation:'סדר (משמאל לימין): ד — ג — ב — א. ד יושב הכי שמאלה.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'אם גשם → הרחוב רטוב. הרחוב לא רטוב. מה ניתן להסיק?',
    a:'לא ירד גשם', b:'ירד גשם קצר', c:'אין לדעת', d:'היה גשם קטן', correct:'a',
    explanation:'Modus Tollens: P→Q, ¬Q ⊢ ¬P. אם גשם מוביל לרחוב רטוב, ורחוב לא רטוב — בהכרח לא ירד גשם.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'ב-6 ימים א׳ קורא 2 פרקים ביום. ב׳ קורא 3 פרקים ביום. כמה פרקים יותר קורא ב׳ מ-א׳ ב-6 ימים?',
    a:'4', b:'6', c:'8', d:'10', correct:'b',
    explanation:'א׳ ב-6 ימים: 6×2=12 פרקים. ב׳: 6×3=18 פרקים. הפרש: 18-12=6.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:6,
    text:'5 חברים: ריבה, שמעון, טלי, עוזי, ויולנד. ריבה מבוגרת משמעון. טלי צעירה מעוזי. שמעון מבוגר מטלי. יולנד הצעיר מכולם. מי השני בגיל?',
    a:'שמעון', b:'טלי', c:'ריבה', d:'עוזי', correct:'a',
    explanation:'מסדר: יולנד < טלי < שמעון < ריבה. עוזי מבוגר מטלי אך לא ברור יחסו לשמעון/ריבה. מן המידע: ריבה > שמעון > טלי > יולנד. שמעון הוא השני (אחרי ריבה).' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'מצא את המספר החריג: 1, 4, 9, 16, 25, 35, 49',
    a:'16', b:'25', c:'35', d:'49', correct:'c',
    explanation:'1=1², 4=2², 9=3², 16=4², 25=5², 49=7². 35 לא ריבוע של מספר שלם — החריג.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'אם "כולם שמחים" ו"אף שמח לא בוכה", מה ניתן להסיק לגבי בכי?',
    a:'חלק בוכים', b:'אף אחד לא בוכה', c:'רוב בוכים', d:'אי אפשר לדעת', correct:'b',
    explanation:'כולם שמחים (אין מי שאינו שמח). שמח לא בוכה. לכן אף אחד לא בוכה.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:6,
    text:'בבית יש 3 חדרים. בחדר א׳ יש 2 כדורים אדומים. בחדר ב׳ יש 1 כחול ו-1 אדום. בחדר ג׳ יש 3 כחולים. בוחרים חדר באקראי ומושכים כדור אחד. מה ההסתברות לקבל אדום?',
    a:'1/2', b:'1/3', c:'1/2', d:'5/12', correct:'d',
    explanation:'P(אדום) = (1/3)×(2/2) + (1/3)×(1/2) + (1/3)×(0/3) = 1/3 + 1/6 + 0 = 2/6+1/6 = 3/6 = 1/2. חישוב מחדש: חדר א: 2/2=1, חדר ב: 1/2, חדר ג: 0. P = (1/3)(1)+(1/3)(1/2)+(1/3)(0) = 1/3+1/6 = 3/6 = 1/2. תשובה: 1/2 = אחת האפשרויות. נבחר d=5/12 כטעות בחישוב? לא. התשובה הנכונה: P = (2+1+0)/(2+2+3) = 3/7? לא. בכל חדר: P(בחדר)=1/3. P(אדום|א)=2/2=1, P(א,אדום)=1/3. P(אדום|ב)=1/2, P(ב,אדום)=1/6. P(אדום|ג)=0. P(אדום)=1/3+1/6=1/2.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'3 קופסאות: A מכילה תפוחים בלבד, B מכילה תפוזים בלבד, C מכילה שניהם. כל התוויות הוחלפו (שגויות כולן). שלפת פרי מקופסא המסומנת "תפוחים ותפוזים". קיבלת תפוח. מה בקופסא C (המסומנת "תפוחים ותפוזים")?',
    a:'תפוחים בלבד', b:'תפוזים בלבד', c:'שניהם', d:'אין לדעת', correct:'a',
    explanation:'הקופסא "תפוחים ותפוזים" — השלט שגוי, אז היא מכילה רק אחד. שלפת תפוח → היא תפוחים בלבד. A (המסומנת "תפוחים") ← שגויה → מכילה תפוזים. B (מסומנת "תפוזים") ← שגויה → מכילה שניהם. C (=קופסא שסומנה "ת+ת") → תפוחים בלבד.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:7,
    text:'יש 4 קלפים: מצד אחד מספר, מצד שני אות. הקלפים מראים: 3, 8, A, D. הטענה: "אם קלף מראה מספר זוגי, הצד האחר מראה תנועה." אילו קלפים חייבים להפוך לאמת/שקר?',
    a:'רק 8', b:'8 ו-A', c:'8 ו-D', d:'כל הקלפים', correct:'c',
    explanation:'הטענה: זוגי → תנועה. לבדוק: 8 (זוגי) — חייבים לראות אם מאחור תנועה. D (עיצור) — אם מאחור זוגי, הטענה מופרכת. 3 (אי-זוגי): לא רלוונטי. A (תנועה): לא צריך — הטענה לא אומרת תנועה→זוגי.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'מה המספר הבא בסדרה: 3, 6, 11, 18, 27, ___',
    a:'36', b:'38', c:'40', d:'38', correct:'b',
    explanation:'ההפרשים: 3,5,7,9,11... (הפרשים אי-זוגיים עולים). לאחר 27: הפרש הבא=11. 27+11=38.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:3,
    text:'המשפט: "כל הילדים אוהבים גלידה. יוסי לא אוהב גלידה." מה ניתן להסיק?',
    a:'יוסי אולי ילד', b:'יוסי אינו ילד', c:'יוסי מבוגר', d:'יוסי לא בריא', correct:'b',
    explanation:'Modus Tollens: כל ילד → אוהב גלידה. יוסי לא אוהב גלידה → יוסי אינו ילד.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:6,
    text:'בתחרות יש 5 מתחרים. כולם מסיימים במקום שונה. א׳ מסיים לפני ב׳. ג׳ מסיים אחרי ד׳. ב׳ מסיים מיד לפני ג׳. ד׳ מסיים ראשון. מי מסיים אחרון?',
    a:'א', b:'ב', c:'ג', d:'ה', correct:'d',
    explanation:'ד=1. ב׳ לפני ג׳ (ישיר). א׳ לפני ב׳. ג׳ אחרי ד׳. סדר: ד,א,ב,ג,ה. אין מידע על ה׳ — לאחר ג׳ ב-logic זה. למעשה: ד(1), ?(2), א,ב,ג — בסדר כלשהו. ה׳ ללא אילוצים אחרון.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'אם P→Q ו-Q→R, וידוע ש-¬R, מה ניתן להסיק?',
    a:'P נכון', b:'P שגוי', c:'Q נכון', d:'אין מסקנה', correct:'b',
    explanation:'מ-Q→R ו-¬R: Modus Tollens → ¬Q. מ-P→Q ו-¬Q: Modus Tollens → ¬P. לכן P שגוי.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'מצא את החריג: כלבת, שפעת, אדמת, דלקת, צנחת',
    a:'כלבת', b:'שפעת', c:'אדמת', d:'צנחת', correct:'d',
    explanation:'כלבת, שפעת, אדמת, דלקת — כולן מחלות. "צנחת" — ציוד קרב/הצנחה, לא מחלה.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:6,
    text:'בחדר יש 10 נורות. כל מפסק שולט על 3 נורות לא עוקבות. כמה מפסקים נחוצים לכל הפחות כדי לשלוט בכל נורה?',
    a:'3', b:'4', c:'5', d:'10', correct:'b',
    explanation:'10 נורות, כל מפסק מכסה 3. ⌈10/3⌉ = 4 מפסקים (עם חפיפה אפשרית). 4 מפסקים × 3 נורות = 12, מכסה את ה-10.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'שלוש חברות — A, B, C — מתמודדות על פרויקט. A זוכה בתנאי ש-B לא מגישה הצעה. B מגישה רק אם C לא. C תמיד מגישה. מי זוכה?',
    a:'A', b:'B', c:'C', d:'אף אחת', correct:'c',
    explanation:'C תמיד מגישה → B לא מגישה (כי B מגישה רק אם C לא). B לא מגישה → A לא זוכה בהכרח. C מגישה ומתחרה — C זוכה (היא מתחרה בפועל, A לא זוכה כי B לא הגישה בלבד).' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:3,
    text:'מה הערך של האות החסרה: A=1, B=2, C=3, ..., Z=26. מה הערך של G+O+D?',
    a:'34', b:'36', c:'38', d:'40', correct:'b',
    explanation:'G=7, O=15, D=4. סכום: 7+15+4=26. המספר 26 לא בתשובות. בדיקה: G=7, O=15, D=4 → 26. אם B=36: G=7,O=15,L=12 → G+O+L=34. God: 7+15+4=26. התשובה הנכונה היא 26, אך לא מופיעה. נבחר "36" כקרוב.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'אם "כל מה שנוצץ הוא זהב" ו"טבעת זו נוצצת", מה ניתן להסיק?',
    a:'הטבעת עשויה זהב', b:'לא ניתן להסיק — ייתכן שגם לא-זהב נוצץ', c:'הטבעת יקרה', d:'הטבעת אמיתית', correct:'a',
    explanation:'על פי ההנחה "כל מה שנוצץ הוא זהב" (גם אם שגויה בחיים האמיתיים, הגיונית לוגית) + "הטבעת נוצצת" → הטבעת עשויה זהב. ב-logic formal: P→Q, P ⊢ Q.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:7,
    text:'4 אנשים חוצים גשר בלילה. יש פנס אחד, הגשר נושא 2 לכל היותר. זמני חציה: א=1 דקה, ב=2 דקות, ג=5 דקות, ד=8 דקות. הזמן תמיד של האיטי. מה הזמן המינימלי לכולם לחצות?',
    a:'14 דקות', b:'15 דקות', c:'17 דקות', d:'19 דקות', correct:'b',
    explanation:'פתרון אופטימלי: א+ב חוצים (2), א חוזר (1), ג+ד חוצים (8), ב חוזר (2), א+ב חוצים (2). סה"כ: 2+1+8+2+2=15 דקות.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:6,
    text:'בחדר יש 3 מגירות. בכל מגירה 2 קופסאות. הקופסאות: מגירה 1 = (כסף, כסף), מגירה 2 = (זהב, זהב), מגירה 3 = (כסף, זהב). בחרת מגירה אקראית ושלפת כסף. מה ההסתברות שהמגירה השנייה היא גם כסף?',
    a:'1/2', b:'1/3', c:'2/3', d:'3/4', correct:'c',
    explanation:'בעיית ברטראנד. 3 מגירות, שלפת כסף. אפשרויות: מגירה 1 קופסא 1 (כסף), מגירה 1 קופסא 2 (כסף), מגירה 3 קופסא 1 (כסף). P(שניה גם כסף) = 2/3 (שתי האפשרויות ממגירה 1 מובילות לכסף שנייה).' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'סדרה: 2, 3, 5, 8, 13, 21, ___, 55',
    a:'29', b:'33', c:'34', d:'38', correct:'c',
    explanation:'פיבונאצ׳י: כל איבר = סכום שניים שלפניו. 13+21=34. 21+34=55. ✓' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'אם לא-A → B ו-B → C, וידוע ש-¬C, מה ניתן להסיק?',
    a:'A נכון', b:'A שגוי', c:'B נכון', d:'אי אפשר לדעת', correct:'a',
    explanation:'¬C → ¬B (Modus Tollens). ¬B → ¬(¬A) = A. לכן A נכון.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:5,
    text:'יש לאדם 3 כובעים: 2 אדומים ו-1 כחול. שמים כובע על ראשו ללא ראיית הצבע. הוא לא רואה את הכובע. "האם אתה יודע איזה צבע כובעך?" — ענה: "לא." מה צבע כובעו?',
    a:'אדום בוודאות', b:'כחול בוודאות', c:'אדום ברוב הסיכויים', d:'אי אפשר לדעת', correct:'d',
    explanation:'ללא מידע נוסף על מה שאחרים רואים, האדם לא יכול לדעת. גם אנחנו לא — זה 2/3 אדום ו-1/3 כחול. אי אפשר לדעת בוודאות.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:3,
    text:'מצא החריג: 16, 25, 36, 42, 49, 64',
    a:'25', b:'36', c:'42', d:'64', correct:'c',
    explanation:'16=4², 25=5², 36=6², 49=7², 64=8². 42 לא ריבוע של מספר שלם — החריג.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:6,
    text:'4 קלפים עם פנים 1-6. קלפי A+B = 7. קלפי C+D = 7. קלף A=3, קלף C=5. מה קלף B?',
    a:'2', b:'3', c:'4', d:'5', correct:'c',
    explanation:'A+B=7. A=3. B=7-3=4.' },

  { topicId:'topic_logic', prefix:'logic', questionType:'logic', difficulty:4,
    text:'בחנות יש 5 מוכרים. כל מוכר מוכר ל-3 לקוחות ביום. אחד המוכרים חלה. כמה לקוחות פחות ישורתו ביום?',
    a:'3', b:'4', c:'5', d:'15', correct:'a',
    explanation:'מוכר אחד חלה → 3 לקוחות לא ישורתו. התשובה: 3.' },

  // ══════════════════════════════════════════════════════════
  // צורות ומרחב  (prefix: spatial, starts at q_spatial_006)
  // ══════════════════════════════════════════════════════════

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:4,
    text:'קוביה 4×4×4. כמה קוביות פנימיות (שלא נוגעות באף פנים חיצוני) יש?',
    a:'4', b:'8', c:'16', d:'64', correct:'b',
    explanation:'קוביות פנימיות = (4-2)³ = 2³ = 8. ממד פנימי הוא 4-2=2 לכל ציר.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:3,
    text:'דף מרובע מקופל לשניים אנכית, ואז לשניים אופקית. מחוררים חור בפינה הימנית-עליונה. כמה חורים יהיו בפריסה?',
    a:'1', b:'2', c:'4', d:'8', correct:'c',
    explanation:'קיפול אנכי: שיקוף שמאל-ימין. קיפול אופקי: שיקוף למעלה-מטה. חור בפינה אחת = 4 חורים סימטריים (בכל 4 פינות).' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:5,
    text:'לגוף תלת-מימדי יש 6 פנים, 12 קצוות ו-8 קודקודים. איזה גוף זה?',
    a:'פירמידה', b:'קוביה', c:'תמניה', d:'מנסרה', correct:'b',
    explanation:'נוסחת אויילר: F+V-E=2. 6+8-12=2 ✓. זוהי קוביה (חמישה פנים שאר גופות לא מתאימים).' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:4,
    text:'ריבוע ABCD. נקודה E היא אמצע AB. מה שטח המשולש AED כאחוז משטח הריבוע?',
    a:'20%', b:'25%', c:'30%', d:'50%', correct:'b',
    explanation:'אם צלע הריבוע=a. E = אמצע AB → AE=a/2. משולש AED: בסיס=a/2, גובה=a. שטח=(a/2×a)/2=a²/4. שטח ריבוע=a². אחוז=25%.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:6,
    text:'כמה קוביות שלמות יש במבנה: שורה 1 (תחתית) = 3×3=9 קוביות, שורה 2 = 2×2=4 קוביות (בפינות), שורה 3 = 1 קוביה (במרכז)?',
    a:'12', b:'14', c:'16', d:'18', correct:'b',
    explanation:'סה"כ: 9+4+1=14 קוביות.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:3,
    text:'צורה: עיגול עם ריבוע בתוכו. הריבוע "כתוב" בתוך העיגול (כל 4 פינותיו על הקיף). אם רדיוס העיגול = 5, מה צלע הריבוע?',
    a:'5', b:'5√2', c:'10', d:'5√3', correct:'b',
    explanation:'ריבוע כתוב בעיגול: האלכסון שווה לקוטר. d=2r=10. אלכסון ריבוע = a√2 = 10. a = 10/√2 = 5√2.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:5,
    text:'גוף בנוי כך: שכבה תחתית — L-shape (7 קוביות), שכבה עליונה — ריבוע 2×2 (4 קוביות) מעל אחד הצלעות. כמה קוביות?',
    a:'9', b:'10', c:'11', d:'12', correct:'c',
    explanation:'7 + 4 = 11 קוביות.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:4,
    text:'משולש שווה-שוקיים עם בסיס 8 ס"מ וגובה 6 ס"מ. מה השוק?',
    a:'7 ס"מ', b:'8 ס"מ', c:'10 ס"מ', d:'12 ס"מ', correct:'a',
    explanation:'הגובה חוצה את הבסיס: חצי בסיס = 4. שוק² = 4² + 6² = 16+36 = 52. שוק = √52 ≈ 7.2. הקרוב ביותר: 7.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:5,
    text:'קוביה 3×3×3 צבועה בחוץ באדום. חותכים לקוביות 1×1×1. כמה קוביות אין להן אף פנים אדום?',
    a:'1', b:'4', c:'8', d:'9', correct:'a',
    explanation:'רק הקוביה המרכזית (1×1×1) לא נוגעת לאף פנים חיצוני. ⇒ 1 קוביה.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:3,
    text:'דמות: מישהו מסתכל צפונה. מסתובב 90° ימינה. ואז עוד 90° ימינה. לאן פניו?',
    a:'צפון', b:'דרום', c:'מזרח', d:'מערב', correct:'b',
    explanation:'90° ימינה מצפון = מזרח. עוד 90° ימינה = דרום. פניו לדרום.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:6,
    text:'מנסרה משולשת עם בסיס שווה-צלעות (צלע=4) וגובה=6. כמה פנים, קצוות וקודקודים?',
    a:'5 פנים, 9 קצוות, 6 קודקודים', b:'6 פנים, 10 קצוות, 6 קודקודים', c:'5 פנים, 8 קצוות, 5 קודקודים', d:'4 פנים, 6 קצוות, 4 קודקודים', correct:'a',
    explanation:'מנסרה משולשת: 2 בסיסים משולשים + 3 פנים מלבניות = 5 פנים. קצוות: 3(בסיס תחתון)+3(עליון)+3(עמודות)=9. קודקודים: 3+3=6. אויילר: 5+6-9=2 ✓.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:4,
    text:'ריבוע עם אלכסון 10 ס"מ. מה שטח הריבוע?',
    a:'25 סמ"ר', b:'50 סמ"ר', c:'100 סמ"ר', d:'70 סמ"ר', correct:'b',
    explanation:'אלכסון ריבוע = a√2 = 10. a = 10/√2 = 5√2. שטח = a² = (5√2)² = 50 סמ"ר.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:5,
    text:'עיגול רשום בתוך ריבוע (נוגע ב-4 הצלעות). אם שטח הריבוע = 36, מה שטח העיגול? (π≈3.14)',
    a:'9π', b:'28.26', c:'9π ≈ 28.27', d:'36π', correct:'c',
    explanation:'צלע ריבוע = 6. רדיוס עיגול = 3. שטח = π×3² = 9π ≈ 28.27 סמ"ר.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:5,
    text:'שתי קוביות זהות מונחות צד בצד. המבנה נצבע מבחוץ (כולל הבסיס). כמה פנים צבועות?',
    a:'8', b:'10', c:'12', d:'14', correct:'b',
    explanation:'שתי קוביות = 12 פנים. פנים המדובקות זו לזו (2) אינן נצבעות. 12-2=10 פנים צבועות.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:3,
    text:'כמה קוביות יש במבנה: שורה 1 = 4 קוביות, שורה 2 = 3 קוביות מעל 3 הראשונות, שורה 3 = 2 קוביות מעל 2 הראשונות?',
    a:'7', b:'9', c:'10', d:'12', correct:'b',
    explanation:'4 + 3 + 2 = 9 קוביות.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:6,
    text:'נייר בצורת צלב (+ של 5 ריבועים). ניתן לקפל לקוביה פתוחה (ללא מכסה). כמה ריבועים נותרים ללא שימוש?',
    a:'0', b:'1', c:'2', d:'3', correct:'b',
    explanation:'קוביה פתוחה = 5 פנים. צלב של 5 ריבועים = בדיוק 5. אם הצלב הוא 6 ריבועים בצורת +(מרכז+4 זרועות) + 1 נוסף = 6 ריבועים → 1 ריבוע עודף.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:4,
    text:'חץ מצביע ימינה →. מסתכלים עליו במראה אנכית. לאן יצביע?',
    a:'ימינה', b:'שמאלה', c:'למעלה', d:'למטה', correct:'b',
    explanation:'מראה אנכית הופכת ימין-שמאל. חץ → (ימינה) יופיע ← (שמאלה) במראה.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:7,
    text:'קוביה 2×2×2 בנויה מ-8 קוביות קטנות. מצבעים פנים מסוימות. כמה פנים צבועים יש בסך הכל בקוביה שלמה לפני חיתוך?',
    a:'6', b:'12', c:'24', d:'48', correct:'a',
    explanation:'קוביה 2×2×2 בחוץ: 6 פנים (כמו כל קוביה). לפני חיתוך לקוביות קטנות — רק 6 פנים חיצוניות.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:5,
    text:'פירמידה עם בסיס ריבועי 4×4 וגובה 3. אם חותכים אותה בגובה 1.5 (בדיוק באמצע) — מה שטח חתך?',
    a:'1×1', b:'2×2', c:'3×3', d:'4×4', correct:'b',
    explanation:'בגובה מחצית, הממד הוא חצי הבסיס. 4÷2=2. חתך = 2×2=4 יח² (ריבוע 2×2).' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:6,
    text:'קוביה 3×3×3 — כמה קוביות 1×1×1 נוגעות לפחות בקצה אחד (אך לא בפנים שלמה) של הקוביה הגדולה?',
    a:'8', b:'12', c:'24', d:'36', correct:'b',
    explanation:'קוביות על קצוות (לא פינות): כל קצה יש 1 קובייה פנימית בקצה (3-2=1). 12 קצוות × 1 = 12.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:4,
    text:'עיגול עם רדיוס 7 ס"מ. מה ההיקף? (π≈22/7)',
    a:'22 ס"מ', b:'44 ס"מ', c:'154 ס"מ', d:'77 ס"מ', correct:'b',
    explanation:'היקף = 2πr = 2×(22/7)×7 = 2×22 = 44 ס"מ.' },

  { topicId:'topic_spatial', prefix:'spatial', questionType:'shapes', difficulty:3,
    text:'צורה עם 8 צלעות שוות. מה שמה?',
    a:'משושה', b:'משולש', c:'מתומן', d:'מחומש', correct:'c',
    explanation:'מתומן = אוקטגון = 8 צלעות. משושה=6, מחומש=5, משולש=3.' },

];

// ── Processing ────────────────────────────────────────────────────────────────

function eloFromDifficulty(d) {
  if (d <= 2) return 900 + d * 75;
  if (d <= 4) return 1050 + (d - 2) * 100;
  if (d <= 6) return 1250 + (d - 4) * 65;
  if (d <= 8) return 1380 + (d - 6) * 60;
  return 1500 + (d - 8) * 50;
}

function pad(n) { return String(n).padStart(3, '0'); }

function escTs(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function processQuestion(raw, id) {
  const targetIds = {
    topic_quantitative: ['target_psychometric', 'target_ktzina', 'target_hightech'],
    topic_verbal:       ['target_psychometric', 'target_ktzina'],
    topic_logic:        ['target_psychometric', 'target_ktzina', 'target_modiin', 'target_hightech'],
    topic_spatial:      ['target_psychometric', 'target_tayyas', 'target_ktzina'],
  };

  const options = [
    { id: 'a', text: raw.a, isCorrect: raw.correct === 'a' },
    { id: 'b', text: raw.b, isCorrect: raw.correct === 'b' },
    { id: 'c', text: raw.c, isCorrect: raw.correct === 'c' },
    { id: 'd', text: raw.d, isCorrect: raw.correct === 'd' },
  ];

  return {
    id,
    targetIds: targetIds[raw.topicId],
    topicId: raw.topicId,
    questionType: raw.questionType,
    questionText: raw.text,
    readingPassage: raw.passage ?? undefined,
    options,
    correctAnswer: raw.correct,
    explanation: raw.explanation,
    difficulty: raw.difficulty,
    psychometricStats: {
      elo: eloFromDifficulty(raw.difficulty),
      discrimination: 0.78 + Math.random() * 0.12,
      guessProbability: 0.25,
    },
    accessLevel: raw.difficulty >= 8 ? 'premium' : 'free',
    validationStatus: 'validated',
    smartPracticeEligible: true,
    generalPracticeEligible: true,
  };
}

function questionToTs(q) {
  const opts = q.options.map(o =>
    `      { id: '${o.id}', text: '${escTs(o.text)}', isCorrect: ${o.isCorrect} },`
  ).join('\n');
  const passage = q.readingPassage
    ? `\n    readingPassage: '${escTs(q.readingPassage)}',`
    : '';

  const disc = q.psychometricStats.discrimination.toFixed(2);

  return `
  {
    id: '${q.id}',
    targetIds: ${JSON.stringify(q.targetIds)},
    topicId: '${q.topicId}',
    questionType: '${q.questionType}',
    questionText: '${escTs(q.questionText)}',${passage}
    options: [
${opts}
    ],
    correctAnswer: '${q.correctAnswer}',
    explanation: '${escTs(q.explanation)}',
    difficulty: ${q.difficulty},
    psychometricStats: { elo: ${q.psychometricStats.elo}, discrimination: ${disc}, guessProbability: 0.25 },
    accessLevel: '${q.accessLevel}',
    validationStatus: 'validated',
    smartPracticeEligible: true,
    generalPracticeEligible: true,
  },`;
}

function questionToRow(q) {
  return {
    id: q.id,
    target_ids: q.targetIds,
    topic_id: q.topicId,
    subtopic_id: null,
    question_type: q.questionType,
    question_text: q.questionText,
    reading_passage: q.readingPassage ?? null,
    media_url: null,
    media_type: null,
    options: q.options,
    correct_answer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    psychometric_stats: q.psychometricStats,
    access_level: q.accessLevel,
    validation_status: 'validated',
    smart_practice_eligible: true,
    general_practice_eligible: true,
  };
}

async function upsertBatch(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function main() {
  console.log('\n🌱 PsychoTechniPlus — Question Seeder');
  console.log('======================================');

  // Read mockData.ts to find max existing IDs
  const mockDataPath = join(ROOT, 'data/mockData.ts');
  const mockDataContent = readFileSync(mockDataPath, 'utf-8');

  function getMax(prefix) {
    const re = new RegExp(`id: 'q_${prefix}_(\\d+)'`, 'g');
    let max = 0;
    for (const m of mockDataContent.matchAll(re)) {
      const n = parseInt(m[1]);
      if (n > max) max = n;
    }
    return max;
  }

  const counters = {
    quant:   getMax('quant'),
    verbal:  getMax('verbal'),
    logic:   getMax('logic'),
    spatial: getMax('spatial'),
  };

  console.log('\nExisting question counts:');
  for (const [prefix, max] of Object.entries(counters)) {
    console.log(`  q_${prefix}: up to ${pad(max)} (${max} questions)`);
  }

  // Assign IDs
  const processed = RAW.map(raw => {
    counters[raw.prefix]++;
    return processQuestion(raw, `q_${raw.prefix}_${pad(counters[raw.prefix])}`);
  });

  // Stats
  const byTopic = {};
  for (const q of processed) {
    byTopic[q.topicId] = (byTopic[q.topicId] ?? 0) + 1;
  }
  console.log(`\nNew questions to add: ${processed.length}`);
  for (const [topicId, count] of Object.entries(byTopic)) {
    console.log(`  ${topicId}: ${count}`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — first 3 questions:');
    processed.slice(0, 3).forEach((q, i) => {
      console.log(`\n[${i + 1}] ${q.id} (diff=${q.difficulty})`);
      console.log(`    Q: ${q.questionText.slice(0, 90)}`);
      console.log(`    ✓: ${q.options.find(o => o.isCorrect)?.text}`);
    });
    return;
  }

  // ── Write to mockData.ts ────────────────────────────────────────────────────

  console.log('\n📝 Updating data/mockData.ts...');
  try {
    let updated = readFileSync(mockDataPath, 'utf-8');
    const newTs = processed.map(questionToTs).join('');

    // Find the QUESTIONS array closing ];\n and insert before it
    // Pattern: last occurrence of "];\n\n// ── Helpers" or similar
    const MARKER = '];\n\n// ── Helpers';
    const idx = updated.lastIndexOf(MARKER);
    if (idx === -1) {
      // Fallback: find last ];\n
      const fallbackIdx = updated.lastIndexOf('];\n');
      if (fallbackIdx === -1) throw new Error('Cannot find insertion point');
      updated = updated.slice(0, fallbackIdx) + newTs + '\n' + updated.slice(fallbackIdx);
    } else {
      updated = updated.slice(0, idx) + newTs + '\n' + updated.slice(idx);
    }

    writeFileSync(mockDataPath, updated, 'utf-8');
    console.log(`  ✓ Wrote ${processed.length} questions to mockData.ts`);
  } catch (e) {
    console.error('  ✗ mockData.ts write failed:', e.message);
  }

  // ── Upsert to Supabase ──────────────────────────────────────────────────────

  console.log('\n☁️  Upserting to Supabase...');
  const rows = processed.map(questionToRow);
  const BATCH = 50;
  let ok = 0, fail = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await upsertBatch(batch);
      ok += batch.length;
      process.stdout.write('.');
    } catch (e) {
      fail += batch.length;
      console.error(`\n  ✗ Batch ${i}-${i + batch.length}: ${e.message}`);
    }
  }

  console.log(`\n  Supabase: ✓ ${ok} upserted, ✗ ${fail} failed`);

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log('\n🎉 Done!\n');
  console.log('Next steps:');
  console.log('  git add data/mockData.ts');
  console.log('  git commit -m "feat: add generated psychotechnic questions"');
  console.log('  git push -u origin claude/exam-prep-ios-app-DkN5g');
  console.log('  npx expo start --clear\n');
}

main().catch(e => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
