type ConstructionDomain = 'verbal' | 'logic' | 'numeric' | 'spatial';
type Common = Readonly<{
  id: string;
  domain: ConstructionDomain;
  label: string;
  prompt: string;
  explanation: string;
}>;
export type ConstructionItem =
  | (Common & Readonly<{ type: 'order'; options: readonly string[]; correct: readonly number[] }>)
  | (Common & Readonly<{ type: 'set'; options: readonly string[]; correct: readonly number[] }>)
  | (Common & Readonly<{ type: 'grid'; side: 3 | 4; source?: readonly number[]; correct: readonly number[] }>)
  | (Common & Readonly<{ type: 'number'; correct: number }>);

function select(type: 'order' | 'set', id: string, domain: ConstructionDomain, label: string, prompt: string,
  options: readonly string[], correct: readonly number[], explanation: string): ConstructionItem {
  return { type, id, domain, label, prompt, options, correct, explanation };
}

const procedures = [
  select('order','build-process-1','verbal','סידור שלבים',
    'סדרו את השלבים לפי התלויות: אישור ניתן אחרי בדיקה; שולחים הודעה רק אחרי אישור; הבדיקה מתחילה אחרי קליטת הטופס.',
    ['שליחת הודעה','בדיקת הטופס','אישור הטופס','קליטת הטופס'],[3,1,2,0],
    'הטופס צריך להיקלט לפני שאפשר לבדוק אותו; האישור מגיע בעקבות הבדיקה, ורק אחריו שולחים הודעה.'),
  select('order','build-process-2','verbal','סידור שלבים',
    'סדרו מחדש: מגישים רק אחרי ניסוח הגרסה הסופית; מנסחים אותה אחרי קבלת משוב; את המשוב מקבלים אחרי שליחת טיוטה.',
    ['קבלת משוב','הגשה','שליחת טיוטה','ניסוח סופי'],[2,0,3,1],
    'כל שלב מספק את הקלט לשלב הבא: טיוטה, משוב, ניסוח סופי והגשה.'),
  select('order','build-process-3','verbal','סידור שלבים',
    'סדרו לפי הכללים: מתקינים עדכון רק לאחר גיבוי; מבצעים בדיקת תקינות לאחר ההתקנה; מודיעים על הצלחה רק אחרי בדיקת התקינות.',
    ['הודעה על הצלחה','גיבוי','בדיקת תקינות','התקנה'],[1,3,2,0],
    'הגיבוי מקדים את ההתקנה. את ההתקנה בודקים לפני שמכריזים שהיא הצליחה.'),
  select('order','build-process-4','verbal','סידור שלבים',
    'סדרו את העבודה: מקודדים את התשובות אחרי איסוף הטפסים; עורכים את הדוח אחרי חישוב הסיכומים; מחשבים את הסיכומים רק אחרי קידוד כל התשובות.',
    ['חישוב סיכומים','איסוף טפסים','עריכת דוח','קידוד תשובות'],[1,3,0,2],
    'איסוף הטפסים מאפשר קידוד; רק אז אפשר לחשב סיכומים ולערוך את הדוח.'),
];

function constraints(id: string, options: readonly string[], rules: string, correct: readonly number[], explanation: string) {
  return select('order',id,'logic','סידור לפי אילוצים',`סדרו מהעמדה הראשונה לאחרונה, פריט אחד בכל עמדה. ${rules}`,options,correct,explanation);
}
const precedence = [
  constraints('build-constraint-1',['לבנה','שחורה','כחולה','צהובה','ירוקה'],
    'צהובה ראשונה. ירוקה מיד אחרי לבנה. כחולה אחרונה. שחורה אחרי ירוקה.',[3,0,4,1,2],
    'צהובה וכחולה בקצוות. לבנה וירוקה צמודות, ושחורה אחריהן, ולכן שלוש העמדות האמצעיות נקבעות.'),
  constraints('build-constraint-2',['גילי','מאיה','דניאל','שלי','עומר'],
    'עומר אחרון. שלי מיד לפני מאיה. דניאל ראשון. גילי לפני שלי.',[2,0,3,1,4],
    'דניאל ראשון ועומר אחרון. גילי חייב להיות לפני הצמד שלי–מאיה, ולכן הוא בעמדה השנייה.'),
  constraints('build-constraint-3',['ארז','לביא','סלע','אלון','ברוש'],
    'ארז בעמדה השלישית. סלע אחרון. אלון לפני ברוש. לביא אחרי ארז.',[3,4,0,1,2],
    'אחרי ארז יש רק עמדה אחת פנויה לפני סלע, ולכן לביא רביעי. נשארות שתי העמדות הראשונות לאלון ואז לברוש.'),
  constraints('build-constraint-4',['מזרח','מערב','צפון','דרום','מרכז'],
    'דרום בדיוק באמצע. מזרח מיד אחרי צפון. מרכז ראשון. מערב לפני דרום.',[4,1,3,2,0],
    'מרכז ראשון ודרום שלישי. מערב לפני דרום ולכן שני. צפון ומזרח ממלאים את עמדות 4 ו־5 בסדר הזה.'),
];

