import { Question, QuestionType, ValidationStatus } from './types';

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
  validationStatus?: ValidationStatus;
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

function normalizeOptions(options: [string, string, string, string], correctIndex: number): [string, string, string, string] {
  const used = new Set<string>();
  return options.map((option, index) => {
    let text = String(option);
    if (!used.has(text)) {
      used.add(text);
      return text;
    }

    const numeric = Number(text);
    if (!Number.isNaN(numeric)) {
      let candidate = numeric + index + 2;
      while (used.has(String(candidate))) candidate += 3;
      text = String(candidate);
    } else {
      let suffix = index + 1;
      let candidate = index === correctIndex ? text : `${text} - מסיח ${suffix}`;
      while (used.has(candidate)) {
        suffix += 1;
        candidate = `${text} - מסיח ${suffix}`;
      }
      text = candidate;
    }
    used.add(text);
    return text;
  }) as [string, string, string, string];
}

function strengthenExplanation(explanation: string, correctText: string): string {
  const clean = explanation.trim();
  if (clean.length >= 35 && clean.includes(correctText)) return clean;
  const answerSummary = ` לכן התשובה הנכונה היא "${correctText}", כי היא היחידה שתואמת את הכלל או החישוב שהוצג בשאלה.`;
  return clean.endsWith('.') ? `${clean}${answerSummary}` : `${clean}.${answerSummary}`;
}

