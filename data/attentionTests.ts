import type { AttentionBoard, ReasoningForm, ReasoningQuestion } from './reasoningTests';

// Fixed, reproducible boards: a retake uses the same form on every platform.
function random(seed: number) {
  let state = seed;
  return (length: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 2 ** 32) * length);
  };
}

function shuffle<T>(items: T[], pick: (length: number) => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const digits = ['2', '3', '4', '5', '6', '7', '8', '9'];
const targets = ['27', '83', '65', '32', '49', '76', '94', '58', '63', '87', '25', '74'];
const desired = [3, 6, 4, 2, 7, 5, 2, 6, 4, 7, 3, 5];
const correctSlots = [2, 0, 3, 1, 3, 1, 0, 2, 1, 3, 2, 0];

function countOptions(count: number, answer: number, pick: (n: number) => number) {
  const options = shuffle([count - 1, count + 1, count + 2], pick);
  options.splice(answer, 0, count);
  return options.map(String);
}

function scanQuestion(target: string, i: number): ReasoningQuestion {
  const pick = random(8941 + i * 467);
  const [a, b] = target;
  const width = 5;
  const height = i < 4 ? 3 : 4;
  const hits = desired[i];
  const alternatives = [b+a, a+a, b+b, ...digits.filter(d => d !== a && d !== b).flatMap(d => [a+d, d+b])];
  const cells = shuffle([
    ...Array<string>(hits).fill(target),
    ...Array.from({ length: height * width - hits }, () => alternatives[pick(alternatives.length)]),
  ], pick);
  const board: AttentionBoard = Array.from({ length: height }, (_, row) => ({
    tokens: cells.slice(row * width, (row + 1) * width),
  }));
  const countByRow = board.map(({ tokens }) => tokens.filter(token => token === target).length);
  return {
    id: `scan-${i + 1}`, domain: 'scan', board,
    prompt: `כמה פעמים מופיע הצירוף ${target} בדיוק כפי שהוא כתוב? ספרו רק תאים זהים בלוח שלפניכם, לא צירופים שמתהפכים או חוצים תאים.`,
    answer: correctSlots[i], options: countOptions(hits, correctSlots[i], pick),
    explanation: `סופרים רק תאים שבהם מופיע ${target} בשלמותו. מלמעלה למטה, מספר ההתאמות בכל שורה הוא: ${countByRow.join(', ')}. בסך הכול: ${hits}.`,
  };
}

function ruleQuestion(i: number): ReasoningQuestion {
  const pick = random(13723 + i * 853);
  const width = 5;
  const height = i < 4 ? 3 : 4;
  const hits = desired[(i + 5) % desired.length];
  const even = i % 2 === 0;
  const cues = Array.from({ length: height }, (_, row) => (row % 2 === 0) === even);
  const cells = shuffle(Array.from({ length: width * height }, (_, j) => j < hits), pick);
  const board: AttentionBoard = cues.map((isEven, row) => ({
    cue: isEven ? 'זוגי' : 'אי־זוגי',
    tokens: Array.from({ length: width }, (_, col) => {
      const expectedEven = cells[row * width + col] ? isEven : !isEven;
      const pool = expectedEven ? ['2', '4', '6', '8'] : ['1', '3', '5', '7', '9'];
      return pool[pick(pool.length)];
    }),
  }));
  const countByRow = board.map(({ tokens }, row) => tokens.filter(token => (Number(token) % 2 === 0) === cues[row]).length);
  return {
    id: `rules-${i + 1}`, domain: 'rules', board,
    prompt: 'בכל שורה יש תווית משלה: בשורת ״זוגי״ ספרו רק ספרות זוגיות, ובשורת ״אי־זוגי״ רק ספרות אי־זוגיות. כמה תאים מתאימים לכלל של השורה שלהם בסך הכול?',
    answer: correctSlots[correctSlots.length - i - 1], options: countOptions(hits, correctSlots[correctSlots.length - i - 1], pick),
    explanation: `בודקים מחדש את התווית בכל שורה. מספר הספרות שמתאימות, מהשורה העליונה לתחתונה: ${countByRow.join(', ')}. בחיבור כל השורות מתקבל ${hits}.`,
  };
}

export const attentionForms: readonly ReasoningForm[] = [
  { id: 'scan', title: 'חיפוש חזותי', description: 'איתור צירופים מדויקים בין מסיחים דומים. הלוחות גדלים בהמשך.', items: targets.map(scanQuestion) },
  { id: 'rules', title: 'החלפת כללים', description: 'הכלל משתנה משורה לשורה: עוברים בין חיפוש ספרות זוגיות לבין ספרות אי־זוגיות.', items: targets.map((_, i) => ruleQuestion(i)) },
];
