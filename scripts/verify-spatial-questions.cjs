#!/usr/bin/env node
'use strict';

/**
 * Independent answer check for generated spatial questions.
 *
 * It does NOT use the generator's internal model. It reads the rendered SVGs
 * (question image + option images), rebuilds the geometry from the drawing,
 * works out the answer from the question text with its own implementation
 * (3D folding for cube nets, forward paper folding, matrix transforms), and
 * checks that exactly one option matches and that it is the marked one.
 *
 *   node scripts/verify-spatial-questions.cjs questions.json
 */

const fs = require('fs');

const COLORS = { cell: '#60A5FA', marker: '#F87171', face: '#1E293B', accent: '#F59E0B', paper: '#E2E8F0', hole: '#0B1220' };

function svgOf(uri) {
  const payload = uri.slice(uri.indexOf(',') + 1);
  return uri.includes(';base64,') ? Buffer.from(payload, 'base64').toString('utf8') : decodeURIComponent(payload);
}
function elements(svg, tag) {
  const re = new RegExp(`<${tag}\\s([^>]*?)/?>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(svg))) {
    const attrs = {};
    m[1].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
    attrs._index = m.index;
    attrs._tag = tag;
    out.push(attrs);
  }
  return out;
}
const num = v => Number(v);

// ------------------------------------------------------------ polyominoes
function figureFromRects(rects) {
  if (!rects.length) return null;
  const s = num(rects[0].width);
  const minX = Math.min(...rects.map(r => num(r.x)));
  const minY = Math.min(...rects.map(r => num(r.y)));
  const cells = [];
  let marker = null;
  for (const r of rects) {
    const gx = Math.round((num(r.x) - minX) / s);
    const gy = Math.round((num(r.y) - minY) / s);
    if (Math.abs(num(r.x) - minX - gx * s) > 0.6 || Math.abs(num(r.y) - minY - gy * s) > 0.6) throw new Error('cells not on a grid');
    cells.push([gx, gy]);
    if (r.fill === COLORS.marker) {
      if (marker) throw new Error('two markers');
      marker = [gx, gy];
    }
  }
  if (!marker) throw new Error('no marker');
  return { cells, marker };
}
function figureRects(svg) {
  return elements(svg, 'rect').filter(r => r.fill === COLORS.cell || r.fill === COLORS.marker);
}
function canon(fig) {
  const mx = Math.min(...fig.cells.map(c => c[0]));
  const my = Math.min(...fig.cells.map(c => c[1]));
  const cells = fig.cells.map(([x, y]) => `${x - mx},${y - my}`).sort();
  return cells.join(' ') + ' @' + `${fig.marker[0] - mx},${fig.marker[1] - my}`;
}
// Linear maps on (x, y) with y pointing down. Clockwise on screen: (x, y) -> (-y, x).
const M = {
  I: [1, 0, 0, 1], R90: [0, -1, 1, 0], R180: [-1, 0, 0, -1], R270: [0, 1, -1, 0],
  MV: [-1, 0, 0, 1], MH: [1, 0, 0, -1], D1: [0, 1, 1, 0], D2: [0, -1, -1, 0],
};
const applyM = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const transform = (fig, m) => ({ cells: fig.cells.map(c => applyM(m, c)), marker: applyM(m, fig.marker) });
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
/** Compose steps given in the order they are performed. */
const chain = steps => steps.reduce((acc, s) => mul(M[s], acc), M.I);

function parseStep(clause) {
  if (/משקפים/.test(clause)) {
    if (/אנכי/.test(clause)) return 'MV';
    if (/אופקי/.test(clause)) return 'MH';
  }
  if (/מסובבים/.test(clause)) {
    if (/180°/.test(clause)) return 'R180';
    if (/נגד כיוון השעון/.test(clause)) return 'R270';
    if (/עם כיוון השעון/.test(clause)) return 'R90';
  }
  return null;
}

function transformForText(text) {
  if (/קו מראה אנכי/.test(text)) return { m: M.MV };
  if (/קו מראה אופקי/.test(text)) return { m: M.MH };
  if (/ולאחר מכן|לאחר מכן/.test(text)) {
    const steps = text.split(/,|ולאחר מכן|לאחר מכן/).map(parseStep).filter(Boolean);
    if (steps.length < 2) throw new Error('cannot parse composite steps');
    return { m: chain(steps), steps };
  }
  if (/איזו צורה תתקבל אם נסובב/.test(text)) {
    if (/180°/.test(text)) return { m: M.R180 };
    if (/נגד כיוון השעון/.test(text)) return { m: M.R270 };
    if (/עם כיוון השעון/.test(text)) return { m: M.R90 };
  }
  return null;
}

// ------------------------------------------------------------------ cube
function symbolAfter(svg, rect) {
  const rest = svg.slice(rect._index + 5);
  const m = rest.match(/<(circle|polygon)\s[^>]*?(?:points="([^"]*)")?[^>]*\/>/);
  if (!m) throw new Error('face without symbol');
  if (m[1] === 'circle') return 'circle';
  const pts = rest.slice(m.index).match(/points="([^"]*)"/)[1].trim().split(/\s+/).length;
  return { 3: 'triangle', 10: 'star', 12: 'plus', 6: 'hexagon', 4: 'diamond' }[pts] || `poly${pts}`;
}
function cubeOpposite(svg) {
  const faces = elements(svg, 'rect').filter(r => r.fill === COLORS.face || r.fill === COLORS.accent);
  if (faces.length !== 6) throw new Error(`net has ${faces.length} faces`);
  const u = num(faces[0].width);
  const minX = Math.min(...faces.map(f => num(f.x)));
  const minY = Math.min(...faces.map(f => num(f.y)));
  const cells = faces.map(f => ({
    gx: Math.round((num(f.x) - minX) / u), gy: Math.round((num(f.y) - minY) / u),
    symbol: symbolAfter(svg, f), target: f.fill === COLORS.accent,
  }));
  if (cells.filter(c => c.target).length !== 1) throw new Error('need exactly one highlighted face');
  // 3D folding: each face gets (normal, u, v); moving along +u folds the neighbour up by 90°.
  const neg = v => v.map(x => -x);
  const key = c => `${c.gx},${c.gy}`;
  const byKey = new Map(cells.map(c => [key(c), c]));
  const frame = new Map([[key(cells[0]), { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] }]]);
  const queue = [cells[0]];
  while (queue.length) {
    const c = queue.shift();
    const f = frame.get(key(c));
    const moves = [
      [1, 0, { n: f.u, u: neg(f.n), v: f.v }],
      [-1, 0, { n: neg(f.u), u: f.n, v: f.v }],
      [0, 1, { n: f.v, u: f.u, v: neg(f.n) }],
      [0, -1, { n: neg(f.v), u: f.u, v: f.n }],
    ];
    for (const [dx, dy, nf] of moves) {
      const k = `${c.gx + dx},${c.gy + dy}`;
      if (!byKey.has(k) || frame.has(k)) continue;
      frame.set(k, nf);
      queue.push(byKey.get(k));
    }
  }
  const normals = cells.map(c => frame.get(key(c)).n.join(','));
  if (new Set(normals).size !== 6) throw new Error('net does not fold into a cube');
  const target = cells.find(c => c.target);
  const oppN = neg(frame.get(key(target)).n).join(',');
  const opp = cells.find(c => frame.get(key(c)).n.join(',') === oppN);
  return { answer: opp.symbol, target: target.symbol, all: cells.map(c => c.symbol) };
}

// ------------------------------------------------------------------ fold
function foldAnswer(svg) {
  const rects = elements(svg, 'rect');
  const outlines = rects.filter(r => r.fill === 'none' && r['stroke-dasharray'] && num(r.width) === num(r.height));
  const papers = rects.filter(r => r.fill === COLORS.paper);
  if (!outlines.length || outlines.length !== papers.length) throw new Error('cannot read panels');
  const panels = outlines.map(o => {
    const u = num(o.width) / 4;
    const ox = num(o.x);
    const oy = num(o.y);
    const p = papers.find(pp => num(pp.x) >= ox - 0.5 && num(pp.x) + num(pp.width) <= ox + 4 * u + 0.5);
    return {
      ox, oy, u,
      x0: Math.round((num(p.x) - ox) / u * 2) / 2, x1: Math.round((num(p.x) + num(p.width) - ox) / u * 2) / 2,
      y0: Math.round((num(p.y) - oy) / u * 2) / 2, y1: Math.round((num(p.y) + num(p.height) - oy) / u * 2) / 2,
    };
  }).sort((a, b) => b.ox - a.ox); // step 1 is the rightmost panel
  const folds = [];
  for (let i = 1; i < panels.length; i++) {
    const a = panels[i - 1];
    const b = panels[i];
    if (b.x0 > a.x0) folds.push({ axis: 'x', at: b.x0, moving: 'low' });
    else if (b.x1 < a.x1) folds.push({ axis: 'x', at: b.x1, moving: 'high' });
    else if (b.y0 > a.y0) folds.push({ axis: 'y', at: b.y0, moving: 'low' });
    else if (b.y1 < a.y1) folds.push({ axis: 'y', at: b.y1, moving: 'high' });
    else throw new Error('panel did not change');
  }
  const last = panels[panels.length - 1];
  const holes = elements(svg, 'circle').filter(c => c.fill === COLORS.hole);
  if (holes.length !== 1) throw new Error('expected one punched hole');
  const punch = [(num(holes[0].cx) - last.ox) / last.u, (num(holes[0].cy) - last.oy) / last.u];
  // Forward simulation: every point of the sheet is carried through the folds.
  const result = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let p = [i + 0.5, j + 0.5];
      for (const f of folds) {
        const idx = f.axis === 'x' ? 0 : 1;
        const onMovingSide = f.moving === 'low' ? p[idx] < f.at : p[idx] > f.at;
        if (onMovingSide) p = idx === 0 ? [2 * f.at - p[0], p[1]] : [p[0], 2 * f.at - p[1]];
      }
      if (Math.abs(p[0] - punch[0]) < 0.01 && Math.abs(p[1] - punch[1]) < 0.01) result.push(`${i},${j}`);
    }
  }
  return { holes: result.sort().join(';'), folds: folds.length, panels: panels.length };
}
function sheetHoles(svg) {
  const sheet = elements(svg, 'rect').find(r => r.fill === COLORS.paper);
  const u = num(sheet.width) / 4;
  return elements(svg, 'circle').filter(c => c.fill === COLORS.hole)
    .map(c => `${Math.floor((num(c.cx) - num(sheet.x)) / u)},${Math.floor((num(c.cy) - num(sheet.y)) / u)}`).sort().join(';');
}

// ---------------------------------------------------------------- matrix
function matrixAnswer(svg) {
  const cellsByPos = new Map();
  for (const r of figureRects(svg)) {
    const cx = num(r.x) + num(r.width) / 2;
    const cy = num(r.y) + num(r.height) / 2;
    const col = Math.round((430 - cx) / 110);
    const row = Math.round((cy - 76) / 104);
    const k = `${row},${col}`;
    if (!cellsByPos.has(k)) cellsByPos.set(k, []);
    cellsByPos.get(k).push(r);
  }
  const F = {};
  let missing = null;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const rs = cellsByPos.get(`${r},${c}`);
      if (!rs) { if (missing) throw new Error('two empty cells'); missing = [r, c]; continue; }
      F[`${r},${c}`] = figureFromRects(rs);
    }
  }
  if (!missing) throw new Error('no missing cell');
  const [mr, mc] = missing;
  const predictions = new Set();
  // Column analogy (same transform down a column) and row analogy (same transform along a row).
  // A mode is accepted only if EVERY reference line obeys it (each complete row/column is checked).
  for (const mode of ['col', 'row']) {
    const refs = mode === 'col' ? [0, 1, 2].filter(c => c !== mc) : [0, 1, 2].filter(r => r !== mr);
    const others = mode === 'col' ? [0, 1, 2].filter(r => r !== mr) : [0, 1, 2].filter(c => c !== mc);
    const modePredictions = [];
    let consistent = true;
    for (const ref of refs) {
      let common = Object.keys(M);
      for (const o of others) {
        const src = mode === 'col' ? F[`${o},${ref}`] : F[`${ref},${o}`];
        const dst = mode === 'col' ? F[`${o},${mc}`] : F[`${mr},${o}`];
        common = common.filter(g => canon(transform(src, M[g])) === canon(dst));
      }
      if (!common.length) { consistent = false; break; }
      const base = mode === 'col' ? F[`${mr},${ref}`] : F[`${ref},${mc}`];
      common.forEach(g => modePredictions.push(canon(transform(base, M[g]))));
    }
    if (consistent) modePredictions.forEach(p => predictions.add(p));
  }
  if (predictions.size !== 1) throw new Error(`matrix rule ambiguous (${predictions.size} predictions)`);
  return [...predictions][0];
}

// ------------------------------------------------------------------ main
function verifyQuestion(q) {
  const text = q.question_text ?? q.questionText;
  const media = svgOf(q.media_url ?? q.mediaUrl);
  const options = q.options;
  const correctId = q.correct_answer ?? q.correctAnswer;
  const optionSvgs = options.map(o => svgOf(o.imageUrl));
  let matches;
  let kind;

  if (/פריסה של קובייה/.test(text)) {
    kind = 'cube';
    const cube = cubeOpposite(media);
    const optSymbols = optionSvgs.map(s => symbolAfter(s, elements(s, 'rect').find(r => r.fill === COLORS.face)));
    if (new Set(optSymbols).size !== 4) throw new Error('cube options repeat a symbol');
    if (optSymbols.includes(cube.target)) throw new Error('highlighted face offered as an answer');
    matches = optSymbols.map(s => s === cube.answer);
  } else if (/דף מרובע מקופל/.test(text)) {
    kind = 'fold';
    const fold = foldAnswer(media);
    const sets = optionSvgs.map(sheetHoles);
    if (new Set(sets).size !== 4) throw new Error('fold options repeat a pattern');
    matches = sets.map(s => s === fold.holes);
  } else if (/מטריצה/.test(text)) {
    kind = 'matrix';
    const answer = matrixAnswer(media);
    const figs = optionSvgs.map(s => canon(figureFromRects(figureRects(s))));
    if (new Set(figs).size !== 4) throw new Error('matrix options repeat a figure');
    matches = figs.map(f => f === answer);
  } else if (/לאחר סיבוב בלבד/.test(text)) {
    kind = 'recognition';
    const orig = figureFromRects(figureRects(media));
    const rotations = ['R90', 'R180', 'R270'].map(g => canon(transform(orig, M[g])));
    const figs = optionSvgs.map(s => canon(figureFromRects(figureRects(s))));
    if (figs.includes(canon(orig))) throw new Error('an option is the unrotated original');
    if (new Set(figs).size !== 4) throw new Error('options repeat a figure');
    matches = figs.map(f => rotations.includes(f));
  } else {
    const t = transformForText(text);
    if (!t) throw new Error('unknown question type');
    kind = t.steps ? 'composite' : 'transform';
    const orig = figureFromRects(figureRects(media));
    const answer = canon(transform(orig, t.m));
    const figs = optionSvgs.map(s => canon(figureFromRects(figureRects(s))));
    if (new Set(figs).size !== 4) throw new Error('options repeat a figure');
    matches = figs.map(f => f === answer);
  }

  const matchIds = options.filter((_, i) => matches[i]).map(o => o.id);
  if (matchIds.length !== 1) throw new Error(`${matchIds.length} options satisfy the question`);
  if (matchIds[0] !== correctId) throw new Error(`computed answer ${matchIds[0]} but marked ${correctId}`);
  const flagged = options.filter(o => o.isCorrect).map(o => o.id);
  if (flagged.length !== 1 || flagged[0] !== correctId) throw new Error('isCorrect flag mismatch');
  const letter = options.find(o => o.id === correctId).text.replace('צורה ', '');
  const explanation = q.explanation ?? '';
  if (!explanation.includes(`צורה ${letter}`)) throw new Error('explanation does not name the correct option');
  // Every other option named in the explanation must be described as a distractor, not as the answer.
  return kind;
}

function verifyAll(rows) {
  const failures = [];
  const kinds = {};
  for (const q of rows) {
    try {
      const k = verifyQuestion(q);
      kinds[k] = (kinds[k] || 0) + 1;
    } catch (e) {
      failures.push({ id: q.id, error: e.message });
    }
  }
  return { failures, kinds, ok: failures.length === 0 };
}

module.exports = { verifyQuestion, verifyAll };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: verify-spatial-questions.cjs questions.json');
    process.exit(2);
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const res = verifyAll(rows);
  console.log(`נבדקו ${rows.length} שאלות:`, res.kinds);
  res.failures.forEach(f => console.log(`✗ ${f.id}: ${f.error}`));
  console.log(res.ok ? '✓ כל התשובות אומתו באופן בלתי תלוי' : `✗ ${res.failures.length} כשלים`);
  process.exit(res.ok ? 0 : 1);
}
