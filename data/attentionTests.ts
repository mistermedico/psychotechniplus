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
  matches: (token: string, row: number, col: number) => boolean,
): VisualSearchItem {
  const targets: number[] = [];
  let cell = 0;
  const counts = board.map(({ tokens }, row) => {
    let count = 0;
    for (const [col, token] of tokens.entries()) {
      if (matches(token, row, col)) {
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

function visualDimensions(round: number) {
  return { width: round === 0 ? 4 : 5, height: [3, 4, 4, 5][round] };
}

function visualBoard(round: number, seed: number) {
  const pick = random(seed + round * 3917);
  const { width, height } = visualDimensions(round);
  const rows = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => pairs[pick(pairs.length)]));
  return { pick, rows, width, height };
}

function twinSearch(round: number) {
  const { pick, rows, width, height } = visualBoard(round, 4851681);
  for (let row = 0; row < height; row += 2) {
    const col = pick(width - 1);
    rows[row][col + 1] = rows[row][col];
    if (round === 3 && row === 0) rows[row].splice(0, 3, '58', '58', '58');
  }
  return buildVisualItem(
    `visual-twin-${round + 1}`, 'תאומים צמודים',
    'סמנו כל תא שיש לידו צירוף זהה בדיוק, משמאל או מימין באותה שורה. סמנו את שני הצדדים של כל זוג; ברצף של שלושה זהים סמנו את שלושתם. אל תחברו בין שורות.',
    'רק שכנים אופקיים נבדקים. גם תא בקצה השורה יכול להיות חלק מזוג; זהות בין תאים שאינם צמודים אינה מספיקה.',
    rows.map(tokens => ({ tokens })),
    (token, row, col) => rows[row][col - 1] === token || rows[row][col + 1] === token,
  );
}

function mirrorPositionSearch(round: number) {
  const { pick, rows, width, height } = visualBoard(round, 8644531);
  for (let row = 0; row < height; row++) {
    if (row % 3 === 2) continue;
    const col = pick(Math.floor(width / 2));
    rows[row][width - 1 - col] = rows[row][col];
  }
  return buildVisualItem(
    `visual-position-${round + 1}`, 'מיקומי מראה',
    'סמנו את שני התאים בכל זוג שנמצא במיקומי מראה באותה שורה ובו מופיע אותו צירוף: הראשון מול האחרון, השני מול הלפני־אחרון. אל תסמנו תא אמצעי.',
    'משווים מרחקים שווים משני הקצוות של השורה. הצירוף עצמו אינו מתהפך: שני הערכים צריכים להיות זהים בדיוק.',
    rows.map(tokens => ({ tokens })),
    (token, row, col) => col !== width - 1 - col && rows[row][width - 1 - col] === token,
  );
}

function peakSearch(round: number) {
  const { pick, rows, width } = visualBoard(round, 5581253);
  const col = 1 + pick(width - 2);
  rows[0].splice(col - 1, 3, '18', '89', '42');
  if (round > 1) rows[1].splice(0, 3, '23', '84', '84');
  return buildVisualItem(
    `visual-peak-${round + 1}`, 'שיא מקומי',
    'כל תא הוא מספר דו־ספרתי. סמנו מספר שגדול ממש משני המספרים הצמודים לו באותה שורה. אין לסמן תאים בקצוות או מספר ששווה לאחד משכניו.',
    'משווים את ערך המספר לשכן המיידי משמאל ולשכן המיידי מימין בלבד. צריך להיות גדול משניהם, לא רק מאחד.',
    rows.map(tokens => ({ tokens })),
    (token, row, col) => col > 0 && col < width - 1
      && Number(token) > Number(rows[row][col - 1]) && Number(token) > Number(rows[row][col + 1]),
  );
}

function columnRepeatSearch(round: number) {
  const { pick, rows, width, height } = visualBoard(round, 3735461);
  for (let col = 0; col < width; col += 2) {
    const first = pick(height);
    const second = (first + 1 + pick(height - 1)) % height;
    const pair = rows[first][col];
    rows[second][col] = pair;
    for (let row = 0; row < height; row++) {
      if (row !== first && row !== second && rows[row][col] === pair) {
        rows[row][col] = pair === '11' ? '29' : '11';
      }
    }
  }
  if (round > 1) for (let row = 0; row < 3; row++) rows[row][1] = '63';
  return buildVisualItem(
    `visual-column-${round + 1}`, 'חזרה אנכית מדויקת',
    'סמנו את שני התאים עם כל צירוף שמופיע בדיוק פעמיים באותה עמודה. בדקו כל עמודה בנפרד. אל תסמנו צירוף שמופיע בעמודה רק פעם אחת או שלוש פעמים ויותר.',
    'הספירה נעשית בכל עמודה לכל צירוף בנפרד. שני התאים לא חייבים להיות צמודים, ומופעים בעמודות אחרות אינם נספרים.',
    rows.map(tokens => ({ tokens })),
    (token, _row, col) => rows.reduce((count, tokens) => count + Number(tokens[col] === token), 0) === 2,
  );
}

const visualShapes = [
  { glyph: '○', label: 'עיגול' },
  { glyph: '△', label: 'משולש' },
  { glyph: '□', label: 'ריבוע' },
  { glyph: '◇', label: 'מעוין' },
] as const;
function featureSearch(round: number) {
  const pick = random(5743771 + round * 3917);
  const { width, height } = visualDimensions(round);
  const shape = visualShapes[round];
  const parity = round % 2 === 0 ? 0 : 1;
  const parityLabel = parity === 0 ? 'זוגית' : 'אי־זוגית';
  const digitList = searchDigits.filter(digit => Number(digit) % 2 === parity);
  const opposite = searchDigits.filter(digit => !digitList.includes(digit));
  const answer = (token: string) => token.startsWith(shape.glyph) && Number(token.slice(1)) % 2 === parity;
  const candidates = visualShapes.flatMap(({ glyph }) => searchDigits.map(digit => glyph + digit));
  const others = candidates.filter(token => !answer(token));
  const differentShape = visualShapes[(round + 1) % visualShapes.length].glyph;
  const cells = shuffle([
    ...Array.from({ length: 3 + round }, () => shape.glyph + digitList[pick(digitList.length)]),
    shape.glyph + opposite[pick(opposite.length)],
    differentShape + digitList[pick(digitList.length)],
    ...Array.from({ length: width * height - 5 - round }, () => others[pick(others.length)]),
  ], pick);
  return buildVisualItem(
    `visual-feature-${round + 1}`, 'צורה וגם ספרה',
    `סמנו את כל התאים שמכילים גם ${shape.label} (${shape.glyph}) וגם ספרה ${parityLabel}. תא שעומד רק באחד התנאים אינו מטרה.`,
    `המטרה מתקיימת רק כששני המאפיינים נמצאים באותו תא: ${shape.label} וספרה ${parityLabel}.`,
    Array.from({ length: height }, (_, row) => ({ tokens: cells.slice(row * width, (row + 1) * width) })),
    answer,
  );
}

function aboveReverseSearch(round: number) {
  const { pick, rows, width, height } = visualBoard(round, 6586711);
  for (let row = 1; row < height; row++) {
    const col = pick(width);
    const reference = rows[row - 1][col];
    if (reference === reverse(reference)) rows[row - 1][col] = '27';
    rows[row][col] = reverse(rows[row - 1][col]);
  }
  if (round > 1) {
    rows[0][0] = '66';
    rows[1][0] = '66';
    rows[0][width - 1] = '48';
    rows[1][width - 1] = '84';
  }
  return buildVisualItem(
    `visual-above-${round + 1}`, 'היפוך אנכי',
    'סמנו רק את התא התחתון כאשר שתי ספרותיו מופיעות בסדר הפוך מהתא שמעליו באותה עמודה. לדוגמה: אם 27 מעל 72 סמנו 72. שתי ספרות זהות אינן נחשבות להיפוך.',
    'בודקים את התא שמעל כל תא, לא את זה שמתחתיו. השורה העליונה לא יכולה להכיל מטרות.',
    rows.map(tokens => ({ tokens })),
    (token, row, col) => row > 0 && token[0] !== token[1] && token === reverse(rows[row - 1][col]),
  );
}

function rowEndingSearch(round: number) {
  const { pick, rows, width } = visualBoard(round, 7581731);
  const clues = shuffle([...searchDigits], pick).slice(0, rows.length);
  rows.forEach((tokens, row) => {
    const col = pick(width);
    const distractorCol = (col + 1) % width;
    const clue = clues[row];
    const different = searchDigits.filter(digit => digit !== clue);
    tokens[col] = different[pick(different.length)] + clue;
    tokens[distractorCol] = clue + different[pick(different.length)];
  });
  return buildVisualItem(
    `visual-ending-${round + 1}`, 'סיומת לפי רמז',
    'לכל שורה ספרת סיום משלה, המופיעה בתווית. סמנו כל תא שהספרה הימנית שלו תואמת לספרת הסיום של השורה. התאמה של הספרה השמאלית בלבד אינה מספיקה.',
    'ספרת הסיום היא הספרה הימנית בכל צירוף. עוברים שורה־שורה ובודקים מחדש את התווית.',
    rows.map((tokens, row) => ({ cue: `סיומת ${clues[row]}`, tokens })),
    (token, row) => token[1] === clues[row],
  );
}

/** Targets index individual cells left-to-right, top-to-bottom, starting at zero. */
export const visualSearchItems: readonly VisualSearchItem[] = [
  ...Array.from({ length: 4 }, (_, round) => [
    exactSearch(round), eitherSearch(round), uniqueSearch(round), reverseSearch(round), orderSearch(round),
  ]).flat(),
  ...Array.from({ length: 4 }, (_, round) => [
    twinSearch(round), mirrorPositionSearch(round), peakSearch(round), columnRepeatSearch(round),
    featureSearch(round), aboveReverseSearch(round), rowEndingSearch(round),
  ]).flat(),
];
