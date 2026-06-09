import { Question, QuestionType } from './types';

type GeneratedQuestionSeed = {
  topicId: string;
  prefix: string;
  questionType: QuestionType;
  questionText: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  difficulty: number;
  targetIds: string[];
  mediaUrl?: string;
};

const TOPIC_TARGETS: Record<string, string[]> = {
  topic_quantitative: ['target_psychometric', 'target_ktzina', 'target_hightech'],
  topic_verbal: ['target_psychometric', 'target_ktzina', 'target_modiin'],
  topic_logic: ['target_psychometric', 'target_ktzina', 'target_modiin', 'target_hightech'],
  topic_spatial: ['target_psychometric', 'target_tayyas', 'target_ktzina'],
};

function difficultyToElo(difficulty: number): number {
  return 900 + difficulty * 85;
}

function createQuestion(seed: GeneratedQuestionSeed, index: number): Question {
  const correctId = ['a', 'b', 'c', 'd'][seed.correctIndex];
  return {
    id: `q_exp_${seed.prefix}_${String(index + 1).padStart(3, '0')}`,
    targetIds: seed.targetIds,
    topicId: seed.topicId,
    questionType: seed.questionType,
    questionText: seed.questionText,
    mediaUrl: seed.mediaUrl,
    mediaType: seed.mediaUrl ? 'image' : undefined,
    options: seed.options.map((text, optionIndex) => ({
      id: ['a', 'b', 'c', 'd'][optionIndex],
      text,
      isCorrect: optionIndex === seed.correctIndex,
    })),
    correctAnswer: correctId,
    explanation: seed.explanation,
    difficulty: seed.difficulty,
    psychometricStats: {
      elo: difficultyToElo(seed.difficulty),
      discrimination: Number((0.72 + (seed.difficulty % 5) * 0.035).toFixed(2)),
      guessProbability: 0.25,
    },
    accessLevel: seed.difficulty >= 8 ? 'premium' : 'free',
    validationStatus: 'validated',
    smartPracticeEligible: true,
    generalPracticeEligible: true,
  };
}

function seriesQuestions(): GeneratedQuestionSeed[] {
  const patterns = [
    { start: 4, steps: [3, 5, 7, 9], answer: 28, rule: 'ההפרשים הם מספרים אי-זוגיים עוקבים: 3, 5, 7, 9.' },
    { start: 2, steps: [2, 4, 8, 16], answer: 32, rule: 'בכל צעד מכפילים את ההפרש פי 2.' },
    { start: 81, steps: [-9, -8, -7, -6], answer: 51, rule: 'ההפרשים יורדים: מינוס 9, מינוס 8, מינוס 7, מינוס 6.' },
    { start: 3, steps: [6, 12, 24, 48], answer: 93, rule: 'מוסיפים 6, 12, 24, 48 - ההפרש מוכפל פי 2.' },
    { start: 7, steps: [4, 8, 12, 16], answer: 47, rule: 'מוסיפים כפולות עולות של 4.' },
    { start: 96, steps: [-3, -6, -12, -24], answer: 51, rule: 'מחסרים 3, 6, 12, 24 - ההפרש מוכפל.' },
    { start: 5, steps: [5, 10, 20, 40], answer: 80, rule: 'כל הפרש כפול מהקודם.' },
    { start: 1, steps: [4, 9, 16, 25], answer: 55, rule: 'מוסיפים ריבועים עוקבים: 2², 3², 4², 5².' },
    { start: 60, steps: [-2, -4, -8, -16], answer: 30, rule: 'מחסרים חזקות של 2.' },
    { start: 11, steps: [11, 9, 7, 5], answer: 43, rule: 'ההפרשים האי-זוגיים יורדים: 11, 9, 7, 5.' },
  ];
  return patterns.map((p, i) => {
    const nums = [p.start];
    p.steps.forEach(step => nums.push(nums[nums.length - 1] + step));
    const wrong = [p.answer + 2, p.answer - 3, p.answer + 6].map(String);
    const options = [String(p.answer), ...wrong] as [string, string, string, string];
    return {
      topicId: 'topic_logic',
      prefix: 'logic_series',
      questionType: 'logic',
      questionText: `מהו האיבר הבא בסדרה? ${nums.join(', ')}, ___`,
      options,
      correctIndex: 0,
      explanation: p.rule,
      difficulty: 3 + (i % 5),
      targetIds: TOPIC_TARGETS.topic_logic,
    };
  });
}

function quantitativeQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];
  for (let i = 0; i < 24; i++) {
    const base = 120 + i * 10;
    const percent = [15, 20, 25, 30, 35, 40][i % 6];
    const answer = Math.round((base * percent) / 100);
    seeds.push({
      topicId: 'topic_quantitative',
      prefix: 'quant_percent',
      questionType: 'quantitative',
      questionText: `כמה הם ${percent}% מתוך ${base}?`,
      options: [String(answer), String(answer + 8), String(answer - 6), String(answer + 14)],
      correctIndex: 0,
      explanation: `${percent}% מתוך ${base} הם ${base} כפול ${percent / 100}, כלומר ${answer}.`,
      difficulty: 2 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_quantitative,
    });
  }
  for (let i = 0; i < 16; i++) {
    const speedA = 50 + (i % 5) * 10;
    const speedB = 40 + (i % 4) * 10;
    const time = 2 + (i % 4);
    const distance = (speedA + speedB) * time;
    seeds.push({
      topicId: 'topic_quantitative',
      prefix: 'quant_rate',
      questionType: 'quantitative',
      questionText: `שני כלי רכב יוצאים זה לקראת זה ממרחק ${distance} ק"מ. מהירות הראשון ${speedA} קמ"ש ומהירות השני ${speedB} קמ"ש. אחרי כמה שעות ייפגשו?`,
      options: [String(time), String(time + 1), String(Math.max(1, time - 1)), String(time + 2)],
      correctIndex: 0,
      explanation: `מהירות ההתקרבות היא ${speedA + speedB} קמ"ש. זמן = מרחק חלקי מהירות: ${distance} / ${speedA + speedB} = ${time}.`,
      difficulty: 4 + (i % 5),
      targetIds: TOPIC_TARGETS.topic_quantitative,
    });
  }
  return seeds;
}