function createQuestion(seed: GeneratedQuestionSeed, index: number): Question {
  const correctId = ['a', 'b', 'c', 'd'][seed.correctIndex];
  const validationStatus = seed.validationStatus ?? 'validated';
  const normalizedOptions = normalizeOptions(seed.options, seed.correctIndex);
  const explanation = strengthenExplanation(seed.explanation, normalizedOptions[seed.correctIndex]);
  return {
    id: `q_exp_${seed.prefix}_${String(index + 1).padStart(3, '0')}`,
    targetIds: seed.targetIds,
    topicId: seed.topicId,
    questionType: seed.questionType,
    questionText: seed.questionText,
    mediaUrl: seed.mediaUrl,
    mediaType: seed.mediaUrl ? 'image' : undefined,
    options: normalizedOptions.map((text, optionIndex) => ({
      id: ['a', 'b', 'c', 'd'][optionIndex],
      text,
      isCorrect: optionIndex === seed.correctIndex,
    })),
    correctAnswer: correctId,
    explanation,
    difficulty: seed.difficulty,
    psychometricStats: {
      elo: difficultyToElo(seed.difficulty),
      discrimination: Number((0.72 + (seed.difficulty % 5) * 0.035).toFixed(2)),
      guessProbability: 0.25,
    },
    accessLevel: seed.difficulty >= 8 ? 'premium' : 'free',
    validationStatus,
    smartPracticeEligible: validationStatus === 'validated',
    generalPracticeEligible: validationStatus === 'validated',
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
    p.steps.slice(0, -1).forEach(step => nums.push(nums[nums.length - 1] + step));
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
    explanation: `כלל הטבלה הוא כפל של שלושת הערכים באותה שורה. לכן מחשבים ${t[0]}×${t[1]}×${t[2]} ומקבלים ${t[3]}.`,
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

function massiveQuantitativeQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  const ratios: Array<[number, number, number, number, string]> = [
    [2, 3, 50, 20, 'אם היחס 2:3 והסכום 50, יחידת יחס אחת היא 10 ולכן החלק הראשון 20.'],
    [3, 5, 64, 24, 'סך יחידות היחס הוא 8. כל יחידה שווה 8, ולכן 3 יחידות הן 24.'],
    [4, 7, 99, 36, 'סך יחידות היחס הוא 11. כל יחידה שווה 9, ולכן 4 יחידות הן 36.'],
    [5, 6, 121, 55, 'סך יחידות היחס הוא 11. כל יחידה שווה 11, ולכן 5 יחידות הן 55.'],
    [7, 8, 150, 70, 'סך יחידות היחס הוא 15. כל יחידה שווה 10, ולכן 7 יחידות הן 70.'],
    [3, 4, 84, 36, 'סך יחידות היחס הוא 7. כל יחידה שווה 12, ולכן 3 יחידות הן 36.'],
    [5, 9, 126, 45, 'סך יחידות היחס הוא 14. כל יחידה שווה 9, ולכן 5 יחידות הן 45.'],
    [6, 11, 204, 72, 'סך יחידות היחס הוא 17. כל יחידה שווה 12, ולכן 6 יחידות הן 72.'],
    [4, 5, 108, 48, 'סך יחידות היחס הוא 9. כל יחידה שווה 12, ולכן 4 יחידות הן 48.'],
    [8, 13, 210, 80, 'סך יחידות היחס הוא 21. כל יחידה שווה 10, ולכן 8 יחידות הן 80.'],
  ];
  ratios.forEach((r, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_ratio',
    questionType: 'quantitative',
    questionText: `היחס בין שני חלקים הוא ${r[0]}:${r[1]} וסכומם ${r[2]}. מה ערך החלק הראשון?`,
    options: [String(r[3]), String(Number(r[3]) + 6), String(Number(r[3]) - 6), String(Number(r[3]) + 12)],
    correctIndex: 0,
    explanation: r[4],
    difficulty: 4 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  const work: Array<[number, number]> = [
    [6, 8],
    [5, 10],
    [4, 12],
    [9, 18],
    [7, 14],
    [8, 24],
    [10, 15],
    [12, 20],
  ];
  const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
  const formatHours = (numerator: number, denominator: number): string => {
    const divisor = gcd(numerator, denominator);
    const n = numerator / divisor;
    const d = denominator / divisor;
    return d === 1 ? `${n}` : `${n}/${d}`;
  };
  work.forEach((w, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_work',
    questionType: 'quantitative',
    questionText: `פועל א מסיים עבודה אחת ב-${w[0]} שעות ופועל ב מסיים אותה עבודה ב-${w[1]} שעות. אם שניהם עובדים יחד, כמה שעות יידרשו לסיום עבודה אחת?`,
    options: [
      formatHours(w[0] * w[1], w[0] + w[1]),
      formatHours(w[0] + w[1], 2),
      String(Math.min(w[0], w[1])),
      String(Math.max(w[0], w[1])),
    ],
    correctIndex: 0,
    explanation: `קצב העבודה המשותף הוא 1/${w[0]} + 1/${w[1]} = ${(w[0] + w[1])}/${w[0] * w[1]}. לכן הזמן לעבודה אחת הוא ${formatHours(w[0] * w[1], w[0] + w[1])} שעות.`,
    difficulty: 6 + (i % 4),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  const probability = [
    ['בקופסה 3 כדורים אדומים ו-2 כחולים. מה ההסתברות לשלוף אדום?', '3/5', 'יש 3 אדומים מתוך 5 כדורים.'],
    ['מטילים קובייה. מה ההסתברות לקבל מספר זוגי?', '1/2', 'המספרים הזוגיים הם 2,4,6 מתוך 6 תוצאות.'],
    ['בוחרים ספרה מ-0 עד 9. מה ההסתברות לקבל ספרה גדולה מ-6?', '3/10', 'הספרות הן 7,8,9 מתוך 10.'],
    ['בכיתה 12 בנים ו-18 בנות. מה ההסתברות לבחור בת?', '3/5', '18 מתוך 30 מצטמצם ל-3/5.'],
    ['מטילים מטבע פעמיים. מה ההסתברות לשתי תוצאות זהות?', '1/2', 'התוצאות HH ו-TT הן 2 מתוך 4.'],
    ['בוחרים יום בשבוע. מה ההסתברות שזה סוף שבוע לפי שישי או שבת?', '2/7', 'יש 2 ימים מתאימים מתוך 7.'],
    ['בוחרים מספר מ-1 עד 20. מה ההסתברות שהוא מתחלק ב-5?', '1/5', 'המספרים 5,10,15,20 הם 4 מתוך 20.'],
    ['בקופסה 4 לבנים, 4 שחורים ו-8 ירוקים. מה ההסתברות לשלוף ירוק?', '1/2', '8 מתוך 16 מצטמצם ל-1/2.'],
  ];
  probability.forEach((p, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_probability',
    questionType: 'quantitative',
    questionText: p[0],
    options: [p[1], '1/3', '2/5', '3/4'],
    correctIndex: 0,
    explanation: p[2],
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  const numberTheory: Array<[number, number, string]> = [
    [84, 12, '84 מתחלק ב-12 כי 12×7=84.'],
    [96, 16, '96 מתחלק ב-16 כי 16×6=96.'],
    [125, 25, '125 מתחלק ב-25 כי 25×5=125.'],
    [144, 18, '144 מתחלק ב-18 כי 18×8=144.'],
    [168, 24, '168 מתחלק ב-24 כי 24×7=168.'],
    [210, 30, '210 מתחלק ב-30 כי 30×7=210.'],
    [225, 15, '225 מתחלק ב-15 כי 15×15=225.'],
    [256, 32, '256 מתחלק ב-32 כי 32×8=256.'],
    [315, 45, '315 מתחלק ב-45 כי 45×7=315.'],
    [360, 40, '360 מתחלק ב-40 כי 40×9=360.'],
  ];
  numberTheory.forEach((n, i) => seeds.push({
    topicId: 'topic_quantitative',
    prefix: 'quant_divisibility',
    questionType: 'quantitative',
    questionText: `איזה מהמספרים הבאים מחלק את ${n[0]} ללא שארית?`,
    options: [String(n[1]), String(Number(n[1]) + 7), String(Number(n[1]) - 5), String(Number(n[1]) + 11)],
    correctIndex: 0,
    explanation: n[2],
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_quantitative,
  }));

  return seeds;
}

function massiveLogicQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  const sequences = [
    ['2, 6, 12, 20, 30, ___', '42', 'ההפרשים הם 4,6,8,10 ולכן הבא 12.'],
    ['1, 4, 9, 16, 25, ___', '36', 'אלו ריבועים עוקבים: 1² עד 6².'],
    ['3, 9, 27, 81, ___', '243', 'כל איבר מוכפל פי 3.'],
    ['100, 50, 25, 12.5, ___', '6.25', 'כל איבר מחולק ב-2.'],
    ['5, 7, 11, 17, 25, ___', '35', 'ההפרשים הם 2,4,6,8 ולכן הבא 10.'],
    ['8, 13, 21, 34, 55, ___', '89', 'כל איבר הוא סכום שני הקודמים.'],
    ['64, 32, 16, 8, ___', '4', 'כל איבר מחולק ב-2.'],
    ['4, 12, 24, 40, 60, ___', '84', 'ההפרשים הם 8,12,16,20 ולכן הבא 24.'],
    ['7, 14, 28, 56, ___', '112', 'כל איבר מוכפל פי 2.'],
    ['9, 18, 21, 42, 45, ___', '90', 'מתחלפים בין כפול 2 לבין פלוס 3.'],
    ['2, 5, 10, 17, 26, ___', '37', 'מוסיפים 3,5,7,9 ולכן הבא 11.'],
    ['120, 60, 30, 15, ___', '7.5', 'כל איבר מחולק ב-2.'],
  ];
  sequences.forEach((s, i) => seeds.push({
    topicId: 'topic_logic',
    prefix: 'logic_sequence_more',
    questionType: 'logic',
    questionText: `מה האיבר הבא בסדרה? ${s[0]}`,
    options: [s[1], String(Number(s[1]) + 3), String(Math.max(0, Number(s[1]) - 4)), String(Number(s[1]) + 8)],
    correctIndex: 0,
    explanation: s[2],
    difficulty: 3 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_logic,
  }));

  const syllogisms = [
    ['כל המהנדסים מדויקים. חלק מהמדויקים זריזים. מה נובע בהכרח?', 'כל המהנדסים מדויקים', 'רק הטענה הראשונה מובטחת; אין הכרח שחלק מהמהנדסים זריזים.'],
    ['אין תלמיד שהוא גם נעדר וגם נבחן. רועי נבחן. מה נובע?', 'רועי אינו נעדר', 'אם נבחן לא יכול להיות נעדר לפי הכלל.'],
    ['כל מי שקיבל אישור נכנס. דנה לא נכנסה. מה נובע?', 'דנה לא קיבלה אישור', 'אם הייתה מקבלת אישור הייתה נכנסת; שלילת התוצאה שוללת את התנאי המספיק.'],
    ['רק מי שסיים אימון יכול לגשת למבחן. יעל ניגשה למבחן. מה נובע?', 'יעל סיימה אימון', 'סיום אימון הוא תנאי הכרחי.'],
    ['אם יורד גשם, המסלול נסגר. המסלול פתוח. מה נובע?', 'לא יורד גשם', 'אם היה יורד גשם המסלול היה נסגר.'],
    ['כל החדרים בקומה זו נעולים. חדר 7 בקומה זו. מה נכון?', 'חדר 7 נעול', 'חדר 7 שייך לקבוצת החדרים הנעולים.'],
    ['חלק מהכיסאות כחולים. כל הכיסאות הכחולים חדשים. מה נובע?', 'חלק מהכיסאות חדשים', 'הכיסאות הכחולים הם חלק מהכיסאות, וכולם חדשים.'],
    ['אף מבחן קצר אינו כולל הפסקה. מבחן א כולל הפסקה. מה נובע?', 'מבחן א אינו קצר', 'אם היה קצר לא הייתה בו הפסקה.'],
    ['כל מי שמתרגל משתפר. ניר לא השתפר. מה נובע?', 'ניר לא תרגל', 'לפי שלילת התוצאה של כלל מספיק.'],
    ['אם הקוד נכון, הדלת נפתחת. הדלת לא נפתחה. מה נובע?', 'הקוד לא נכון', 'קוד נכון היה פותח את הדלת.'],
  ];
  syllogisms.forEach((s, i) => seeds.push({
    topicId: 'topic_logic',
    prefix: 'logic_syllogism_more',
    questionType: 'logic',
    questionText: s[0],
    options: [s[1], 'אין שום מסקנה', 'ההפך בהכרח נכון', 'כל האפשרויות נכונות'],
    correctIndex: 0,
    explanation: s[2],
    difficulty: 4 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_logic,
  }));

  const arrangements = [
    ['א לפני ב, ב לפני ג, וד אחרי ג. מי ראשון?', 'א', 'הסדר המחייב הוא א לפני ב לפני ג לפני ד.'],
    ['רוני גבוה מדנה, דנה גבוהה ממיכל, ומיכל גבוהה מתמר. מי הנמוכה ביותר?', 'תמר', 'השרשרת היא רוני > דנה > מיכל > תמר.'],
    ['ספר א כבד מספר ב, ספר ג קל מספר ב. מי הכבד ביותר?', 'ספר א', 'א כבד מב, וב כבד מג, לכן א הכבד ביותר.'],
    ['עמדה 1 לפני עמדה 2, עמדה 4 אחרי עמדה 3, ועמדה 3 אחרי עמדה 2. מי אחרונה?', 'עמדה 4', 'הסדר הוא 1,2,3,4.'],
    ['אדום מימין לכחול, ירוק מימין לאדום. מה משמאל לאדום?', 'כחול', 'אדום נמצא בין כחול לירוק.'],
    ['יוסי הגיע אחרי דני ולפני רות. מי לא יכול להיות אחרון?', 'יוסי', 'יוסי לפני רות, לכן אינו אחרון.'],
    ['בחדרים 1-3: א לא ב-1, ב לא ב-2, ג לא ב-3. אם א ב-2, איפה ב?', '3', 'א תופס את 2, ב לא ב-2 ולכן ב-3 וג-1.'],
    ['שלושה צבעים: כחול לפני ירוק, אדום אחרי ירוק. מי באמצע?', 'ירוק', 'הסדר כחול, ירוק, אדום.'],
  ];
  arrangements.forEach((a, i) => seeds.push({
    topicId: 'topic_logic',
    prefix: 'logic_arrangement',
    questionType: 'logic',
    questionText: a[0],
    options: [a[1], 'האפשרות הראשונה ברשימה', 'אי אפשר לדעת', 'כולם אפשריים'],
    correctIndex: 0,
    explanation: a[2],
    difficulty: 4 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_logic,
  }));

  return seeds;
}

function massiveVerbalQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  const opposites = [
    ['עקבי', 'סותר', 'שיטתי', 'ברור', 'מדויק'],
    ['גלוי', 'נסתר', 'מפורש', 'פתוח', 'בהיר'],
    ['תמציתי', 'מסורבל', 'קצר', 'ממוקד', 'מדויק'],
    ['נחרץ', 'מהוסס', 'חד', 'תקיף', 'מוחלט'],
    ['שכיח', 'נדיר', 'מצוי', 'נפוץ', 'רגיל'],
    ['להאיץ', 'להאט', 'לקדם', 'לזרז', 'להניע'],
    ['להרחיב', 'לצמצם', 'לפתח', 'להגדיל', 'להעמיק'],
    ['מדויק', 'שגוי', 'חד', 'נכון', 'מכוון'],
    ['מוחשי', 'מופשט', 'גשמי', 'נראה', 'פיזי'],
    ['סביל', 'פעיל', 'פסיבי', 'מקבל', 'נגרר'],
  ];
  opposites.forEach((o, i) => seeds.push({
    topicId: 'topic_verbal',
    prefix: 'verbal_antonym',
    questionType: 'verbal',
    questionText: `מהו הניגוד המתאים ביותר למילה "${o[0]}"?`,
    options: [o[1], o[2], o[3], o[4]],
    correctIndex: 0,
    explanation: `המילה "${o[1]}" היא הניגוד הקרוב ביותר ל-"${o[0]}".`,
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_verbal,
  }));

  const analogies = [
    ['סכין', 'חיתוך', 'עט', 'כתיבה', 'הכלי משמש לפעולה המרכזית שלו.'],
    ['מדחום', 'טמפרטורה', 'מאזניים', 'משקל', 'שני המכשירים מודדים תכונה.'],
    ['מנעול', 'אבטחה', 'גג', 'הגנה', 'מנעול מספק אבטחה וגג מספק הגנה.'],
    ['שופט', 'פסק דין', 'רופא', 'אבחנה', 'בעל מקצוע מפיק הכרעה מקצועית.'],
    ['ענן', 'גשם', 'מדורה', 'עשן', 'האחד יוצר או גורם לאחר.'],
    ['ספרייה', 'ספרים', 'מחסן', 'ציוד', 'מקום שמכיל פריטים מסוג מסוים.'],
    ['מצלמה', 'צילום', 'מיקרופון', 'הקלטה', 'מכשיר לפעולת תיעוד.'],
    ['מפתח', 'פתיחה', 'בלם', 'עצירה', 'כלי המאפשר פעולה מסוימת.'],
    ['דלק', 'נסיעה', 'סוללה', 'הפעלה', 'מקור אנרגיה שמאפשר פעולה.'],
    ['תזמורת', 'נגנים', 'כיתה', 'תלמידים', 'קבוצה מורכבת מחבריה.'],
  ];
  analogies.forEach((a, i) => seeds.push({
    topicId: 'topic_verbal',
    prefix: 'verbal_analogy_more',
    questionType: 'verbal',
    questionText: `אנלוגיה: ${a[0]} : ${a[1]} = ${a[2]} : ___`,
    options: [a[3], 'מקום', 'זמן', 'מספר'],
    correctIndex: 0,
    explanation: a[4],
    difficulty: 3 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_verbal,
  }));

  const sentenceLogic = [
    ['החוקר לא הסתפק בתוצאה הראשונית, משום שרצה ___ את אמינותה.', 'לאמת', 'להסתיר', 'לטשטש', 'לקצר'],
    ['כאשר שתי טענות סותרות זו את זו, לא ניתן לקבל את שתיהן כ___.', 'נכונות', 'קצרות', 'יפות', 'שוות'],
    ['הניסוי חזר על עצמו מספר פעמים כדי לצמצם השפעה של ___.', 'מקריות', 'דיוק', 'שיטה', 'תיעוד'],
    ['הוראה עמומה עלולה לגרום ל___ בביצוע.', 'בלבול', 'דיוק', 'שיפור', 'אישור'],
    ['כדי להשוות בין מועמדים יש להשתמש ב___ אחיד.', 'קריטריון', 'צבע', 'שם', 'סיפור'],
    ['מסקנה תקפה חייבת לנבוע מן ה___.', 'נתונים', 'רגשות', 'כותרת', 'קישוט'],
    ['מי שממהר מדי עלול לוותר על בדיקה ___ של הפתרון.', 'שיטתית', 'אקראית', 'חסרת ערך', 'חיצונית'],
    ['כאשר הדוגמה אינה מייצגת, ההכללה עלולה להיות ___.', 'שגויה', 'מדויקת', 'מוכחת', 'מלאה'],
  ];
  sentenceLogic.forEach((s, i) => seeds.push({
    topicId: 'topic_verbal',
    prefix: 'verbal_sentence_logic',
    questionType: 'fill_in_the_blank',
    questionText: s[0],
    options: [s[1], s[2], s[3], s[4]],
    correctIndex: 0,
    explanation: `המילה "${s[1]}" משלימה את המשפט באופן ההגיוני ביותר.`,
    difficulty: 4 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_verbal,
  }));

  return seeds;
}

function massiveSpatialQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  const rotations = [
    ['⬢ עם נקודה למעלה', '90° עם כיוון השעון', 'נקודה מימין'],
    ['⬢ עם נקודה מימין', '90° עם כיוון השעון', 'נקודה למטה'],
    ['⬢ עם נקודה למטה', '90° נגד כיוון השעון', 'נקודה מימין'],
    ['⬢ עם נקודה משמאל', '180°', 'נקודה מימין'],
    ['משולש שחודו למעלה', '90° עם כיוון השעון', 'חוד ימינה'],
    ['משולש שחודו שמאלה', '180°', 'חוד ימינה'],
    ['חץ כפול אופקי', '90°', 'חץ כפול אנכי'],
    ['קו אלכסוני עולה', 'מראה אנכית', 'קו אלכסוני יורד'],
    ['צורת T', '180°', 'T הפוכה'],
    ['צורת Z', 'מראה אנכית', 'צורת S'],
    ['ריבוע עם פס עליון', '180°', 'פס תחתון'],
    ['עיגול עם סימן בצד ימין', 'מראה אנכית', 'סימן בצד שמאל'],
  ];
  rotations.forEach((r, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_transform_more',
    questionType: 'shapes',
    questionText: `צורה מרחבית: ${r[0]} עוברת ${r[1]}. מה יתקבל?`,
    options: [r[2], 'אותה צורה ללא שינוי', 'סימן למעלה', 'סימן למטה'],
    correctIndex: 0,
    explanation: `לאחר ${r[1]} מיקום הסימן משתנה ל: ${r[2]}.`,
    difficulty: 3 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  const layers: Array<[[number, number, number], number]> = [
    [[4, 3, 2], 9],
    [[5, 4, 3], 12],
    [[6, 5, 4], 15],
    [[7, 5, 3], 15],
    [[8, 6, 4], 18],
    [[9, 7, 5], 21],
    [[5, 3, 1], 9],
    [[6, 4, 2], 12],
    [[7, 4, 1], 12],
    [[10, 8, 6], 24],
  ];
  layers.forEach((l, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_layers',
    questionType: 'shapes',
    questionText: `מבנה קוביות בנוי משלוש שכבות: תחתונה ${l[0][0]} קוביות, אמצעית ${l[0][1]} קוביות ועליונה ${l[0][2]} קוביות. כמה קוביות במבנה?`,
    options: [String(l[1]), String(Number(l[1]) + 3), String(Number(l[1]) - 2), String(Number(l[1]) + 6)],
    correctIndex: 0,
    explanation: `סופרים שכבות: ${l[0][0]}+${l[0][1]}+${l[0][2]}=${l[1]}.`,
    difficulty: 3 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  const symmetry = [
    ['A', 'לא', 'האות A סימטרית אנכית אך לא אופקית.'],
    ['H', 'כן', 'האות H סימטרית גם אנכית וגם אופקית.'],
    ['T', 'לא', 'T סימטרית אנכית אך לא אופקית.'],
    ['O', 'כן', 'עיגול/אות O סימטריים בשני הכיוונים.'],
    ['L', 'לא', 'אין לה סימטריה אנכית או אופקית רגילה.'],
    ['X', 'כן', 'X סימטרית במספר צירים, כולל אנכי ואופקי בצורתה התקנית.'],
    ['E', 'לא', 'E אינה סימטרית אנכית.'],
    ['I', 'כן', 'I בצורתה הפשוטה סימטרית אנכית ואופקית.'],
  ];
  symmetry.forEach((s, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_symmetry',
    questionType: 'shapes',
    questionText: `האם לצורה/אות "${s[0]}" יש סימטריה גם אנכית וגם אופקית?`,
    options: [s[1], s[1] === 'כן' ? 'לא' : 'כן', 'רק אלכסונית', 'אי אפשר לדעת'],
    correctIndex: 0,
    explanation: s[2],
    difficulty: 2 + (i % 5),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  const views = [
    ['שורה של 4 קוביות', '4', 'מבט מלמעלה רואה ארבעה תאים בשורה.'],
    ['ריבוע 2×2 של קוביות בגובה 1', '4', 'מבט מלמעלה רואה 4 עמדות.'],
    ['מבנה 3×2 בגובה 1', '6', 'מבט מלמעלה רואה 3×2=6 עמדות.'],
    ['שתי קוביות זו על זו באותה עמדה', '1', 'מבט מלמעלה רואה עמדה אחת בלבד.'],
    ['שלוש עמודות בגבהים 1,2,3', '3', 'מבט מלמעלה רואה 3 עמדות, לא את הגובה.'],
    ['מבנה בצורת L עם 5 עמדות', '5', 'מבט מלמעלה סופר עמדות תפוסות.'],
    ['ריבוע 3×3 חסר מרכז', '8', 'יש 9 עמדות פחות המרכז החסר.'],
    ['מלבן 4×2 עם עמודה כפולה באחת הפינות', '8', 'מבט מלמעלה עדיין רואה 4×2 עמדות.'],
  ];
  views.forEach((v, i) => seeds.push({
    topicId: 'topic_spatial',
    prefix: 'spatial_top_view',
    questionType: 'shapes',
    questionText: `מבט על: ${v[0]}. כמה משבצות ייראו מלמעלה?`,
    options: [v[1], String(Number(v[1]) + 1), String(Math.max(1, Number(v[1]) - 1)), String(Number(v[1]) + 3)],
    correctIndex: 0,
    explanation: v[2],
    difficulty: 3 + (i % 6),
    targetIds: TOPIC_TARGETS.topic_spatial,
  }));

  return seeds;
}

function pendingAdminValidationQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  for (let i = 0; i < 36; i++) {
    const total = 240 + i * 15;
    const part = [12, 15, 18, 20, 25, 30][i % 6];
    const answer = Math.round((total * part) / 100);
    seeds.push({
      topicId: 'topic_quantitative',
      prefix: 'admin_pending_quant_percent',
      questionType: 'quantitative',
      questionText: `במבחן פסיכוטכני נשאל: כמה הם ${part}% מתוך ${total}?`,
      options: [String(answer), String(answer + 9), String(Math.max(1, answer - 7)), String(answer + 18)],
      correctIndex: 0,
      explanation: `${part}% מתוך ${total} הם ${total} כפול ${part / 100}, כלומר ${answer}.`,
      difficulty: 2 + (i % 7),
      targetIds: TOPIC_TARGETS.topic_quantitative,
      validationStatus: 'pending',
    });
  }

  for (let i = 0; i < 32; i++) {
    const a = 6 + (i % 8);
    const b = 4 + (i % 6);
    const c = 2 + (i % 5);
    const answer = a * b + c * (i % 4 + 2);
    seeds.push({
      topicId: 'topic_quantitative',
      prefix: 'admin_pending_quant_expression',
      questionType: 'quantitative',
      questionText: `חשב במהירות: ${a} × ${b} + ${c} × ${(i % 4) + 2} = ?`,
      options: [String(answer), String(answer + a), String(answer - b), String(answer + c + b)],
      correctIndex: 0,
      explanation: `קודם כפל: ${a}×${b}=${a * b}, וגם ${c}×${(i % 4) + 2}=${c * ((i % 4) + 2)}. סכום: ${answer}.`,
      difficulty: 2 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_quantitative,
      validationStatus: 'pending',
    });
  }

  for (let i = 0; i < 28; i++) {
    const first = 18 + i;
    const second = 22 + (i % 9) * 2;
    const third = 26 + (i % 7) * 3;
    const avg = Math.round((first + second + third) / 3);
    seeds.push({
      topicId: 'topic_quantitative',
      prefix: 'admin_pending_quant_average',
      questionType: 'quantitative',
      questionText: `ממוצע שלושת המספרים ${first}, ${second}, ${third} הוא בקירוב:`,
      options: [String(avg), String(avg + 3), String(Math.max(1, avg - 4)), String(avg + 7)],
      correctIndex: 0,
      explanation: `מחברים את שלושת המספרים ומחלקים ב-3: (${first}+${second}+${third})/3 ≈ ${avg}.`,
      difficulty: 3 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_quantitative,
      validationStatus: 'pending',
    });
  }

  for (let i = 0; i < 42; i++) {
    const start = 3 + (i % 9);
    const step = 2 + (i % 6);
    const nums = [start, start + step, start + step * 2, start + step * 3, start + step * 4];
    const answer = start + step * 5;
    seeds.push({
      topicId: 'topic_logic',
      prefix: 'admin_pending_logic_series_linear',
      questionType: 'logic',
      questionText: `השלם את הסדרה: ${nums.join(', ')}, ___`,
      options: [String(answer), String(answer + step), String(answer - 1), String(answer + 3)],
      correctIndex: 0,
      explanation: `הסדרה עולה בקפיצה קבועה של ${step}, לכן האיבר הבא הוא ${answer}.`,
      difficulty: 2 + (i % 5),
      targetIds: TOPIC_TARGETS.topic_logic,
      validationStatus: 'pending',
    });
  }

  for (let i = 0; i < 34; i++) {
    const base = 2 + (i % 5);
    const nums = [base, base * 2, base * 4, base * 8, base * 16];
    const answer = base * 32;
    seeds.push({
      topicId: 'topic_logic',
      prefix: 'admin_pending_logic_series_geo',
      questionType: 'logic',
      questionText: `איזה מספר ממשיך את הדפוס? ${nums.join(', ')}, ___`,
      options: [String(answer), String(answer / 2), String(answer + base), String(answer - base * 3)],
      correctIndex: 0,
      explanation: `בכל צעד מכפילים פי 2, לכן אחרי ${base * 16} מגיע ${answer}.`,
      difficulty: 3 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_logic,
      validationStatus: 'pending',
    });
  }

  const logicRelations = [
    ['כל הטייסים עוברים מבחן. נועם טייס.', 'נועם עבר מבחן', 'המסקנה נובעת ישירות מהכלל הכללי.'],
    ['כל מי שעבר סינון קיבל זימון. דנה לא קיבלה זימון.', 'דנה לא עברה סינון', 'אם עברה סינון היתה מקבלת זימון; לכן לפי שלילת התוצאה לא עברה.'],
    ['אין חיילים בקבוצה ב׳. רועי חייל.', 'רועי לא בקבוצה ב׳', 'הקבוצה אינה מכילה חיילים ולכן רועי לא יכול להיות בה.'],
    ['כל המהירים מדויקים. חלק מהמדויקים רגועים.', 'לא ניתן לדעת אם כל המהירים רגועים', 'קיים קשר בין מהירים למדייקים, אך לא בין כולם לרגועים.'],
  ];
  for (let i = 0; i < 28; i++) {
    const row = logicRelations[i % logicRelations.length];
    seeds.push({
      topicId: 'topic_logic',
      prefix: 'admin_pending_logic_inference',
      questionType: 'logic',
      questionText: `${row[0]} איזו מסקנה נכונה?`,
      options: [row[1], 'המסקנה ההפוכה נכונה', 'אין שום מידע רלוונטי', 'כל התשובות נכונות'],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 4 + (i % 5),
      targetIds: TOPIC_TARGETS.topic_logic,
      validationStatus: 'pending',
    });
  }

  const analogies = [
    ['רופא', 'מרפאה', 'מורה', 'כיתה', 'בעל מקצוע פועל במקום עבודתו המרכזי.'],
    ['מצפן', 'כיוון', 'שעון', 'זמן', 'כלי שמודד/מציג מושג מופשט.'],
    ['מפתח', 'מנעול', 'סיסמה', 'חשבון', 'אמצעי פתיחה או גישה.'],
    ['ספר', 'קריאה', 'מפה', 'ניווט', 'אובייקט המשמש לפעולה מרכזית.'],
    ['זרע', 'עץ', 'רעיון', 'תוכנית', 'דבר ראשוני שמתפתח לתוצר מורכב.'],
  ];
  for (let i = 0; i < 45; i++) {
    const a = analogies[i % analogies.length];
    seeds.push({
      topicId: 'topic_verbal',
      prefix: 'admin_pending_verbal_analogy',
      questionType: 'verbal',
      questionText: `${a[0]} : ${a[1]} כמו ${a[2]} : ?`,
      options: [a[3], 'מספר', 'צבע', 'מרחק'],
      correctIndex: 0,
      explanation: a[4],
      difficulty: 2 + (i % 7),
      targetIds: TOPIC_TARGETS.topic_verbal,
      validationStatus: 'pending',
    });
  }

  const sentenceCompletions = [
    ['למרות שהמשימה היתה מורכבת, הצוות פעל באופן ___ ולכן סיים בזמן.', 'שיטתי', 'אקראי', 'מהוסס', 'מרושל', 'המילה שיטתי מתאימה להשלמת פעולה מורכבת בזמן.'],
    ['הנתון החדש לא סתר את ההשערה, אלא דווקא ___ אותה.', 'חיזק', 'ביטל', 'הסתיר', 'עיכב', 'המילה חיזק מתאימה לניגוד "לא סתר אלא".'],
    ['כדי להצליח במבחן מהיר נדרש לא רק ידע, אלא גם ___ בקצב העבודה.', 'שליטה', 'היסוס', 'פיזור', 'עומס', 'שליטה בקצב היא תנאי להצלחה תחת זמן.'],
    ['ההסבר היה קצר אך ___, ולכן רוב המשתתפים הבינו אותו.', 'מדויק', 'מעורפל', 'סותר', 'חסר', 'הבנה גבוהה נובעת מהסבר מדויק.'],
  ];
  for (let i = 0; i < 36; i++) {
    const s = sentenceCompletions[i % sentenceCompletions.length];
    seeds.push({
      topicId: 'topic_verbal',
      prefix: 'admin_pending_verbal_completion',
      questionType: 'fill_in_the_blank',
      questionText: s[0],
      options: [s[1], s[2], s[3], s[4]],
      correctIndex: 0,
      explanation: s[5],
      difficulty: 3 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_verbal,
      validationStatus: 'pending',
    });
  }

  const rotations = [
    ['▲', 'ימינה ב-90°', '▶', 'משולש שפונה למעלה יפנה ימינה לאחר סיבוב של 90 מעלות.'],
    ['▶', 'שמאלה ב-90°', '▲', 'סיבוב שמאלה מחזיר את החץ/משולש כלפי מעלה.'],
    ['└', 'ימינה ב-90°', '┌', 'הפינה התחתונה-שמאלית הופכת לפינה עליונה-שמאלית.'],
    ['┐', '180°', '└', 'סיבוב של 180 מעלות מחליף פינות באלכסון.'],
    ['▰', '90°', '▯', 'מלבן אופקי הופך למלבן אנכי.'],
  ];
  for (let i = 0; i < 48; i++) {
    const r = rotations[i % rotations.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'admin_pending_spatial_rotation',
      questionType: 'shapes',
      questionText: `איזו צורה מתקבלת אם מסובבים את ${r[0]} ${r[1]}?`,
      options: [r[2], r[0], '◆', '●'],
      correctIndex: 0,
      explanation: r[3],
      difficulty: 2 + (i % 7),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const cubeNets = [
    ['שש פאות ברצף: ארבע בשורה, אחת מעל השנייה ואחת מתחת לשנייה השנייה', 'כן', 'זוהי פריסה תקינה של קובייה עם רצועה מרכזית ושתיים צמודות.'],
    ['שש פאות כולן בשורה אחת', 'לא', 'שש פאות בשורה אחת אינן יכולות להתקפל לקובייה סגורה.'],
    ['צלב של ארבע פאות אנכיות ופאה אחת מכל צד של המרכז', 'כן', 'מבנה צלב סטנדרטי מתקפל לקובייה.'],
    ['ריבוע 2×3 מלא', 'לא', 'מלבן 2×3 מלא יוצר חפיפות בעת קיפול לקובייה.'],
  ];
  for (let i = 0; i < 36; i++) {
    const n = cubeNets[i % cubeNets.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'admin_pending_spatial_nets',
      questionType: 'shapes',
      questionText: `האם הפריסה הבאה יכולה ליצור קובייה? ${n[0]}`,
      options: [n[1], n[1] === 'כן' ? 'לא' : 'כן', 'רק אם מסובבים', 'אי אפשר לדעת'],
      correctIndex: 0,
      explanation: n[2],
      difficulty: 4 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  return seeds;
}

function expandedSpatialReasoningVarietyQuestions(): GeneratedQuestionSeed[] {
  const seeds: GeneratedQuestionSeed[] = [];

  const mirrors = [
    ['חץ פונה ימינה', 'חץ פונה שמאלה', 'במראה אנכית ימין ושמאל מתחלפים.'],
    ['האות ב׳ פתוחה שמאלה', 'האות נראית פתוחה ימינה', 'שיקוף אנכי מחליף את צד הפתיחה של הצורה.'],
    ['משולש עם נקודה בצד ימין', 'הנקודה תופיע בצד שמאל', 'המראה מחליפה צדדים אך לא את המיקום האנכי.'],
    ['צורת L עם זרוע תחתונה ימינה', 'צורת L עם זרוע תחתונה שמאלה', 'הזרוע האופקית עוברת לצד הנגדי.'],
    ['חץ אלכסוני עולה ימינה', 'חץ אלכסוני עולה שמאלה', 'במראה אנכית הכיוון האופקי מתהפך והעלייה נשארת עלייה.'],
  ];
  for (let i = 0; i < 40; i++) {
    const row = mirrors[i % mirrors.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_mirror_reflection_plus',
      questionType: 'shapes',
      questionText: `מה יתקבל בשיקוף מראה אנכי של ${row[0]}?`,
      options: [row[1], row[0], 'הצורה תסתובב ב-180 מעלות', 'לא יחול שינוי'],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 2 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const folds = [
    ['מקפלים דף לשניים לאורך ומחוררים חור אחד ליד הקפל', 'שני חורים סימטריים משני צדי הקפל', 'פתיחת הקיפול משכפלת את החור לצד השני במרחק שווה מהקפל.'],
    ['מקפלים דף לשניים לרוחב ומחוררים בפינה העליונה', 'שני חורים באותו טור, אחד למעלה ואחד למטה', 'קיפול רוחבי יוצר השתקפות מעל ומתחת לקו הקיפול.'],
    ['מקפלים דף פעמיים, לאורך ואז לרוחב, ומחוררים חור אחד קרוב למרכז', 'ארבעה חורים סימטריים סביב המרכז', 'שני קיפולים מכפילים את החור פעם בכל ציר ולכן מתקבלים ארבעה חורים.'],
    ['מקפלים ריבוע באלכסון ומחוררים ליד האלכסון', 'שני חורים משני צדי האלכסון', 'האלכסון משמש כקו מראה ולכן החור משתקף לצד השני.'],
  ];
  for (let i = 0; i < 36; i++) {
    const row = folds[i % folds.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_paper_folding_holes_plus',
      questionType: 'shapes',
      questionText: `${row[0]}. מה נראה כשפותחים את הדף?`,
      options: [row[1], 'חור אחד בלבד', 'שלושה חורים בשורה', 'החורים יופיעו רק בצד ימין'],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 3 + (i % 7),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const cubeFaces = [
    { description: 'אדום מול כחול, ירוק מול צהוב, לבן מול שחור', pairs: [['אדום', 'כחול'], ['ירוק', 'צהוב'], ['לבן', 'שחור']] },
    { description: '1 מול 6, 2 מול 5, 3 מול 4', pairs: [['1', '6'], ['2', '5'], ['3', '4']] },
    { description: 'צפון מול דרום, מזרח מול מערב, מעלה מול מטה', pairs: [['צפון', 'דרום'], ['מזרח', 'מערב'], ['מעלה', 'מטה']] },
    { description: 'עיגול מול משולש, ריבוע מול כוכב, קו מול נקודה', pairs: [['עיגול', 'משולש'], ['ריבוע', 'כוכב'], ['קו', 'נקודה']] },
  ];
  for (let i = 0; i < 40; i++) {
    const row = cubeFaces[i % cubeFaces.length];
    const pair = row.pairs[i % row.pairs.length];
    const subject = pair[0];
    const answer = pair[1];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_cube_opposites_plus',
      questionType: 'shapes',
      questionText: `בקובייה נתון: ${row.description}. איזו פאה נמצאת מול ${subject}?`,
      options: [answer, subject, 'אין מספיק מידע', 'פאה סמוכה בלבד'],
      correctIndex: 0,
      explanation: `לפי הנתון, ${subject} ו-${answer} הן פאות מנוגדות, ולכן הפאה שמול ${subject} היא ${answer}.`,
      difficulty: 3 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const sideViews = [
    [[3, 1, 2], '3', 'במבט צד רואים את הגובה הגבוה ביותר לאורך השורה, שהוא 3.'],
    [[1, 4, 2], '4', 'המבט מהצד מסתיר עומק אך שומר את הגובה המרבי, 4.'],
    [[2, 2, 5], '5', 'העמודה הגבוהה ביותר קובעת את הגובה הנראה מהצד.'],
    [[1, 3, 3], '3', 'שתי עמודות בגובה 3 נראות כגובה מרבי של 3.'],
    [[4, 2, 1], '4', 'העמודה הראשונה היא הגבוהה ביותר ולכן הגובה הנראה הוא 4.'],
  ] as const;
  for (let i = 0; i < 45; i++) {
    const row = sideViews[i % sideViews.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_side_view_heights_plus',
      questionType: 'shapes',
      questionText: `שלוש עמודות קוביות בגבהים ${row[0].join(', ')} מסודרות בשורה. מה הגובה שייראה במבט צד?`,
      options: [row[1], String(Number(row[1]) + 1), String(Math.max(1, Number(row[1]) - 1)), String(row[0].reduce((a, b) => a + b, 0))],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 2 + (i % 7),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const paths = [
    ['צעד ימינה, צעד למעלה, שני צעדים שמאלה', 'צעד אחד שמאלה וצעד אחד למעלה מנקודת ההתחלה', 'מאזנים תנועות: ימינה 1 ושמאלה 2 נותנים שמאלה 1; למעלה נשאר 1.'],
    ['שני צעדים ימינה, שני צעדים למטה, צעד שמאלה', 'צעד אחד ימינה ושני צעדים למטה', 'ימינה 2 פחות שמאלה 1 נותן ימינה 1; למטה נשאר 2.'],
    ['צעד למעלה, צעד ימינה, צעד למטה, צעד ימינה', 'שני צעדים ימינה מנקודת ההתחלה', 'למעלה ולמטה מתבטלים, ושני צעדי ימינה נשארים.'],
    ['שלושה צעדים למעלה, צעד למטה, צעד שמאלה', 'שני צעדים למעלה וצעד שמאלה', '3 למעלה פחות 1 למטה נותנים 2 למעלה, ועוד צעד שמאלה.'],
  ];
  for (let i = 0; i < 36; i++) {
    const row = paths[i % paths.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_grid_navigation_plus',
      questionType: 'shapes',
      questionText: `אדם נע על משבצות: ${row[0]}. היכן הוא ביחס לנקודת ההתחלה?`,
      options: [row[1], 'בדיוק בנקודת ההתחלה', 'שני צעדים ימינה בלבד', 'צעד אחד למטה בלבד'],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 3 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const matrices = [
    ['בשורה הראשונה מספר הצלעות עולה: משולש, ריבוע, מחומש. בשורה השנייה: ריבוע, מחומש, ?', 'משושה', 'הדפוס הוא עלייה של צלע אחת בכל צעד, לכן אחרי מחומש מגיע משושה.'],
    ['בכל שורה הצבע מתחלף: כהה, בהיר, כהה. השורה הבאה מתחילה בהיר, כהה, ?', 'בהיר', 'הדפוס מתחלף לסירוגין ולכן אחרי כהה מגיע בהיר.'],
    ['בכל עמודה הצורה מסתובבת 90 מעלות בכיוון השעון. למעלה חץ למעלה, באמצע חץ ימינה, למטה ?', 'חץ למטה', 'עוד סיבוב של 90 מעלות מחץ ימינה נותן חץ למטה.'],
    ['מספר הנקודות בתאים הוא 1,2,3 ואז 2,3,?.', '4', 'בכל שורה המספר גדל באחד, לכן אחרי 3 מגיע 4.'],
  ];
  for (let i = 0; i < 44; i++) {
    const row = matrices[i % matrices.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_shape_matrix_plus',
      questionType: 'shapes',
      questionText: `מטריצת צורות: ${row[0]}`,
      options: [row[1], 'ריבוע', 'משולש', 'אין שינוי'],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 4 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  const hiddenBlocks = [
    [[3, 3, 3], '27', 'קובייה מלאה 3×3×3 מכילה 27 קוביות קטנות.'],
    [[2, 3, 4], '24', 'מכפילים אורך×רוחב×גובה: 2×3×4=24.'],
    [[4, 4, 1], '16', 'שכבה אחת בגודל 4×4 מכילה 16 קוביות.'],
    [[2, 2, 5], '20', 'יש 2×2 עמודות וכל אחת בגובה 5, יחד 20 קוביות.'],
  ] as const;
  for (let i = 0; i < 36; i++) {
    const row = hiddenBlocks[i % hiddenBlocks.length];
    seeds.push({
      topicId: 'topic_spatial',
      prefix: 'spatial_hidden_block_count_plus',
      questionType: 'shapes',
      questionText: `מבנה מלא של קוביות במידות ${row[0][0]}×${row[0][1]}×${row[0][2]}. כמה קוביות קטנות יש בו?`,
      options: [row[1], String(Number(row[1]) - 2), String(Number(row[1]) + 4), String(row[0][0] + row[0][1] + row[0][2])],
      correctIndex: 0,
      explanation: row[2],
      difficulty: 3 + (i % 6),
      targetIds: TOPIC_TARGETS.topic_spatial,
      validationStatus: 'pending',
    });
  }

  return seeds;
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
  ...massiveQuantitativeQuestions(),
  ...massiveLogicQuestions(),
  ...massiveVerbalQuestions(),
  ...massiveSpatialQuestions(),
  ...pendingAdminValidationQuestions(),
  ...expandedSpatialReasoningVarietyQuestions(),
];

export const EXPANDED_PSYCHOTECHNIC_QUESTIONS: Question[] = RAW_EXPANDED_QUESTIONS.map(createQuestion);
