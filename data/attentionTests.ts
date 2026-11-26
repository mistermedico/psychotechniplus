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

export type VisualSearchItem = Readonly<{
  id: string;
  prompt: string;
  board: AttentionBoard;
  targets: readonly number[];
  kind: string;
  explanation: string;
}>;

type DigitPair = string;
const searchDigits = ['1', ...digits];
const pairs = searchDigits.flatMap(a => searchDigits.map(b => a + b));
const reverse = (pair: DigitPair) => [...pair].reverse().join('');

function confusablePairs(pair: DigitPair) {
  const [first, second] = pair;
  return [...new Set([
    reverse(pair), first + first, second + second,
    ...searchDigits.flatMap(digit => [first + digit, digit + second]),
  ])].filter(candidate => candidate !== pair);
}

function buildVisualItem(
  id: string,
  kind: string,
  prompt: string,
  rationale: string,
  board: AttentionBoard,
  matches: (token: string, row: number) => boolean,
): VisualSearchItem {
  const targets: number[] = [];
  let cell = 0;
  const counts = board.map(({ tokens }, row) => {
    let count = 0;
    for (const token of tokens) {
      if (matches(token, row)) {
        targets.push(cell);
        count++;
      }
      cell++;
    }
    return count;
  });
  return {
    id, kind, prompt, board, targets,
    explanation: `${rationale} סומנו ${targets.length} תאי מטרה. מספר המטרות בכל שורה מלמעלה למטה: ${counts.join(', ')}.`,
  };
}

function distribute(
  round: number,
  seed: number,
  correct: readonly string[],
  distractors: readonly string[],
): AttentionBoard {
  const pick = random(seed);
  const width = round === 0 ? 4 : 5;
  const height = round < 2 ? 3 : round === 2 ? 4 : 5;
  const cells = shuffle([
    ...correct,
    ...Array.from({ length: width * height - correct.length }, () => distractors[pick(distractors.length)]),
  ], pick);
  return Array.from({ length: height }, (_, row) => ({
    tokens: cells.slice(row * width, (row + 1) * width),
  }));
}

const exactPairs = ['27', '63', '38', '94'];
function exactSearch(round: number) {
  const pair = exactPairs[round];
  return buildVisualItem(
    `visual-exact-${round+1}`, 'התאמה מדויקת',
    `סמנו את כל התאים שבהם מופיע בדיוק הצירוף ${pair}. אל תסמנו את הצירוף ההפוך או תא שרק ספרה אחת בו תואמת.`,
    `רק הצירוף ${pair} בסדר הנתון מתאים.`,
    distribute(round, 273431 + round * 2311, Array<string>(round + 2).fill(pair), confusablePairs(pair)),
    token => token === pair,
  );
}

const eitherPairs = [['37', '74'], ['16', '81'], ['24', '92'], ['53', '68']];
function eitherSearch(round: number) {
  const [a, b] = eitherPairs[round];
  const distractors = [...new Set([...confusablePairs(a), ...confusablePairs(b)])]
    .filter(candidate => candidate !== a && candidate !== b);
  return buildVisualItem(
    `visual-either-${round+1}`, 'שתי מטרות',
    `סמנו כל תא שבו מופיע אחד משני הצירופים: ${a} או ${b}. חפשו את שניהם בלוח, בדיוק בסדר הנתון.`,
    `כל תא נבדק בנפרד: או ${a} או ${b}, לא גרסה הפוכה.`,
    distribute(round, 673463 + round * 7733, [a, b, a, ...(round > 1 ? [b, a] : [])], distractors),
    token => token === a || token === b,
  );
}

const uniqueSets = [
  ['28', '82', '29', '89'],
  ['39', '93', '36', '96', '63'],
  ['46', '64', '49', '94', '69', '96'],
  ['57', '75', '59', '95', '79', '97'],
];
function uniqueSearch(round: number) {
  const [unique, ...others] = uniqueSets[round];
  const width = round === 0 ? 4 : 5;
  const height = round < 2 ? 3 : round === 2 ? 4 : 5;
  const distractors = Array.from({ length: width * height - 1 }, (_, index) => others[index % others.length]);
  const pick = random(963431 + round * 3593);
  const cells = shuffle([unique, ...distractors], pick);
  const board = Array.from({ length: height }, (_, row) => ({
    tokens: cells.slice(row * width, (row + 1) * width),
  }));
  return buildVisualItem(
    `visual-unique-${round+1}`, 'הצירוף החריג',
    'סמנו את התא היחיד שהצירוף שבו מופיע פעם אחת בלבד בכל הלוח. צירוף בסדר הפוך נחשב צירוף אחר.',
    `הצירוף ${unique} מופיע פעם אחת בלבד; כל הצירופים האחרים מופיעים לפחות פעמיים.`,
    board, token => token === unique,
  );
}

const reversePairs = ['49', '26', '87', '18'];
function reverseSearch(round: number) {
  const clue = reversePairs[round];
  const target = reverse(clue);
  return buildVisualItem(
    `visual-reverse-${round+1}`, 'סדר הפוך',
    `הפכו את סדר הספרות בצירוף ${clue}, ואז סמנו רק את כל התאים עם הצירוף ההפוך. הצירוף המקורי אינו מטרה.`,
    `הספרה הימנית עוברת לשמאל והשמאלית לימין: ${clue} הופך ל־${target}.`,
    distribute(round, 713429 + round * 6389, Array<string>(round + 2).fill(target), confusablePairs(target)),
    token => token === target,
  );
}

function orderSearch(round: number) {
  const pick = random(492433 + round * 5711);
  const width = round === 0 ? 4 : 5;
  const height = round < 2 ? 3 : round === 2 ? 4 : 5;
  const belongs = ([left, right]: DigitPair, ascending: boolean) =>
    ascending ? left < right : left > right;
  const board = Array.from({ length: height }, (_, row) => {
    const ascending = (row + round) % 2 === 0;
    const match = pairs.filter(pair => belongs(pair, ascending));
    const other = pairs.filter(pair => !belongs(pair, ascending));
    const hits = row % 3 === 1 ? 2 : 1;
    return {
      cue: ascending ? 'עולה' : 'יורד',
      tokens: shuffle([
        ...Array.from({ length: hits }, () => match[pick(match.length)]),
        ...Array.from({ length: width - hits }, () => other[pick(other.length)]),
      ], pick),
    };
  });
  return buildVisualItem(
    `visual-order-${round+1}`, 'כלל משתנה לפי שורה',
    'בכל שורה סמנו את כל התאים שתואמים לתווית שלה. השוו משמאל לימין: ״עולה״ אם הספרה השמאלית קטנה מהימנית, ״יורד״ אם היא גדולה ממנה. שתי ספרות זהות אינן מטרה.',
    'הכלל מתחלף משורה לשורה. ההשוואה היא תמיד מהספרה השמאלית לימנית בתוך כל תא.',
    board, (token, row) => belongs(token, board[row].cue === 'עולה'),
  );
}

/** Targets index individual cells left-to-right, top-to-bottom, starting at zero. */
export const visualSearchItems: readonly VisualSearchItem[] = Array.from({ length: 4 }, (_, round) => [
  exactSearch(round), eitherSearch(round), uniqueSearch(round), reverseSearch(round), orderSearch(round),
]).flat();