function verbalQuestions(): GeneratedQuestionSeed[] {
  const analogies = [
    ['רופא', 'מטופל', 'מורה', 'תלמיד', 'מורה מלמד תלמיד כפי שרופא מטפל במטופל.'],
    ['מפתח', 'דלת', 'סיסמה', 'חשבון', 'סיסמה פותחת חשבון כפי שמפתח פותח דלת.'],
    ['סופר', 'ספר', 'מלחין', 'יצירה', 'סופר יוצר ספר; מלחין יוצר יצירה מוזיקלית.'],
    ['מצפן', 'כיוון', 'שעון', 'זמן', 'מצפן מציין כיוון; שעון מציין זמן.'],
    ['שורש', 'עץ', 'יסוד', 'בניין', 'שורש תומך בעץ; יסוד תומך בבניין.'],
    ['עדשה', 'ראייה', 'מיקרופון', 'שמיעה', 'עדשה מסייעת לראייה; מיקרופון מסייע לשמיעה.'],
    ['מפה', 'דרך', 'תוכנית', 'ביצוע', 'מפה מנחה בדרך; תוכנית מנחה ביצוע.'],
    ['שאלה', 'תשובה', 'בעיה', 'פתרון', 'תשובה מתאימה לשאלה; פתרון מתאים לבעיה.'],
  ];
  const seeds = analogies.map((a, i) => ({
    topicId: 'topic_verbal',
    prefix: 'verbal_analogy',
    questionType: 'verbal' as QuestionType,
    questionText: `אנלוגיה: ${a[0]} : ${a[1]} = ${a[2]} : ___`,
    options: [a[3], 'מכשיר', 'תוצאה', 'מקום'] as [string, string, string, string],
    correctIndex: 0,
    explanation: a[4],
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_verbal,
  }));
  const completions = [
    ['למרות שהמשימה הייתה מורכבת, הצוות הצליח לסיים אותה בזמן בזכות ___ מוקפד.', 'תכנון', 'עיכוב', 'בלבול', 'ויתור'],
    ['הטענה נשמעה משכנעת, אך חסר לה ___ אמפירי.', 'ביסוס', 'קישוט', 'רעש', 'קיצור'],
    ['כדי לפתור בעיה שיטתית יש לזהות תחילה את ___ המרכזי.', 'הגורם', 'הצבע', 'המרחק', 'השם'],
    ['הסבר טוב אינו רק נכון, אלא גם ___ וברור.', 'עקבי', 'אקראי', 'מעורפל', 'ארוך מדי'],
    ['כאשר נתון חדש סותר מסקנה קודמת, יש ___ את ההנחה.', 'לבחון מחדש', 'להסתיר', 'להעתיק', 'לקשט'],
    ['מועמד שקורא הוראות במהירות רבה מדי עלול ___ פרט חשוב.', 'להחמיץ', 'להרחיב', 'לחזק', 'לסמן'],
    ['החלטה שקולה נשענת על נתונים ולא על ___ בלבד.', 'תחושה', 'בדיקה', 'חישוב', 'השוואה'],
    ['ככל שהניסוח מדויק יותר, כך קטן הסיכוי ל___.', 'אי-הבנה', 'הצלחה', 'דיוק', 'פתרון'],
  ];
  completions.forEach((c, i) => seeds.push({
    topicId: 'topic_verbal',
    prefix: 'verbal_completion',
    questionType: 'fill_in_the_blank',
    questionText: c[0],
    options: [c[1], c[2], c[3], c[4]],
    correctIndex: 0,
    explanation: `המילה "${c[1]}" משלימה את המשפט באופן הלוגי והמדויק ביותר.`,
    difficulty: 2 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_verbal,
  }));
  return seeds;
}

