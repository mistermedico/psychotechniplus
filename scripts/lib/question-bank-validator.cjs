'use strict';

/**
 * Question bank validator.
 *
 * Runs before any question import/seed (see question-import-guard.cjs) and via
 * `npm run validate:questions`. Accepts rows in either DB shape (snake_case) or
 * app shape (camelCase).
 *
 * Errors block the import. Warnings are printed but do not block.
 */

const crypto = require('crypto');

// Option texts that are placeholders or content-free distractors.
const PLACEHOLDER_OPTION_PATTERNS = [
  /האפשרות הראשונה ברשימה/,
  /-\s*מסיח\s*\d+$/,
  /^placeholder$/i,
  /^todo$/i,
  /^lorem/i,
];

// Sets of generic distractors that were reused across many questions.
const GENERIC_DISTRACTOR_SETS = [
  ['מכשיר', 'תוצאה', 'מקום'],
  ['מקום', 'זמן', 'מספר'],
  ['אותה צורה ללא שינוי', 'סימן למעלה', 'סימן למטה'],
  ['אין מסקנה אפשרית', 'האפשרות ההפוכה', 'כל התשובות נכונות'],
  ['שאלה : תשובה', 'זמן : שעון'],
];

// Option labels used by genuinely visual questions (the answer IS the image).
const VISUAL_LABEL_RE = /^(אפשרות|צורה)\s*([A-Da-d1-4]|[אבגד]׳?)$/;

function pick(row, snake, camel) {
  return row[snake] !== undefined ? row[snake] : row[camel];
}

function normalizeRow(row) {
  return {
    id: String(pick(row, 'id', 'id') ?? ''),
    topicId: pick(row, 'topic_id', 'topicId') ?? '',
    questionType: pick(row, 'question_type', 'questionType') ?? '',
    questionText: String(pick(row, 'question_text', 'questionText') ?? ''),
    mediaUrl: pick(row, 'media_url', 'mediaUrl') ?? null,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: String(pick(row, 'correct_answer', 'correctAnswer') ?? ''),
    explanation: String(row.explanation ?? ''),
    difficulty: Number(row.difficulty),
    validationStatus: pick(row, 'validation_status', 'validationStatus') ?? 'validated',
  };
}