function matching(id: string, slots: readonly number[], options: readonly number[], correct: readonly number[]) {
  return select('order',id,'numeric','שיוך לפי כלל',
    `מספרי העמדות, לפי הסדר: ${slots.join(', ')}. שייכו לכל עמדה כרטיס שערכו הוא פעמיים מספר העמדה ועוד 3. יש להשתמש בכל כרטיס פעם אחת.`,
    options.map(String), correct,
    `מחשבים לכל עמדה 2 כפול הערך ועוד 3. סדר הכרטיסים הוא ${slots.map(n=>2*n+3).join(', ')}.`);
}
const matches = [
  matching('build-match-1',[4,2,5,1],[5,13,7,11],[3,2,1,0]),
  matching('build-match-2',[9,0,6,3,2],[9,3,21,7,15],[2,1,4,0,3]),
  matching('build-match-3',[-2,5,7,0],[17,3,-1,13],[2,3,0,1]),
  matching('build-match-4',[1,8,-1,4,6],[1,15,19,11,5],[4,2,0,3,1]),
];

const comprehension = [
  select('set','build-set-1','verbal','בחירה לפי תנאים',
    'לפי ההודעה, ״דוח מתקבל אם ורק אם הוא חתום והוגש לא יאוחר מיום רביעי״. סמנו את כל הדוחות שמתקבלים.',
    ['חתום, יום שני','לא חתום, יום שלישי','חתום, יום רביעי','חתום, יום חמישי','לא חתום, יום רביעי'],[0,2],
    'יום רביעי עצמו אינו אחריו. שני הדוחות החתומים שהוגשו עד אז מתקבלים; חתימה אינה מספיקה ביום חמישי.'),
  select('set','build-set-2','verbal','בחירה לפי תנאים',
    'הודעת המחסן: ״משלוח חייב קירור אם הוא מכיל פירות רכים או קינוח חלבי, אלא אם כל תכולתו קפואה״. סמנו כל משלוח שחייב קירור לפי ההודעה.',
    ['תותים וקינוח חלבי שאינם קפואים','לחם בלבד','קינוחים חלביים, כולם קפואים','תותים טריים בלבד','אורז יבש ופסטה בלבד'],[0,3],
    'התותים הטריים והקינוח הלא קפוא מפעילים את הכלל. משלוח שכל תכולתו קפואה הוא החריג.'),
  select('set','build-set-3','verbal','בחירה לפי תנאים',
    '״נרשמים שלא אישרו הגעה אינם מורשים להיכנס; מי שאישרו יכולים להיכנס גם בלי להזדהות. מי שאינם רשומים רשאים להיכנס אם אישרו הגעה והזדהו, ונדחים בכל מקרה אחר״. סמנו את כל מי שרשאים להיכנס.',
    ['רשומה, אישרה והזדהתה','רשום, אישר ולא הזדהה','לא רשומה, אישרה ולא הזדהתה','לא רשום, אישר והזדהה','רשומה, לא אישרה והזדהתה'],[0,1,3],
    'לנרשמים מספיק אישור הגעה. למי שלא נרשמו צריך גם אישור הגעה וגם הזדהות.'),
  select('set','build-set-4','verbal','בחירה לפי תנאים',
    '״טיוטה קצרה מתקבלת אם יש בה מקורות ונדחית אם אין בה מקורות. טיוטה שאינה קצרה מתקבלת אם יש בה מקורות או אם צורף לה אישור, ונדחית אם אין בה אף אחד מהם״. סמנו כל טיוטה שמתקבלת לפי הכלל.',
    ['קצרה, יש מקורות, אין אישור','קצרה, אין מקורות, יש אישור','ארוכה, אין מקורות, יש אישור','ארוכה, אין מקורות ואין אישור','ארוכה, יש מקורות ויש אישור'],[0,2,4],
    'טיוטה קצרה צריכה מקורות; בטיוטה ארוכה די באחת משתי הדרישות. אם שתיהן מתקיימות הטיוטה מתקבלת גם כן.'),
];

