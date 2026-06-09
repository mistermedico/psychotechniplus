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

const RAW_EXPANDED_QUESTIONS: GeneratedQuestionSeed[] = [
  ...seriesQuestions(),
  ...quantitativeQuestions(),
  ...verbalQuestions(),
  ...spatialQuestions(),
];

export const EXPANDED_PSYCHOTECHNIC_QUESTIONS: Question[] = RAW_EXPANDED_QUESTIONS.map(createQuestion);