function spatialQuestions(): GeneratedQuestionSeed[] {
  const rotations = [
    ['▲', '90° עם כיוון השעון', '▶', ['▶', '◀', '▼', '▲']],
    ['▶', '180°', '◀', ['◀', '▲', '▶', '▼']],
    ['└', '90° עם כיוון השעון', '┌', ['┌', '┘', '┐', '└']],
    ['┬', '180°', '┴', ['┴', '┬', '├', '┤']],
    ['◢', '90° נגד כיוון השעון', '◣', ['◣', '◤', '◥', '◢']],
    ['L', 'מראה אנכית', '⅃', ['⅃', 'L', 'Γ', '┘']],
    ['↗', 'מראה אופקית', '↘', ['↘', '↖', '↙', '↗']],
    ['F', 'מראה אנכית', 'ꟻ', ['ꟻ', 'F', 'Ǝ', '7']],
    ['⬟ עם נקודה בפינה העליונה', 'סיבוב 180°', 'נקודה בפינה התחתונה', ['נקודה בפינה התחתונה', 'נקודה בפינה העליונה', 'נקודה מימין', 'נקודה משמאל']],
    ['ריבוע עם קו אלכסוני מימין-למעלה לשמאל-למטה', 'מראה אנכית', 'קו אלכסוני משמאל-למעלה לימין-למטה', ['קו אלכסוני משמאל-למעלה לימין-למטה', 'אותו קו', 'קו אופקי', 'קו אנכי']],
  ];
  const seeds = rotations.map((r, i) => ({
    topicId: 'topic_spatial',
    prefix: 'spatial_rotation',
    questionType: 'shapes' as QuestionType,
    questionText: `חשיבה מרחבית: הצורה "${r[0]}" עוברת ${r[1]}. איזו תוצאה תתקבל?`,
    options: r[3] as [string, string, string, string],
    correctIndex: 0,
    explanation: `לאחר ${r[1]} מתקבלת התוצאה: ${r[2]}.`,
    difficulty: 3 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  const cubes = [
    [2, 2, 2, 8, '2×2×2 = 8 קוביות קטנות.'],
    [3, 3, 2, 18, '3×3×2 = 18 קוביות קטנות.'],
    [4, 3, 2, 24, '4×3×2 = 24 קוביות קטנות.'],
    [3, 3, 3, 27, '3×3×3 = 27 קוביות קטנות.'],
    [5, 2, 2, 20, '5×2×2 = 20 קוביות קטנות.'],
    [4, 4, 2, 32, '4×4×2 = 32 קוביות קטנות.'],
    [5, 3, 2, 30, '5×3×2 = 30 קוביות קטנות.'],
    [4, 3, 3, 36, '4×3×3 = 36 קוביות קטנות.'],
    [5, 4, 2, 40, '5×4×2 = 40 קוביות קטנות.'],
    [5, 3, 3, 45, '5×3×3 = 45 קוביות קטנות.'],
  ];
  cubes.forEach((c, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_cubes',
    questionType: 'shapes',
    questionText: `מבנה תלת-ממדי בנוי מקוביות 1×1×1 במידות ${c[0]}×${c[1]}×${c[2]}. כמה קוביות קטנות יש במבנה?`,
    options: [String(c[3]), String(Number(c[3]) + 4), String(Number(c[3]) - 3), String(Number(c[3]) + 8)],
    correctIndex: 0,
    explanation: String(c[4]),
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  const nets = [
    ['קובייה', '6 ריבועים', 'לקובייה יש 6 פאות, לכן פריסה מלאה כוללת 6 ריבועים.'],
    ['תיבה מלבנית', '6 מלבנים', 'לתיבה יש 6 פאות מלבניות.'],
    ['פירמידה מרובעת', 'ריבוע ו-4 משולשים', 'בסיס מרובע ועוד ארבע פאות משולשות.'],
    ['מנסרה משולשת', '3 מלבנים ו-2 משולשים', 'שני בסיסים משולשים ושלוש פאות צד מלבניות.'],
    ['קובייה פתוחה ללא מכסה', '5 ריבועים', 'קובייה פתוחה חסרה פאה אחת מתוך שש.'],
    ['גליל', '2 עיגולים ומלבן', 'שני בסיסים עגולים ומעטפת מלבנית בפריסה.'],
  ];
  nets.forEach((n, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_nets',
    questionType: 'shapes',
    questionText: `איזו פריסה מתאימה לגוף: ${n[0]}?`,
    options: [n[1], '4 משולשים בלבד', '2 ריבועים בלבד', 'עיגול אחד ו-3 משולשים'],
    correctIndex: 0,
    explanation: n[2],
    difficulty: 4 + (i % 4),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));
  return seeds;
}

function advancedSpatialQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  const grids = [
    ['⬛⬜⬛ / ⬜⬛⬜ / ⬛⬜?', '⬛', 'הדגם הוא לוח שחמט: כל תא סמוך מתחלף בין שחור ללבן.'],
    ['▲ ■ ▲ / ■ ▲ ■ / ▲ ■ ?', '▲', 'הצורה במרכז ובאלכסונים היא משולש, ולכן התא החסר הוא משולש.'],
    ['○ △ □ / △ □ ○ / □ ○ ?', '△', 'כל שורה מוזזת צעד אחד שמאלה ביחס לקודמת.'],
    ['↗ ↑ ↖ / → • ← / ↘ ↓ ?', '↙', 'החצים מסודרים סביב המרכז לפי כיוונים; בפינה התחתונה-שמאלית צריך חץ ↙.'],
    ['1 2 3 / 2 3 4 / 3 4 ?', '5', 'בכל שורה המספרים עולים ב-1, ובכל עמודה גם כן.'],
    ['◇ ◆ ◇ / ◆ ◇ ◆ / ◇ ◆ ?', '◇', 'דגם מתחלף כמו לוח שחמט בין ריק למלא.'],
    ['L Γ L / Γ L Γ / L Γ ?', 'L', 'הצורות מתחלפות בין L לבין Γ לפי מיקום.'],
    ['◐ ◓ ◑ / ◓ ◑ ◒ / ◑ ◒ ?', '◐', 'חצאי העיגול מסתובבים במחזור של ארבעה מצבים.'],
    ['A B A / B A B / A B ?', 'A', 'דגם זוגי-אי זוגי: A בתאים האלכסוניים והמרכזיים.'],
    ['⬆ ⬇ ⬆ / ⬇ ⬆ ⬇ / ⬆ ⬇ ?', '⬆', 'החצים מתחלפים למעלה/למטה לסירוגין.'],
    ['□ □ ■ / □ ■ □ / ■ □ ?', '□', 'הריבוע המלא נע באלכסון מהפינה הימנית-עליונה לשמאלית-תחתונה.'],
    ['● ○ ○ / ○ ● ○ / ○ ○ ?', '●', 'הנקודה המלאה נמצאת באלכסון הראשי.'],
  ];
  grids.forEach((g, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_matrix',
    questionType: 'shapes',
    questionText: `השלם את תא החסר במטריצת צורות: ${g[0]}`,
    options: [g[1], '□', '○', '▲'],
    correctIndex: 0,
    explanation: g[2],
    difficulty: 4 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  const paintedCubes = [
    [3, 27, 8, 12, 'בקובייה 3×3×3 יש 8 פינות ו-12 קוביות על מקצועות שאינן פינות.'],
    [4, 64, 8, 24, 'בקובייה 4×4×4 יש 8 פינות ו-12×2=24 קוביות מקצוע שאינן פינות.'],
    [5, 125, 8, 36, 'בקובייה 5×5×5 יש 12×3=36 קוביות מקצוע שאינן פינות.'],
    [6, 216, 8, 48, 'בקובייה 6×6×6 יש 12×4=48 קוביות מקצוע שאינן פינות.'],
  ];
  paintedCubes.forEach((c, i) => {
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_painted_corners',
      questionType: 'shapes',
      questionText: `קובייה ${c[0]}×${c[0]}×${c[0]} נצבעה מבחוץ ונחתכה לקוביות קטנות. כמה קוביות קטנות צבועות בדיוק ב-3 פאות?`,
      options: [String(c[2]), String(c[3]), String(Number(c[2]) + 4), String(Number(c[3]) + 8)],
      correctIndex: 0,
      explanation: 'רק קוביות הפינה צבועות בשלוש פאות, ובכל קובייה יש 8 פינות.',
      difficulty: 5 + (i % 4),
      targetIds: TOPIC_TARGETS.topic_spatial,
    });
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_painted_edges',
      questionType: 'shapes',
      questionText: `קובייה ${c[0]}×${c[0]}×${c[0]} נצבעה מבחוץ ונחתכה. כמה קוביות צבועות בדיוק ב-2 פאות?`,
      options: [String(c[3]), String(c[2]), String(Number(c[3]) + 12), String(Number(c[3]) - 4)],
      correctIndex: 0,
      explanation: `קוביות עם 2 פאות צבועות נמצאות על מקצועות, ללא הפינות: 12×(${c[0]}-2) = ${c[3]}.`,
      difficulty: 6 + (i % 4),
      targetIds: TOPIC_TARGETS.topic_spatial,
    });
  });

  const folding = [
    ['בפריסת קובייה יש ריבוע מרכזי וארבעה ריבועים סביבו, ועוד ריבוע מעל העליון. איזו פאה תהיה מול המרכז?', 'הריבוע שמעל העליון', 'הריבוע שמחובר לעליון מתקפל להיות הפאה שמול המרכז.'],
    ['בפריסה שורה של ארבעה ריבועים, ומעל הריבוע השני ומתחתיו ריבוע. מי מול הריבוע השני?', 'הריבוע הרביעי בשורה', 'בשורת ארבעה ריבועים של קובייה, הראשון והשלישי סמוכים לשני, והרביעי נסגר מולו.'],
    ['פריסה של קובייה: A במרכז, B מעל, C מימין, D מתחת, E משמאל, F מעל B. איזו פאה מול A?', 'F', 'ארבעת הצדדים סביב A סמוכים אליו, והפאה הנוספת F נסגרת מול A.'],
    ['פריסה: ארבעה ריבועים בטור, וריבוע אחד מימין לשני ואחד משמאל לשלישי. אילו פאות אינן יכולות להיות סמוכות?', 'הראשון והרביעי בטור', 'בקיפול הם נסגרים משני צדדים מנוגדים של הקובייה.'],
  ];
  folding.forEach((f, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_folding',
    questionType: 'shapes',
    questionText: `קיפול צורות: ${f[0]}`,
    options: [f[1], 'הריבוע המרכזי', 'הריבוע הימני', 'אי אפשר לדעת'],
    correctIndex: 0,
    explanation: f[2],
    difficulty: 6 + (i % 3),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  return seeds;
}

function advancedLogicQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];
  const seating = [
    ['דנה יושבת מימין ליואב. רוני יושב משמאל לדנה. מי יכול לשבת באמצע?', 'דנה', 'אם הסדר הוא יואב-דנה-רוני או רוני-דנה-יואב לפי כיוון הישיבה, דנה היא החוליה שבין השניים.'],
    ['אבי גבוה מבני. בני גבוה מגדי. מי הנמוך ביותר?', 'גדי', 'היחס הטרנזיטיבי הוא אבי > בני > גדי.'],
    ['כל הטייסים עברו מבחן מרחבי. חלק ממי שעבר מבחן מרחבי הם קצינים. מה נובע בהכרח?', 'כל טייס עבר מבחן מרחבי', 'רק הטענה המקורית מחויבת; אין הכרח שכל טייס הוא קצין.'],
    ['אם כל A הם B, ואף B אינו C, מה נכון?', 'אף A אינו C', 'A כלול בתוך B, ואם B מנותק מ-C גם A מנותק מ-C.'],
    ['שלושה מועמדים נבחנו. נועה לא ראשונה, עומר לפני יעל, ויעל לא אחרונה. מי ראשון?', 'עומר', 'יעל אינה אחרונה ועומר לפניה, לכן יעל שנייה ועומר ראשון.'],
    ['אם לפתור שאלה קשה נדרש ריכוז, ומי שעייף אינו מרוכז, מה נכון?', 'מי שעייף לא יפתור בהכרח שאלה קשה', 'חוסר ריכוז פוגע בתנאי הנדרש לפתרון השאלה הקשה.'],
    ['בכל פעם שמופיע סימן X אחריו מופיע Y. במחרוזת יש X ללא Y אחריו. מה המסקנה?', 'הכלל הופר', 'הכלל מחייב Y אחרי כל X.'],
    ['רק מי שסיים פרק כמותי יכול לפתוח סימולציה. דני פתח סימולציה. מה נובע?', 'דני סיים פרק כמותי', 'זהו תנאי הכרחי לפתיחת סימולציה.'],
    ['אם אורי או תמר נכנסים לחדר, האור נדלק. האור לא נדלק. מה נובע?', 'אורי ותמר לא נכנסו', 'שלילת התוצאה שוללת את האפשרויות שהיו מספיקות לה.'],
    ['כל מי שקיבל מעל 80 עבר. מיכל עברה. מה נובע?', 'לא בהכרח שמיכל קיבלה מעל 80', 'מעל 80 מספיק למעבר, אך אינו תנאי הכרחי.'],
    ['ארבעה אנשים עומדים בשורה. א נמצא לפני ב, ג אחרי ב, ד לפני א. מי בוודאות לפני ג?', 'א, ב וד', 'ד לפני א לפני ב לפני ג.'],
    ['אם מספר מתחלק ב-6 הוא מתחלק ב-3. מספר אינו מתחלק ב-3. מה נובע?', 'הוא אינו מתחלק ב-6', 'לפי שלילת התנאי: אם היה מתחלק ב-6 היה מתחלק ב-3.'],
  ];
  seating.forEach((s, i) => seeds.push({
    topicId: 'topic_logic',
    prefix: 'logic_deduction',
    questionType: 'logic',
    questionText: s[0],
    options: [s[1], 'אין מסקנה אפשרית', 'האפשרות ההפוכה', 'כל התשובות נכונות'],
    correctIndex: 0,
    explanation: s[2],
    difficulty: 4 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_logic,
  }));

  const tables = [
    [4, 3, 2, 24],
    [5, 2, 4, 40],
    [6, 3, 3, 54],
    [7, 4, 2, 56],
    [8, 2, 5, 80],
    [9, 3, 2, 54],
    [10, 4, 3, 120],
    [12, 2, 4, 96],
  ];
  tables.forEach((t, i) => seeds.push({
    topicId: 'topic_logic',
    prefix: 'logic_table_rule',
    questionType: 'logic',
    questionText: `בטבלה, התוצאה בכל שורה מתקבלת מכפל של שלושת הערכים. אם הערכים הם ${t[0]}, ${t[1]}, ${t[2]}, מה התוצאה?`,
    options: [String(t[3]), String(Number(t[3]) + 6), String(Number(t[3]) - 8), String(Number(t[3]) + 12)],
    correctIndex: 0,
    explanation: `${t[0]}×${t[1]}×${t[2]} = ${t[3]}.`,
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_logic,
  }));

  return seeds;
}

function advancedQuantitativeQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];
  const mixtures = [
    [20, 30, 10, 50, 30],
    [15, 40, 5, 20, 35],
    [25, 60, 15, 40, 50],
    [30, 50, 10, 80, 40],
    [12, 25, 8, 75, 15],
    [18, 70, 12, 30, 54],
    [24, 45, 6, 55, 42],
    [28, 35, 12, 65, 44],
  ];
  mixtures.forEach((m, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_weighted',
    questionType: 'quantitative',
    questionText: `ממוצע משוקלל: ${m[0]} פריטים קיבלו ציון ${m[1]} ו-${m[2]} פריטים קיבלו ציון ${m[3]}. מה הממוצע?`,
    options: [String(m[4]), String(Number(m[4]) + 5), String(Number(m[4]) - 5), String(Number(m[4]) + 10)],
    correctIndex: 0,
    explanation: `הממוצע הוא (${m[0]}×${m[1]} + ${m[2]}×${m[3]}) / (${m[0]}+${m[2]}) = ${m[4]}.`,
    difficulty: 5 + (i % 4),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  const algebra = [
    ['3x + 12 = 30', 6],
    ['5x - 7 = 38', 9],
    ['2x + 3x = 45', 9],
    ['4x - 16 = 2x + 8', 12],
    ['7x + 5 = 3x + 29', 6],
    ['9x - 18 = 6x + 12', 10],
    ['x/3 + 8 = 15', 21],
    ['2(x+4)=30', 11],
    ['5(x-2)=35', 9],
    ['3x + 2 = x + 18', 8],
    ['10x - 4x = 54', 9],
    ['4(x+3)=2x+30', 9],
  ];
  algebra.forEach((a, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_algebra',
    questionType: 'quantitative',
    questionText: `פתור את המשוואה: ${a[0]}`,
    options: [String(a[1]), String(Number(a[1]) + 2), String(Number(a[1]) - 2), String(Number(a[1]) + 5)],
    correctIndex: 0,
    explanation: `פתרון המשוואה נותן x = ${a[1]}.`,
    difficulty: 3 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  const geometry = [
    ['מלבן שאורכו 12 ורוחבו 7', '84', 'שטח מלבן הוא אורך כפול רוחב: 12×7=84.'],
    ['משולש שבסיסו 10 וגובהו 8', '40', 'שטח משולש הוא בסיס כפול גובה חלקי 2: 10×8/2=40.'],
    ['ריבוע שצלעו 9', '81', 'שטח ריבוע הוא צלע בריבוע: 9×9=81.'],
    ['מקבילית שבסיסה 11 וגובהה 6', '66', 'שטח מקבילית הוא בסיס כפול גובה: 11×6=66.'],
    ['טרפז שבסיסיו 8 ו-14 וגובהו 5', '55', 'שטח טרפז הוא סכום הבסיסים כפול גובה חלקי 2: (8+14)×5/2=55.'],
    ['מעגל שרדיוסו 5, לפי π≈3', '75', 'שטח מעגל בקירוב הוא πr²: 3×25=75.'],
    ['קובייה שצלעה 4', '64', 'נפח קובייה הוא צלע בשלישית: 4³=64.'],
    ['תיבה במידות 3×5×6', '90', 'נפח תיבה הוא מכפלת הממדים: 3×5×6=90.'],
  ];
  geometry.forEach((g, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_geometry',
    questionType: 'quantitative',
    questionText: `חשב שטח/נפח: ${g[0]}.`,
    options: [g[1], String(Number(g[1]) + 10), String(Number(g[1]) - 8), String(Number(g[1]) + 20)],
    correctIndex: 0,
    explanation: g[2],
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  return seeds;
}

function advancedVerbalQuestions(): GeneratedQuestionSeed[] {
  const words = [
    ['מובהק', 'ברור וחד-משמעי', 'נסתר', 'אקראי', 'זמני'],
    ['להפריך', 'להוכיח שטענה אינה נכונה', 'לחזק', 'לקשט', 'להעתיק'],
    ['עקבי', 'שאינו סותר את עצמו', 'מבולבל', 'חד-פעמי', 'בלתי קשור'],
    ['תמציתי', 'קצר ומדויק', 'ארוך ומסורבל', 'רגשי', 'אקראי'],
    ['אומדן', 'הערכה מקורבת', 'חישוב מדויק בלבד', 'ציור', 'העתקה'],
    ['משתמע', 'נובע בעקיפין', 'מנוגד', 'בלתי אפשרי', 'חסר משמעות'],
    ['לסייג', 'להגביל או לדייק טענה', 'להרחיב ללא גבול', 'למחוק', 'לשכפל'],
    ['זיקה', 'קשר או יחס בין דברים', 'מרחק פיזי בלבד', 'צבע', 'שגיאה'],
  ];
  return words.map((w, i) => ({
    topicId: 'topic_verbal',
    prefix: 'verbal_vocab',
    questionType: 'verbal',
    questionText: `מה פירוש המילה "${w[0]}"?`,
    options: [w[1], w[2], w[3], w[4]],
    correctIndex: 0,
    explanation: `"${w[0]}" פירושה: ${w[1]}.`,
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_verbal,
  }));
}

const RAW_EXPANDED_QUESTIONS: GeneratedQuestionSeed[] = [
  ...seriesQuestions(),
  ...quantitativeQuestions(),
  ...verbalQuestions(),
  ...spatialQuestions(),
  ...advancedSpatialQuestions(),
  ...advancedLogicQuestions(),
  ...advancedQuantitativeQuestions(),
  ...advancedVerbalQuestions(),
];

export const EXPANDED_PSYCHOTECHNIC_QUESTIONS: Question[] = RAW_EXPANDED_QUESTIONS.map(createQuestion);