function normalizeText(text) {
  return String(text ?? '')
    .replace(/[֑-ׇ]/g, '') // niqqud
    .replace(/[\s"'׳״.,:;!?()–—_]+/g, '')
    .toLowerCase();
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

/** Extracts the first <text> element of an SVG data URI (the title the image shows). */
function svgTitle(dataUri) {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/svg+xml')) return null;
  let svg;
  try {
    const payload = dataUri.slice(dataUri.indexOf(',') + 1);
    svg = dataUri.includes(';base64,')
      ? Buffer.from(payload, 'base64').toString('utf8')
      : decodeURIComponent(payload);
  } catch {
    return null;
  }
  const match = svg.match(/<text[^>]*>([^<]{4,})<\/text>/);
  return match ? match[1].trim() : null;
}

function parseNumber(text) {
  const cleaned = String(text).replace(/[,\s]/g, '').replace(/[^\d.\-/]/g, '');
  if (/^-?\d+\/\d+$/.test(cleaned)) {
    const [a, b] = cleaned.split('/').map(Number);
    return b ? a / b : NaN;
  }
  return cleaned ? Number(cleaned) : NaN;
}

function nextInSeries(values) {
  if (values.length < 4) return null;
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  if (diffs.every(d => d === diffs[0])) return values.at(-1) + diffs[0];
  const diffs2 = diffs.slice(1).map((v, i) => v - diffs[i]);
  if (diffs2.length >= 2 && diffs2.every(d => d === diffs2[0])) return values.at(-1) + diffs.at(-1) + diffs2[0];
  if (values.every(v => v !== 0)) {
    const ratios = values.slice(1).map((v, i) => v / values[i]);
    if (ratios.every(r => Math.abs(r - ratios[0]) < 1e-9)) return values.at(-1) * ratios[0];
  }
  if (diffs.every(d => d !== 0)) {
    const diffRatios = diffs.slice(1).map((v, i) => v / diffs[i]);
    if (diffRatios.length >= 2 && diffRatios.every(r => Math.abs(r - diffRatios[0]) < 1e-9)) {
      return values.at(-1) + diffs.at(-1) * diffRatios[0];
    }
  }
  return null; // rule not recognised -> no automatic verdict
}

/** Recomputes the answer for known templated question formats. Returns null when unknown. */
function expectedNumericAnswer(questionText) {
  const t = questionText.replace(/\s+/g, ' ').trim();
  let m;
  if ((m = t.match(/כמה הם (\d+(?:\.\d+)?)%\s*מ(?:תוך |-)?\s*(\d+(?:\.\d+)?)/))) return (Number(m[1]) * Number(m[2])) / 100;
  if ((m = t.match(/כמה הם (\d+)\/(\d+) מ-?(\d+)\/(\d+)/))) return (m[1] / m[2]) * (m[3] / m[4]);
  if ((m = t.match(/שארית החלוקה של (\d+) ב-?(\d+)/))) return Number(m[1]) % Number(m[2]);
  if ((m = t.match(/(\d+) פריטים קיבלו ציון (\d+) ו-(\d+) פריטים קיבלו ציון (\d+)/))) {
    const [n1, s1, n2, s2] = m.slice(1).map(Number);
    return (n1 * s1 + n2 * s2) / (n1 + n2);
  }
  if ((m = t.match(/פתור את המשוואה: (\d+)x ([+-]) (\d+) = (\d+)x ([+-]) (\d+)$/))) {
    const a = +m[1], b = (m[2] === '+' ? 1 : -1) * m[3], c = +m[4], d = (m[5] === '+' ? 1 : -1) * m[6];
    return a === c ? null : (d - b) / (a - c);
  }
  if ((m = t.match(/פתור את המשוואה: (\d+)x ([+-]) (\d+) = (\d+)$/))) return (m[4] - (m[2] === '+' ? 1 : -1) * m[3]) / m[1];
  if ((m = t.match(/פתור את המשוואה: (\d+)x ([+-]) (\d+)x = (\d+)$/))) {
    const k = m[2] === '+' ? +m[1] + +m[3] : m[1] - m[3];
    return k ? m[4] / k : null;
  }
  if ((m = t.match(/מכפל של שלושת הערכים\. אם הערכים הם (\d+), (\d+), (\d+)/))) return m[1] * m[2] * m[3];
  if ((m = t.match(/בסדרה\??:?\s*((?:-?\d+(?:\.\d+)?,\s*){3,}-?\d+(?:\.\d+)?),\s*_+/))) {
    return nextInSeries(m[1].split(',').map(s => Number(s.trim())));
  }
  return null;
}

/**
 * Validates a single question.
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateQuestion(rawRow) {
  const q = normalizeRow(rawRow);
  const errors = [];
  const warnings = [];

  if (!q.id) errors.push('חסר מזהה שאלה');
  if (q.questionText.trim().length < 8) errors.push('טקסט השאלה חסר או קצר מדי');
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 10) errors.push(`רמת קושי לא תקינה: ${q.difficulty}`);
  if (q.explanation.trim().length < 10) errors.push('הסבר חסר או קצר מדי');

  // --- options & correct answer -------------------------------------------
  const opts = q.options;
  if (opts.length < 2) errors.push('פחות משתי אפשרויות תשובה');
  else if (opts.length !== 4) warnings.push(`מספר אפשרויות חריג: ${opts.length}`);

  const ids = opts.map(o => String(o.id));
  if (new Set(ids).size !== ids.length) errors.push('מזהי אפשרויות כפולים');

  opts.forEach((o, i) => {
    if (!String(o.text ?? '').trim() && !o.imageUrl) errors.push(`אפשרות ${i + 1} ריקה`);
  });

  const flagged = opts.filter(o => o.isCorrect === true);
  if (flagged.length !== 1) errors.push(`צריכה להיות בדיוק תשובה נכונה אחת (נמצאו ${flagged.length})`);
  if (!ids.includes(q.correctAnswer)) errors.push(`correct_answer="${q.correctAnswer}" לא קיים באפשרויות`);
  else if (flagged.length === 1 && String(flagged[0].id) !== q.correctAnswer) errors.push('correct_answer לא תואם לאפשרות המסומנת isCorrect');

  const texts = opts.map(o => String(o.text ?? '').trim()).filter(Boolean);
  const normTexts = texts.map(normalizeText);
  if (new Set(normTexts).size !== normTexts.length) errors.push('יש אפשרויות תשובה זהות');

  texts.forEach(text => {
    if (PLACEHOLDER_OPTION_PATTERNS.some(re => re.test(text))) errors.push(`אפשרות placeholder: "${text}"`);
  });
  for (const set of GENERIC_DISTRACTOR_SETS) {
    const hits = set.filter(s => texts.includes(s)).length;
    if (hits >= 2) errors.push(`מסיחים גנריים (${set.join('/')})`);
  }

  // Numeric self-check for templated questions.
  const expected = expectedNumericAnswer(q.questionText);
  const correctOpt = opts.find(o => String(o.id) === q.correctAnswer);
  if (expected !== null && Number.isFinite(expected) && correctOpt) {
    const marked = parseNumber(correctOpt.text);
    if (Number.isFinite(marked) && Math.abs(marked - expected) > 0.01) {
      errors.push(`התשובה המסומנת (${correctOpt.text}) לא תואמת לחישוב (${Math.round(expected * 100) / 100})`);
    }
    const equalToExpected = opts.filter(o => {
      const v = parseNumber(o.text);
      return Number.isFinite(v) && Math.abs(v - expected) <= 0.01;
    });
    if (equalToExpected.length > 1) errors.push('יותר מאפשרות אחת שווה לתוצאה הנכונה');
  }

  // --- images ---------------------------------------------------------------
  const title = svgTitle(q.mediaUrl);
  if (title) {
    const t = normalizeText(title);
    const qt = normalizeText(q.questionText);
    if (t && !qt.startsWith(t.slice(0, Math.min(t.length, 16)))) {
      errors.push(`התמונה מציגה שאלה אחרת ("${title}") מזו שבטקסט`);
    }
  }
  const optionImages = opts.map(o => o.imageUrl).filter(Boolean);
  if (optionImages.length) {
    if (new Set(optionImages.map(hash)).size !== optionImages.length) errors.push('יש תמונות תשובה זהות');
    const contentTexts = texts.filter(t => !VISUAL_LABEL_RE.test(t));
    if (optionImages.length === opts.length && contentTexts.length === opts.length) {
      warnings.push('לכל תשובה יש גם טקסט וגם תמונה — יש לוודא שהתמונות מציגות את אותה תשובה');
    }
  }
  if (q.mediaUrl && !String(q.mediaUrl).startsWith('data:image/svg')) {
    warnings.push('תמונה חיצונית — יש לבדוק ידנית שהיא מתאימה לשאלה');
  }

  return { errors, warnings };
}

/**
 * Validates a set of questions, including cross-question checks
 * (duplicate texts, the same image reused for different questions).
 * @param {object[]} rows rows to validate
 * @param {{existing?: object[]}} [opts] rows already in the bank, for duplicate checks
 */
function validateBank(rows, opts = {}) {
  const existing = opts.existing ?? [];
  const results = new Map();
  const add = (id, kind, msg) => {
    if (!results.has(id)) results.set(id, { errors: [], warnings: [] });
    results.get(id)[kind].push(msg);
  };

  for (const row of rows) {
    const { errors, warnings } = validateQuestion(row);
    const id = String(row.id);
    errors.forEach(e => add(id, 'errors', e));
    warnings.forEach(w => add(id, 'warnings', w));
  }

  const incomingIds = new Set(rows.map(r => String(r.id)));
  const pool = [...rows, ...existing.filter(r => !incomingIds.has(String(r.id)))].map(normalizeRow);

  const byText = new Map();
  const byImage = new Map();
  for (const q of pool) {
    // Visual questions legitimately share a generic prompt ("which shape is the mirror image?"),
    // so for them a duplicate means the same text AND the same image.
    const textKey = normalizeText(q.questionText);
    const key = textKey && (q.mediaUrl ? `${textKey}|${hash(q.mediaUrl)}` : textKey);
    if (key) byText.set(key, [...(byText.get(key) ?? []), q.id]);
    if (q.mediaUrl) {
      const h = hash(q.mediaUrl);
      byImage.set(h, [...(byImage.get(h) ?? []), q]);
    }
  }
  for (const ids of byText.values()) {
    if (ids.length < 2) continue;
    ids.filter(id => incomingIds.has(id)).forEach(id => add(id, 'errors', `שאלה כפולה (${ids.filter(x => x !== id).join(', ')})`));
  }
  for (const group of byImage.values()) {
    const distinctTexts = new Set(group.map(q => normalizeText(q.questionText)));
    if (group.length < 2 || distinctTexts.size < 2) continue;
    group.filter(q => incomingIds.has(q.id)).forEach(q => add(q.id, 'errors', `אותה תמונה משמשת ${group.length} שאלות שונות`));
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const r of results.values()) {
    errorCount += r.errors.length;
    warningCount += r.warnings.length;
  }
  return { results, errorCount, warningCount, ok: errorCount === 0 };
}

function formatReport(report, { showWarnings = true } = {}) {
  const lines = [];
  for (const [id, r] of report.results) {
    if (!r.errors.length && !(showWarnings && r.warnings.length)) continue;
    lines.push(`• ${id}`);
    r.errors.forEach(e => lines.push(`    ✗ ${e}`));
    if (showWarnings) r.warnings.forEach(w => lines.push(`    ! ${w}`));
  }
  lines.push(`\nסה"כ: ${report.errorCount} שגיאות, ${report.warningCount} אזהרות`);
  return lines.join('\n');
}

module.exports = { validateQuestion, validateBank, formatReport, expectedNumericAnswer, svgTitle };