type Movement = 'clockwise' | 'mirror' | 'halfTurn';
function reconstruct(id:string, side:3|4, source:readonly number[], move:Movement): ConstructionItem {
  const wording = {clockwise:'רבע סיבוב בכיוון השעון',mirror:'שיקוף אופקי שבו ימין ושמאל מתחלפים',halfTurn:'חצי סיבוב סביב מרכז הלוח'}[move];
  const correct = source.map(i=>{
    const r = Math.floor(i/side), c = i%side;
    if (move === 'clockwise') return c*side + side-1-r;
    if (move === 'mirror') return r*side + side-1-c;
    return side*side-1-i;
  }).sort((a,b)=>a-b);
  const cells = correct.map(i=>`שורה ${Math.floor(i/side)+1}, עמודה ${i%side+1}`).join('; ');
  return { type:'grid',id,domain:'spatial',label:'שחזור צורה',side,source,correct,
    prompt:`סמנו בלוח הריק בגודל ${side}×${side} רק את התאים שאליהם עוברים התאים המסומנים לאחר ${wording}. סופרים שורות מלמעלה ועמודות משמאל.`,
    explanation:`ממפים כל תא בנפרד לאחר ${wording}. התאים המתקבלים: ${cells}.` };
}
const rotations = [
  reconstruct('build-rotate-1',3,[0,3,8],'clockwise'),
  reconstruct('build-rotate-2',4,[0,5,7,9,12],'mirror'),
  reconstruct('build-rotate-3',3,[1,3,4,7],'halfTurn'),
  reconstruct('build-rotate-4',4,[1,4,5,11,14],'clockwise'),
];

function path(id:string,side:3|4,start:number,steps:readonly (readonly [number,number])[], movements:string):ConstructionItem {
  let row=Math.floor(start/side), column=start%side;
  const route=[start];
  for(const [dr,dc] of steps) { row+=dr; column+=dc; route.push(row*side+column); }
  return {type:'grid',id,domain:'spatial',label:'סימון מסלול',side,correct:[...new Set(route)].sort((a,b)=>a-b),
    prompt:`התחילו בשורה ${Math.floor(start/side)+1}, עמודה ${start%side+1} משמאל. ${movements}. סמנו את כל התאים שביקרתם בהם, כולל התא הראשון והאחרון. כל צעד הוא תא אחד.`,
    explanation:`לפי סדר הביקור (שורה, עמודה): ${route.map(i=>`(${Math.floor(i/side)+1}, ${i%side+1})`).join('; ')}. כל תא מסומן פעם אחת.`,
  };
}
const paths=[
  path('build-path-1',3,0,[[0,1],[1,0],[0,1],[1,0]],'צעד לימין, למטה, לימין ולמטה'),
  path('build-path-2',4,14,[[-1,0],[0,-1],[-1,0],[-1,0],[0,1]],'צעד למעלה, לשמאל, שני צעדים למעלה וצעד לימין'),
  path('build-path-3',3,4,[[0,1],[-1,0],[0,-1],[1,0],[1,0]],'צעד לימין, למעלה, לשמאל ושני צעדים למטה'),
  path('build-path-4',4,3,[[1,0],[1,0],[0,-1],[0,-1],[1,0],[0,-1]],'שני צעדים למטה, שניים לשמאל, צעד למטה וצעד לשמאל'),
];

const numbers: readonly ConstructionItem[]=[
  {type:'number',id:'build-number-1',domain:'numeric',label:'הקלדת תוצאה',correct:88,
    prompt:'מחיר התחלתי הוא 100 ₪. המחיר עלה ב־10% ואחר כך ירד ב־20% ממחירו לאחר העלייה. הקלידו את המחיר הסופי בשקלים, במספר בלבד.',
    explanation:'אחרי העלייה המחיר הוא 110 ₪. כפל ב־0.8 נותן 88 ₪. האחוזים מחושבים ממחירים שונים.'},
  {type:'number',id:'build-number-2',domain:'numeric',label:'הקלדת תוצאה',correct:7.5,
    prompt:'קראו שני קטעים במשך 6 ו־9 דקות. מה היה זמן הקריאה הממוצע לקטע בדקות? הקלידו מספר עשרוני לפי הצורך.',
    explanation:'שני הקטעים לקחו יחד 15 דקות. מחלקים בשניים ומקבלים 7.5 דקות לקטע.'},
  {type:'number',id:'build-number-3',domain:'numeric',label:'הקלדת תוצאה',correct:19,
    prompt:'מוסיפים למספר לא ידוע 7, מכפילים את התוצאה ב־3, ואז מחסרים 8. התקבל 70. הקלידו את המספר שממנו התחלנו.',
    explanation:'הופכים את סדר הפעולות: מוסיפים 8 ל־70, מחלקים ב־3 ומקבלים 26, ואז מחסרים 7 ומקבלים 19.'},
  {type:'number',id:'build-number-4',domain:'numeric',label:'הקלדת תוצאה',correct:24,
    prompt:'מתוך 40 אנשים, 27 דוברים אנגלית ו־29 דוברים צרפתית. 8 אנשים אינם דוברים אף אחת משתי השפות. כמה דוברים את שתיהן? הקלידו מספר בלבד.',
    explanation:'32 דוברים לפחות שפה אחת. בסכום 27 ועוד 29 הדוברים את שתיהן נספרו פעמיים; מחסרים 32 מ־56 ומקבלים 24.'},
];

export const constructionItems: readonly ConstructionItem[] = Array.from({length:4},(_,i)=>[
  procedures[i], precedence[i], rotations[i], matches[i], comprehension[i], numbers[i], paths[i],
]).flat();
