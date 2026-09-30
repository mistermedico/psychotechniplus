'use strict';

/**
 * Deterministic generator of spatial ("shapes") questions.
 *
 * Every question is built from an exact geometric model (polyomino cells on a
 * grid, a cube net, a folded sheet of paper). The correct option and every
 * distractor are computed from that model, so the answer is right by
 * construction; `scripts/verify-spatial-questions.cjs` then re-derives each
 * answer independently from the rendered SVGs.
 *
 * Images contain no text except "?" and step numbers, so the validator's
 * "image title must match the question" rule can never be violated.
 *
 * Runs unchanged in Node (require) and in a browser (window.SpatialQuestionGenerator).
 */
(function (root) {
  const TARGETS = ['target_psychometric', 'target_tayyas', 'target_ktzina'];
  const LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳'];
  const OPTION_IDS = ['a', 'b', 'c', 'd'];
  const C = {
    bg: '#0F172A', panel: '#0B1220', border: '#334155', cell: '#60A5FA', stroke: '#E5E7EB',
    marker: '#F87171', line: '#22D3EE', muted: '#94A3B8', accent: '#F59E0B', paper: '#E2E8F0',
    paperFold: '#94A3B8', face: '#1E293B', faceStroke: '#64748B', symbol: '#E2E8F0', hole: '#0B1220',
  };

  // ---------------------------------------------------------------- random
  function makeRng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = n => Math.floor(next() * n);
    return {
      next,
      int,
      pick: arr => arr[int(arr.length)],
      shuffle: arr => {
        const b = arr.slice();
        for (let i = b.length - 1; i > 0; i--) {
          const j = int(i + 1);
          [b[i], b[j]] = [b[j], b[i]];
        }
        return b;
      },
    };
  }

  // -------------------------------------------------------------- geometry
  // Screen coordinates: x to the right, y DOWN. R90 is clockwise on screen.
  const T = {
    I: p => [p[0], p[1]],
    R90: p => [-p[1], p[0]],
    R180: p => [-p[0], -p[1]],
    R270: p => [p[1], -p[0]],
    MV: p => [-p[0], p[1]], // mirror in a vertical line (left <-> right)
    MH: p => [p[0], -p[1]], // mirror in a horizontal line (up <-> down)
  };
  const ALL8 = {
    I: T.I, R90: T.R90, R180: T.R180, R270: T.R270, MV: T.MV, MH: T.MH,
    D1: p => [p[1], p[0]], D2: p => [-p[1], -p[0]],
  };
  const seq = (...names) => p => names.reduce((q, n) => T[n](q), p);

  const TR_HE = {
    I: 'ללא שינוי',
    R90: 'סיבוב של 90° עם כיוון השעון',
    R270: 'סיבוב של 90° נגד כיוון השעון',
    R180: 'סיבוב של 180°',
    MV: 'שיקוף ימין-שמאל (בקו אנכי)',
    MH: 'שיקוף למעלה-למטה (בקו אופקי)',
  };

  function normalizeFig(fig) {
    const xs = fig.cells.map(c => c[0]);
    const ys = fig.cells.map(c => c[1]);
    const mx = Math.min(...xs);
    const my = Math.min(...ys);
    const cells = fig.cells.map(([x, y]) => [x - mx + 0, y - my + 0]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return { cells, marker: fig.marker ? [fig.marker[0] - mx + 0, fig.marker[1] - my + 0] : null };
  }
  const applyFig = (fig, fn) => normalizeFig({ cells: fig.cells.map(fn), marker: fig.marker && fn(fig.marker) });
  const figKey = fig => {
    const n = normalizeFig(fig);
    return n.cells.map(c => c.join(',')).join(';') + '|' + (n.marker ? n.marker.join(',') : '');
  };
  const dims = fig => {
    const n = normalizeFig(fig);
    return [Math.max(...n.cells.map(c => c[0])) + 1, Math.max(...n.cells.map(c => c[1])) + 1];
  };
  /** Key that is the same for all rotations/reflections of a shape (ignores the marker). */
  const freeKey = cells => Object.values(ALL8).map(fn => figKey(applyFig({ cells }, fn))).sort()[0];

  function enumerateFixedPolyominoes(n) {
    let cur = new Map([['0,0|', [[0, 0]]]]);
    for (let k = 1; k < n; k++) {
      const next = new Map();
      for (const cells of cur.values()) {
        const set = new Set(cells.map(c => c.join(',')));
        for (const [x, y] of cells) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (set.has(`${x + dx},${y + dy}`)) continue;
            const nf = normalizeFig({ cells: [...cells, [x + dx, y + dy]] });
            const key = figKey(nf);
            if (!next.has(key)) next.set(key, nf.cells);
          }
        }
      }
      cur = next;
    }
    return [...cur.values()];
  }

  function hasHole(cells) {
    const [w, h] = dims({ cells });
    const filled = new Set(cells.map(c => c.join(',')));
    const seen = new Set();
    const stack = [];
    for (let x = -1; x <= w; x++) stack.push([x, -1], [x, h]);
    for (let y = -1; y <= h; y++) stack.push([-1, y], [w, y]);
    while (stack.length) {
      const [x, y] = stack.pop();
      const k = `${x},${y}`;
      if (x < -1 || y < -1 || x > w || y > h || seen.has(k) || filled.has(k)) continue;
      seen.add(k);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return (w + 2) * (h + 2) - seen.size - filled.size > 0;
  }

  /** Chiral free polyominoes (all 8 orientations distinct), max 4x4 box, no holes. */
  function chiralShapes(n) {
    const byFree = new Map();
    for (const cells of enumerateFixedPolyominoes(n)) {
      const orients = new Set(Object.values(ALL8).map(fn => figKey(applyFig({ cells }, fn))));
      const [w, h] = dims({ cells });
      if (orients.size !== 8 || Math.max(w, h) > 4 || hasHole(cells)) continue;
      const fk = freeKey(cells);
      if (!byFree.has(fk)) byFree.set(fk, normalizeFig({ cells }).cells);
    }
    return [...byFree.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(e => e[1]);
  }

  function describeMarker(fig) {
    const n = normalizeFig(fig);
    const [w, h] = dims(n);
    const fx = w === 1 ? 0.5 : n.marker[0] / (w - 1);
    const fy = h === 1 ? 0.5 : n.marker[1] / (h - 1);
    const hz = fx < 0.34 ? 'השמאלי' : fx > 0.66 ? 'הימני' : null;
    const vt = fy < 0.34 ? 'העליון' : fy > 0.66 ? 'התחתון' : null;
    // .at = "in the …" (ב), .to = "to the …" (ל)
    if (hz && vt) return { at: `בחלק ${vt}-${hz}`, to: `לחלק ${vt}-${hz}` };
    if (vt) return { at: `בחלק ${vt}`, to: `לחלק ${vt}` };
    if (hz) return { at: `בצד ${hz}`, to: `לצד ${hz}` };
    return { at: 'במרכז', to: 'למרכז' };
  }

  // ------------------------------------------------------------------- svg
  const r1 = v => Math.round(v * 10) / 10;
  const enc = svg => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  function frame(w, h, inner) {
    const big = w > 500;
    const m = big ? 24 : 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="${w}" height="${h}" rx="${big ? 28 : 24}" fill="${C.bg}"/>` +
      `<rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="${big ? 22 : 18}" fill="${C.panel}" stroke="${C.border}" stroke-width="2"/>` +
      inner + '</svg>';
  }

  function drawFig(fig, cx, cy, s, tag) {
    const n = normalizeFig(fig);
    const [w, h] = dims(n);
    const x0 = r1(cx - (w * s) / 2);
    const y0 = r1(cy - (h * s) / 2);
    const rects = n.cells.map(([x, y]) => {
      const isMarker = n.marker && x === n.marker[0] && y === n.marker[1];
      return `<rect x="${r1(x0 + x * s)}" y="${r1(y0 + y * s)}" width="${s}" height="${s}" rx="${r1(s * 0.12)}" fill="${isMarker ? C.marker : C.cell}" stroke="${C.stroke}" stroke-width="${r1(Math.max(2, s * 0.08))}"/>`;
    }).join('');
    void tag;
    return `<g>${rects}</g>`;
  }

  function questionBox(cx, cy, w, h, fontSize = 72) {
    return `<rect x="${r1(cx - w / 2)}" y="${r1(cy - h / 2)}" width="${w}" height="${h}" rx="18" fill="none" stroke="${C.muted}" stroke-width="3" stroke-dasharray="10 8"/>` +
      `<text x="${cx}" y="${r1(cy + fontSize * 0.35)}" text-anchor="middle" font-size="${fontSize}" font-family="Arial" font-weight="700" fill="${C.muted}">?</text>`;
  }

  function arrowHead(x, y, angleDeg, size, color) {
    const a = (angleDeg * Math.PI) / 180;
    const bx = x - Math.cos(a) * size;
    const by = y - Math.sin(a) * size;
    const px = -Math.sin(a) * size * 0.6;
    const py = Math.cos(a) * size * 0.6;
    return `<path d="M ${r1(x)} ${r1(y)} L ${r1(bx + px)} ${r1(by + py)} L ${r1(bx - px)} ${r1(by - py)} Z" fill="${color}"/>`;
  }

  /** Straight arrow pointing left (RTL flow: original on the right, result on the left). */
  function flowArrow(x1, x2, y) {
    return `<path d="M ${x1} ${y} L ${x2 + 14} ${y}" stroke="${C.muted}" stroke-width="5" stroke-linecap="round"/>` + arrowHead(x2, y, 180, 18, C.muted);
  }

  /** Circular arrow showing the rotation sense. deg: 90 / -90 (counter-clockwise) / 180. */
  function rotationIcon(cx, cy, rad, deg) {
    const pt = th => [cx + rad * Math.cos((th * Math.PI) / 180), cy + rad * Math.sin((th * Math.PI) / 180)];
    // Arc over the top; clockwise = increasing screen angle (y points down).
    const clockwise = deg !== -90;
    const from = deg === 180 ? 180 : clockwise ? -160 : -20;
    const to = deg === 180 ? -10 : clockwise ? -40 : -140;
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    const tangent = clockwise ? to + 90 : to - 90;
    const size = 18;
    const a = (tangent * Math.PI) / 180;
    const tipX = x2 + Math.cos(a) * size;
    const tipY = y2 + Math.sin(a) * size;
    const path = deg === 180
      ? `M ${r1(x1)} ${r1(y1)} A ${rad} ${rad} 0 0 1 ${r1(cx)} ${r1(cy - rad)} A ${rad} ${rad} 0 0 1 ${r1(x2)} ${r1(y2)}`
      : `M ${r1(x1)} ${r1(y1)} A ${rad} ${rad} 0 0 ${clockwise ? 1 : 0} ${r1(x2)} ${r1(y2)}`;
    return `<path d="${path}" fill="none" stroke="${C.accent}" stroke-width="6" stroke-linecap="round"/>` + arrowHead(tipX, tipY, tangent, size, C.accent);
  }

  function optionFigSvg(fig, maxDim) {
    const s = Math.min(44, Math.floor(190 / maxDim));
    return enc(frame(420, 300, drawFig(fig, 210, 150, s, 'option')));
  }

  // ------------------------------------------------------ question assembly
  function assemble(rng, spec, correct, distractors) {
    // correct / distractors: { image, tag, note }
    const order = rng.shuffle([0, 1, 2, 3]);
    const all = [correct, ...distractors];
    const options = order.map((src, i) => ({
      id: OPTION_IDS[i],
      text: `צורה ${LETTERS[i]}`,
      isCorrect: src === 0,
      imageUrl: all[src].image,
      analysisTag: src === 0 ? null : all[src].tag,
    }));
    const correctIndex = order.indexOf(0);
    const letterOf = src => LETTERS[order.indexOf(src)];
    return { options, correctIndex, correctLetter: LETTERS[correctIndex], letterOf, notes: all.map(a => a.note) };
  }

  function distractorSentence(asm, count = 3) {
    const parts = [];
    for (let src = 1; src <= count; src++) parts.push(`צורה ${asm.letterOf(src)} — ${asm.notes[src]}`);
    return `המסיחים: ${parts.join('; ')}.`;
  }

  // ------------------------------------------------ transform questions
  const TRANSFORM_KINDS = {
    mirrorV: {
      text: 'לפניך צורה וקו מראה אנכי מקווקו. איזו מהצורות היא תמונת הראי של הצורה ביחס לקו?',
      fn: T.MV, pool: ['MH', 'R180', 'R90', 'R270'],
      rule: 'קו מראה אנכי מחליף בין ימין לשמאל ומשאיר את למעלה ולמטה במקומם.',
    },
    mirrorH: {
      text: 'לפניך צורה וקו מראה אופקי מקווקו. איזו מהצורות היא תמונת הראי של הצורה ביחס לקו?',
      fn: T.MH, pool: ['MV', 'R180', 'R90', 'R270'],
      rule: 'קו מראה אופקי מחליף בין למעלה ללמטה ומשאיר את ימין ושמאל במקומם.',
    },
    rot90: {
      text: 'איזו צורה תתקבל אם נסובב את הצורה ב-90° עם כיוון השעון?',
      fn: T.R90, pool: ['R270', 'R180', 'MV', 'MH', 'R90+MV'], deg: 90,
      rule: 'בסיבוב של 90° עם כיוון השעון החלק העליון של הצורה עובר לימין, והחלק הימני עובר למטה.',
    },
    rot270: {
      text: 'איזו צורה תתקבל אם נסובב את הצורה ב-90° נגד כיוון השעון?',
      fn: T.R270, pool: ['R90', 'R180', 'MV', 'MH', 'R270+MV'], deg: -90,
      rule: 'בסיבוב של 90° נגד כיוון השעון החלק העליון של הצורה עובר לשמאל, והחלק השמאלי עובר למטה.',
    },
    rot180: {
      text: 'איזו צורה תתקבל אם נסובב את הצורה ב-180°?',
      fn: T.R180, pool: ['MV', 'MH', 'R90', 'R270'], deg: 180,
      rule: 'בסיבוב של 180° כל חלק עובר לצד הנגדי גם אופקית וגם אנכית: למעלה-ימין הופך ללמטה-שמאל.',
    },
  };

  const DISTRACTOR_NOTES = {
    I: 'הצורה המקורית ללא שינוי',
    MV: 'שיקוף ימין-שמאל',
    MH: 'שיקוף למעלה-למטה',
    R90: 'סיבוב של 90° עם כיוון השעון',
    R270: 'סיבוב של 90° נגד כיוון השעון',
    R180: 'סיבוב של 180°',
    'R90+MV': 'תמונת ראי של התשובה הנכונה (סיבוב ואחריו היפוך מיותר)',
    'R270+MV': 'תמונת ראי של התשובה הנכונה (סיבוב ואחריו היפוך מיותר)',
    marker: 'המבנה נכון אבל הריבוע האדום לא במקום הנכון',
  };
  const DISTRACTOR_TAGS = {
    I: 'ללא שינוי', MV: 'שיקוף ימין-שמאל', MH: 'שיקוף למעלה-למטה', R90: 'סיבוב 90° עם השעון',
    R270: 'סיבוב 90° נגד השעון', R180: 'סיבוב 180°', 'R90+MV': 'היפוך מיותר', 'R270+MV': 'היפוך מיותר',
    marker: 'סימון במקום שגוי',
  };
  const fnOf = name => (name.includes('+') ? seq(...name.split('+')) : T[name]);

  /** A figure whose cells equal `fig` but whose marker sits on a different cell (near-miss distractor). */
  function markerMoved(rng, fig) {
    const n = normalizeFig(fig);
    const others = n.cells.filter(c => !(c[0] === n.marker[0] && c[1] === n.marker[1]));
    const near = others.filter(c => Math.abs(c[0] - n.marker[0]) + Math.abs(c[1] - n.marker[1]) === 1);
    const cell = rng.pick(near.length ? near : others);
    return { cells: n.cells, marker: cell };
  }

  function pickFigure(rng, shapesBySize, size, used, maxBox = 4) {
    const pool = shapesBySize[size].filter(cells => Math.max(...dims({ cells })) <= maxBox);
    for (let attempt = 0; attempt < 500; attempt++) {
      const cells = rng.pick(pool);
      const orient = rng.pick(Object.keys(ALL8));
      const base = applyFig({ cells }, ALL8[orient]);
      const marker = rng.pick(base.cells);
      const fig = normalizeFig({ cells: base.cells, marker });
      if (describeMarker(fig).at === 'במרכז') continue;
      const key = figKey(fig);
      if (used.has(key)) continue;
      used.add(key);
      return fig;
    }
    throw new Error('no figure available');
  }

  function transformQuestion(rng, ctx, kindName, difficulty) {
    const kind = TRANSFORM_KINDS[kindName];
    const size = difficulty <= 3 ? 5 : difficulty <= 5 ? rng.pick([5, 6]) : 6 + (difficulty >= 7 ? rng.int(2) : 0);
    const fig = pickFigure(rng, ctx.shapesBySize, size, ctx.usedFigs);
    const [w, h] = dims(fig);
    const maxDim = Math.max(w, h);
    const answer = applyFig(fig, kind.fn);

    // media
    let inner;
    if (kindName === 'mirrorH') {
      const s = Math.min(30, Math.floor(118 / maxDim));
      inner = drawFig(fig, 320, 100, s, 'orig') +
        `<path d="M 110 186 H 530" stroke="${C.line}" stroke-width="4" stroke-dasharray="14 10"/>` +
        questionBox(320, 266, 150, 124, 64);
    } else {
      const s = Math.min(40, Math.floor(190 / maxDim));
      inner = drawFig(fig, 470, 180, s, 'orig');
      if (kindName === 'mirrorV') {
        inner += `<path d="M 320 48 V 312" stroke="${C.line}" stroke-width="4" stroke-dasharray="14 10"/>` + questionBox(170, 180, 190, 200);
      } else {
        inner += rotationIcon(320, 140, 40, kind.deg) + flowArrow(350, 290, 222) + questionBox(170, 180, 190, 200);
      }
    }
    const media = enc(frame(640, 360, inner));

    // distractors
    const keys = new Set([figKey(answer)]);
    const pool = rng.shuffle(kind.pool);
    const chosen = [];
    if (difficulty >= 6) {
      const near = markerMoved(rng, answer);
      if (!keys.has(figKey(near))) { keys.add(figKey(near)); chosen.push({ fig: near, name: 'marker' }); }
    }
    for (const name of pool) {
      if (chosen.length === 3) break;
      const f = applyFig(fig, fnOf(name));
      if (keys.has(figKey(f))) continue;
      keys.add(figKey(f));
      chosen.push({ fig: f, name });
    }
    if (chosen.length !== 3) throw new Error('not enough distractors');
    const orderedChosen = rng.shuffle(chosen);
    const asm = assemble(rng, null,
      { image: optionFigSvg(answer, maxDim), note: null },
      orderedChosen.map(c => ({ image: optionFigSvg(c.fig, maxDim), tag: DISTRACTOR_TAGS[c.name], note: DISTRACTOR_NOTES[c.name] })));

    const from = describeMarker(fig);
    const to = describeMarker(answer);
    const markerSentence = from.at === to.at
      ? `הריבוע האדום נמצא ${from.at} של הצורה ונשאר ${to.at} גם אחרי הפעולה, אך כיוון הזרועות של הצורה משתנה.`
      : `הריבוע האדום, שנמצא ${from.at} של הצורה, עובר ${to.to} שלה.`;
    const explanation = `${kind.rule} ${markerSentence} רק צורה ${asm.correctLetter} מתאימה לכך. ${distractorSentence(asm)}`;
    return { kind: kindName, text: kind.text, media, asm, explanation };
  }

  // ------------------------------------------------ rotation recognition
  function recognitionQuestion(rng, ctx, difficulty) {
    const size = difficulty <= 6 ? 6 : 7;
    const fig = pickFigure(rng, ctx.shapesBySize, size, ctx.usedFigs);
    const [w, h] = dims(fig);
    const maxDim = Math.max(w, h);
    const rot = rng.pick(['R90', 'R180', 'R270']);
    const answer = applyFig(fig, T[rot]);
    const mirrors = rng.shuffle(['MV', 'MV+R90', 'MV+R180', 'MV+R270']).slice(0, 3);
    const distractors = mirrors.map(name => ({
      image: optionFigSvg(applyFig(fig, fnOf(name)), maxDim),
      tag: 'תמונת ראי',
      note: 'תמונת ראי של הצורה (מסובבת), שאי אפשר לקבל בסיבוב בלבד',
    }));
    const s = Math.min(44, Math.floor(220 / maxDim));
    const media = enc(frame(640, 360, drawFig(fig, 320, 180, s, 'orig')));
    const asm = assemble(rng, null, { image: optionFigSvg(answer, maxDim), note: null }, distractors);
    const explanation = `צורה ${asm.correctLetter} היא הצורה המקורית לאחר ${TR_HE[rot]}: הריבוע האדום, שנמצא ${describeMarker(fig).at} של הצורה, עובר ${describeMarker(answer).to} שלה, והזרועות שומרות על אותו סדר סביבו. ` +
      `שלוש הצורות האחרות הן תמונות ראי של הצורה — בהן הזרועות מופיעות בסדר הפוך סביב הריבוע האדום, ולכן אין סיבוב שיביא את הצורה המקורית אליהן. טיפ: סובבו בדמיון את התשובה חזרה לכיוון המקורי ובדקו אם הזרוע הבולטת נמצאת באותו צד.`;
    return { kind: 'recognition', text: 'איזו מהצורות היא הצורה שלפניך לאחר סיבוב בלבד, ללא היפוך (שיקוף)?', media, asm, explanation };
  }

  // ------------------------------------------------ composite transforms
  const COMPOSITES = [
    { steps: ['R90', 'MV'], text: 'מסובבים את הצורה ב-90° עם כיוון השעון, ולאחר מכן משקפים אותה ביחס לקו אנכי (ימין↔שמאל). איזו צורה מתקבלת?' },
    { steps: ['R270', 'MH'], text: 'מסובבים את הצורה ב-90° נגד כיוון השעון, ולאחר מכן משקפים אותה ביחס לקו אופקי (למעלה↔למטה). איזו צורה מתקבלת?' },
    { steps: ['MV', 'R90'], text: 'משקפים את הצורה ביחס לקו אנכי (ימין↔שמאל), ולאחר מכן מסובבים אותה ב-90° עם כיוון השעון. איזו צורה מתקבלת?' },
    { steps: ['MH', 'R270'], text: 'משקפים את הצורה ביחס לקו אופקי (למעלה↔למטה), ולאחר מכן מסובבים אותה ב-90° נגד כיוון השעון. איזו צורה מתקבלת?' },
    { steps: ['R180', 'MV', 'R90'], text: 'מסובבים את הצורה ב-180°, לאחר מכן משקפים אותה ביחס לקו אנכי (ימין↔שמאל), ולאחר מכן מסובבים אותה ב-90° עם כיוון השעון. איזו צורה מתקבלת?' },
  ];

  function compositeQuestion(rng, ctx, difficulty, variant) {
    const comp = COMPOSITES[variant % COMPOSITES.length];
    const size = difficulty >= 9 ? 7 : 6;
    const fig = pickFigure(rng, ctx.shapesBySize, size, ctx.usedFigs);
    const [w, h] = dims(fig);
    const maxDim = Math.max(w, h);
    const answer = applyFig(fig, seq(...comp.steps));
    const rotStep = comp.steps.find(s => s.startsWith('R') && s !== 'R180') || 'R90';
    const mirStep = comp.steps.find(s => s.startsWith('M'));
    const other = { R90: 'R270', R270: 'R90' }[rotStep];
    const candidates = [
      { name: 'noMirror', f: seq(...comp.steps.filter(s => !s.startsWith('M'))), note: comp.steps.length > 2 ? 'ביצוע הסיבובים בלבד, בלי השיקוף' : 'ביצוע הסיבוב בלבד, בלי השיקוף', tag: 'חסר שיקוף' },
      { name: 'noRotation', f: seq(mirStep), note: comp.steps.length > 2 ? 'ביצוע השיקוף בלבד, בלי הסיבובים' : 'ביצוע השיקוף בלבד, בלי הסיבוב', tag: 'חסר סיבוב' },
      { name: 'reverseOrder', f: seq(...comp.steps.slice().reverse()), note: 'ביצוע הפעולות בסדר הפוך', tag: 'סדר פעולות הפוך' },
      { name: 'wrongDirection', f: seq(...comp.steps.map(s => (s === rotStep ? other : s))), note: 'סיבוב בכיוון ההפוך', tag: 'כיוון סיבוב שגוי' },
      { name: 'wrongAxis', f: seq(...comp.steps.map(s => (s === mirStep ? (mirStep === 'MV' ? 'MH' : 'MV') : s))), note: 'שיקוף בציר הלא נכון', tag: 'ציר שיקוף שגוי' },
    ];
    const keys = new Set([figKey(answer)]);
    const chosen = [];
    for (const c of rng.shuffle(candidates)) {
      if (chosen.length === 3) break;
      const f = applyFig(fig, c.f);
      if (keys.has(figKey(f))) continue;
      keys.add(figKey(f));
      chosen.push({ image: optionFigSvg(f, maxDim), note: c.note, tag: c.tag });
    }
    if (chosen.length !== 3) throw new Error('composite: not enough distractors');
    const s = Math.min(40, Math.floor(190 / maxDim));
    const media = enc(frame(640, 360, drawFig(fig, 470, 180, s, 'orig') + flowArrow(350, 290, 180) + questionBox(170, 180, 190, 200)));
    const asm = assemble(rng, null, { image: optionFigSvg(answer, maxDim), note: null }, chosen);
    // Describe the marker after each step.
    let cur = fig;
    const trail = [`בהתחלה הריבוע האדום נמצא ${describeMarker(fig).at} של הצורה`];
    comp.steps.forEach(step => {
      cur = applyFig(cur, T[step]);
      trail.push(`אחרי ${TR_HE[step]} הוא ${describeMarker(cur).at}`);
    });
    const explanation = `מבצעים את הפעולות בדיוק לפי הסדר. ${trail.join('; ')}. הצורה שמתקבלת בסוף היא צורה ${asm.correctLetter}. ${distractorSentence(asm)}`;
    return { kind: 'composite', text: comp.text, media, asm, explanation };
  }

  // ------------------------------------------------------------- matrices
  const MATRIX_RULES = [
    { cols: ['I', 'R90', 'R180'] },
    { cols: ['I', 'R270', 'R180'] },
    { cols: ['I', 'MV', 'MH'] },
    { cols: ['I', 'R90', 'MV'] },
  ];
  const COL_HE = ['הימנית', 'האמצעית', 'השמאלית'];
  const ROW_HE = ['העליונה', 'האמצעית', 'התחתונה'];

  function matrixQuestion(rng, ctx, difficulty, variant) {
    const rule = MATRIX_RULES[variant % MATRIX_RULES.length];
    const transposed = variant % 2 === 1 && difficulty >= 7;
    const size = difficulty >= 7 ? 6 : 5;
    const shapes = [];
    const free = new Set();
    while (shapes.length < 3) {
      const f = pickFigure(rng, ctx.shapesBySize, rng.pick([size - 1, size]), ctx.usedFigs, 3);
      const fk = freeKey(f.cells);
      if (free.has(fk)) continue;
      free.add(fk);
      shapes.push(f);
    }
    // grid[r][c]: c = 0 is the RIGHTMOST column (Hebrew reading order).
    const grid = [0, 1, 2].map(i => [0, 1, 2].map(j => {
      const shapeIdx = transposed ? j : i;
      const trIdx = transposed ? i : j;
      return applyFig(shapes[shapeIdx], T[rule.cols[trIdx]]);
    }));
    const missing = difficulty >= 8 ? rng.pick([[2, 2], [1, 2], [2, 1]]) : [2, 2];
    const [mr, mc] = missing;
    const shapeIdx = transposed ? mc : mr;
    const trIdx = transposed ? mr : mc;
    const answer = grid[mr][mc];
    const maxDim = Math.max(...shapes.map(f => Math.max(...dims(f))));
    const s = Math.min(26, Math.floor(80 / maxDim));
    const cxOf = c => 430 - c * 110;
    const cyOf = r => 76 + r * 104;
    let inner = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        inner += `<rect x="${cxOf(c) - 50}" y="${cyOf(r) - 49}" width="100" height="98" rx="12" fill="#111827" stroke="${C.border}" stroke-width="2"/>`;
        if (r === mr && c === mc) {
          inner += `<text x="${cxOf(c)}" y="${cyOf(r) + 20}" text-anchor="middle" font-size="56" font-family="Arial" font-weight="700" fill="${C.muted}">?</text>`;
        } else {
          inner += drawFig(grid[r][c], cxOf(c), cyOf(r), s, `m${r}${c}`);
        }
      }
    }
    const media = enc(frame(640, 360, inner));

    const keys = new Set([figKey(answer)]);
    const cand = [];
    rule.cols.forEach((tr, idx) => {
      if (idx !== trIdx) cand.push({ f: applyFig(shapes[shapeIdx], T[tr]), note: `הצורה הנכונה אבל עם הפעולה של ${transposed ? 'שורה' : 'עמודה'} אחרת (${TR_HE[tr]})`, tag: 'פעולה של תא אחר' });
    });
    const extra = { I: 'R180', R90: 'R270', R270: 'R90', R180: 'MV', MV: 'MH', MH: 'MV' }[rule.cols[trIdx]];
    cand.push({ f: applyFig(shapes[shapeIdx], T[extra]), note: `הצורה הנכונה אבל עם ${TR_HE[extra]} במקום ${TR_HE[rule.cols[trIdx]]}`, tag: 'פעולה שגויה' });
    const otherShape = shapes[(shapeIdx + 1 + rng.int(2)) % 3];
    cand.push({ f: applyFig(otherShape, T[rule.cols[trIdx]]), note: `הפעולה נכונה אבל הצורה שייכת ל${transposed ? 'עמודה' : 'שורה'} אחרת`, tag: 'צורה של שורה אחרת' });
    const chosen = [];
    const shuffled = rng.shuffle(cand);
    // Always keep the "other shape" distractor so the row/column logic is tested.
    shuffled.sort((a, b) => (a.tag === 'צורה של שורה אחרת' ? -1 : 0) - (b.tag === 'צורה של שורה אחרת' ? -1 : 0));
    for (const c of shuffled) {
      if (chosen.length === 3) break;
      if (keys.has(figKey(c.f))) continue;
      keys.add(figKey(c.f));
      chosen.push({ image: optionFigSvg(c.f, maxDim), note: c.note, tag: c.tag });
    }
    if (chosen.length !== 3) throw new Error('matrix: not enough distractors');
    const asm = assemble(rng, null, { image: optionFigSvg(answer, maxDim), note: null }, chosen);
    const ruleText = transposed
      ? `בכל עמודה מופיעה אותה צורה, ובכל שורה מופעלת עליה אותה פעולה: בשורה העליונה — ${TR_HE[rule.cols[0]]}, באמצעית — ${TR_HE[rule.cols[1]]}, ובתחתונה — ${TR_HE[rule.cols[2]]} (ביחס לצורה שבשורה העליונה).`
      : `בכל שורה מופיעה אותה צורה, ובכל עמודה מופעלת עליה אותה פעולה: בעמודה הימנית — ${TR_HE[rule.cols[0]]}, באמצעית — ${TR_HE[rule.cols[1]]}, ובשמאלית — ${TR_HE[rule.cols[2]]} (ביחס לצורה שבעמודה הימנית).`;
    const where = `סימן השאלה נמצא בשורה ${ROW_HE[mr]} ובעמודה ${COL_HE[mc]}`;
    const need = transposed
      ? `ולכן חסרה הצורה של העמודה ${COL_HE[mc]} לאחר הפעולה של השורה ${ROW_HE[mr]} (${TR_HE[rule.cols[trIdx]]})`
      : `ולכן חסרה הצורה של השורה ${ROW_HE[mr]} לאחר הפעולה של העמודה ${COL_HE[mc]} (${TR_HE[rule.cols[trIdx]]})`;
    const explanation = `${ruleText} ${where}, ${need} — צורה ${asm.correctLetter}. ${distractorSentence(asm)}`;
    return { kind: 'matrix', text: 'איזו צורה משלימה את המטריצה במקום סימן השאלה?', media, asm, explanation };
  }

  // ------------------------------------------------------------ cube nets
  function rollFaces(cells) {
    // Rolls a cube over the net; returns cube-face label (0..5) per cell, or null if the net does not fold.
    const key = c => c.join(',');
    const set = new Map(cells.map(c => [key(c), c]));
    const faces = new Map();
    const start = cells[0];
    const queue = [[start, { B: 0, T: 1, N: 2, S: 3, E: 4, W: 5 }]];
    faces.set(key(start), 0);
    const rolls = {
      E: s => ({ B: s.E, E: s.T, T: s.W, W: s.B, N: s.N, S: s.S }),
      W: s => ({ B: s.W, W: s.T, T: s.E, E: s.B, N: s.N, S: s.S }),
      S: s => ({ B: s.S, S: s.T, T: s.N, N: s.B, E: s.E, W: s.W }),
      N: s => ({ B: s.N, N: s.T, T: s.S, S: s.B, E: s.E, W: s.W }),
    };
    const dirs = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
    while (queue.length) {
      const [cell, st] = queue.shift();
      for (const [d, [dx, dy]] of Object.entries(dirs)) {
        const nk = `${cell[0] + dx},${cell[1] + dy}`;
        if (!set.has(nk) || faces.has(nk)) continue;
        const ns = rolls[d](st);
        faces.set(nk, ns.B);
        queue.push([set.get(nk), ns]);
      }
    }
    return new Set(faces.values()).size === 6 ? faces : null;
  }

  function cubeNets() {
    return enumerateFixedPolyominoes(6).filter(cells => {
      const [w, h] = dims({ cells });
      return w <= 5 && h <= 4 && w >= h && rollFaces(cells);
    });
  }

  const SYMBOLS = ['עיגול', 'משולש', 'כוכב', 'פלוס', 'משושה', 'מעוין'];
  function symbolSvg(i, cx, cy, r, color) {
    const pts = arr => arr.map(p => `${r1(cx + p[0])},${r1(cy + p[1])}`).join(' ');
    switch (i) {
      case 0: return `<circle cx="${cx}" cy="${cy}" r="${r1(r * 0.8)}" fill="${color}"/>`;
      case 1: return `<polygon points="${pts([[0, -r], [r * 0.92, r * 0.72], [-r * 0.92, r * 0.72]])}" fill="${color}"/>`;
      case 2: {
        const p = [];
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const rr = k % 2 ? r * 0.42 : r;
          p.push([rr * Math.cos(a), rr * Math.sin(a)]);
        }
        return `<polygon points="${pts(p)}" fill="${color}"/>`;
      }
      case 3: {
        const a = r * 0.3;
        return `<polygon points="${pts([[-a, -r], [a, -r], [a, -a], [r, -a], [r, a], [a, a], [a, r], [-a, r], [-a, a], [-r, a], [-r, -a], [-a, -a]])}" fill="${color}"/>`;
      }
      case 4: {
        const p = [];
        for (let k = 0; k < 6; k++) p.push([r * 0.9 * Math.cos((k * Math.PI) / 3), r * 0.9 * Math.sin((k * Math.PI) / 3)]);
        return `<polygon points="${pts(p)}" fill="${color}"/>`;
      }
      default:
        return `<polygon points="${pts([[0, -r], [r * 0.68, 0], [0, r], [-r * 0.68, 0]])}" fill="${color}"/>`;
    }
  }

  function cubeQuestion(rng, ctx, difficulty) {
    const wantDist = difficulty <= 4 ? [2] : difficulty <= 6 ? [3] : [4, 5];
    for (let attempt = 0; attempt < 2000; attempt++) {
      const cells = rng.pick(ctx.nets);
      const faces = rollFaces(cells);
      const keyOf = c => c.join(',');
      const symbolOf = new Map();
      const perm = rng.shuffle([0, 1, 2, 3, 4, 5]);
      cells.forEach((c, i) => symbolOf.set(keyOf(c), perm[i]));
      const target = rng.pick(cells);
      const tFace = faces.get(keyOf(target));
      const opp = cells.find(c => faces.get(keyOf(c)) === (tFace ^ 1));
      // net distance (BFS)
      const dist = new Map([[keyOf(target), 0]]);
      const q = [target];
      const cellSet = new Set(cells.map(keyOf));
      while (q.length) {
        const c = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${c[0] + dx},${c[1] + dy}`;
          if (cellSet.has(nk) && !dist.has(nk)) { dist.set(nk, dist.get(keyOf(c)) + 1); q.push([c[0] + dx, c[1] + dy]); }
        }
      }
      const d = dist.get(keyOf(opp));
      if (!wantDist.includes(d)) continue;
      const signature = cells.map(keyOf).join(';') + '|' + keyOf(target);
      if (ctx.usedNets.has(signature)) continue;
      ctx.usedNets.add(signature);

      const [w, h] = dims({ cells });
      const u = 62;
      const x0 = 320 - (w * u) / 2;
      const y0 = 180 - (h * u) / 2;
      let inner = '';
      for (const c of cells) {
        const isT = keyOf(c) === keyOf(target);
        const cx = x0 + c[0] * u + u / 2;
        const cy = y0 + c[1] * u + u / 2;
        inner += `<rect x="${r1(x0 + c[0] * u)}" y="${r1(y0 + c[1] * u)}" width="${u}" height="${u}" fill="${isT ? C.accent : C.face}" stroke="${C.faceStroke}" stroke-width="3"/>`;
        inner += symbolSvg(symbolOf.get(keyOf(c)), cx, cy, 19, isT ? C.panel : C.symbol);
      }
      const media = enc(frame(640, 360, inner));
      const tile = sym => enc(frame(420, 300, `<rect x="140" y="75" width="140" height="140" rx="10" fill="${C.face}" stroke="${C.faceStroke}" stroke-width="4"/>` + symbolSvg(sym, 210, 145, 46, C.symbol)));
      const answerSym = symbolOf.get(keyOf(opp));
      const adjacent = cells.filter(c => keyOf(c) !== keyOf(target) && keyOf(c) !== keyOf(opp));
      const chosen = rng.shuffle(adjacent).slice(0, 3).map(c => ({
        image: tile(symbolOf.get(keyOf(c))),
        note: `ה${SYMBOLS[symbolOf.get(keyOf(c))]} — פאה שנוגעת בפאה הכתומה`,
        tag: 'פאה סמוכה',
      }));
      const asm = assemble(rng, null, { image: tile(answerSym), note: null }, chosen);
      const adjNames = adjacent.map(c => SYMBOLS[symbolOf.get(keyOf(c))]);
      const straight = d === 2 && (opp[0] === target[0] || opp[1] === target[1]);
      const lead = straight
        ? `הפאה הכתומה והפאה עם ה${SYMBOLS[answerSym]} נמצאות באותה ${opp[1] === target[1] ? 'שורה' : 'עמודה'} בפריסה, עם פאה אחת ביניהן — פאות כאלה תמיד נגדיות בקובייה.`
        : `בקיפול, ארבע הפאות — ${adjNames.slice(0, 3).map(n => `ה${n}`).join(', ')} וה${adjNames[3]} — מתקפלות סביב הפאה הכתומה ונוגעות בה (חלקן צמודות אליה כבר בפריסה וחלקן מגיעות אליה בקיפול).`;
      const explanation = `${lead} לכן הפאה היחידה שלא נוגעת בפאה הכתומה — ה${SYMBOLS[answerSym]} — היא זו שמולה: צורה ${asm.correctLetter}. שאר האפשרויות הן פאות סמוכות לפאה הכתומה.`;
      return { kind: 'cube', text: 'לפניך פריסה של קובייה. לאחר קיפולה, איזה סמל יופיע על הפאה שמול הפאה הכתומה?', media, asm, explanation, netDistance: d };
    }
    throw new Error('cube: no net found');
  }

  // ---------------------------------------------------------- paper fold
  // Paper = 4x4 cells. Folds halve the current region: L2R (left half onto right), R2L, T2B, B2T.
  const FOLD_HE = {
    L2R: 'החצי השמאלי מקופל אל הימני',
    R2L: 'החצי הימני מקופל אל השמאלי',
    T2B: 'החצי העליון מקופל אל התחתון',
    B2T: 'החצי התחתון מקופל אל העליון',
  };

  function applyFoldRegion(reg, f) {
    const mx = (reg.x0 + reg.x1) / 2;
    const my = (reg.y0 + reg.y1) / 2;
    if (f === 'L2R') return { ...reg, x0: mx, line: { v: true, at: mx } };
    if (f === 'R2L') return { ...reg, x1: mx, line: { v: true, at: mx } };
    if (f === 'T2B') return { ...reg, y0: my, line: { v: false, at: my } };
    return { ...reg, y1: my, line: { v: false, at: my } };
  }

  function unfoldHoles(folds, punch, { skipFirst = false, swapAxes = false } = {}) {
    let reg = { x0: 0, x1: 4, y0: 0, y1: 4 };
    const lines = [];
    for (const f of folds) {
      reg = applyFoldRegion(reg, f);
      lines.push(reg.line);
    }
    let holes = [punch];
    const start = skipFirst ? 1 : 0;
    for (let i = lines.length - 1; i >= start; i--) {
      const ln = lines[i];
      const vertical = swapAxes ? !ln.v : ln.v;
      holes = holes.concat(holes.map(([x, y]) => (vertical ? [2 * ln.at - x - 1, y] : [x, 2 * ln.at - y - 1])));
    }
    const valid = holes.every(([x, y]) => x >= 0 && x < 4 && y >= 0 && y < 4);
    const uniq = [...new Set(holes.map(h => h.join(',')))].sort();
    return valid ? uniq : null;
  }

  function foldQuestion(rng, ctx, difficulty) {
    const plans = difficulty <= 5 ? [['L2R'], ['T2B'], ['R2L'], ['B2T']]
      : difficulty <= 7 ? [['L2R', 'T2B'], ['T2B', 'R2L'], ['B2T', 'L2R'], ['R2L', 'B2T']]
        : difficulty <= 9 ? [['L2R', 'L2R'], ['T2B', 'T2B'], ['R2L', 'T2B'], ['L2R', 'B2T']]
          : [['L2R', 'T2B', 'L2R'], ['T2B', 'R2L', 'T2B']];
    for (let attempt = 0; attempt < 200; attempt++) {
      const folds = rng.pick(plans);
      const sig = folds.join('>');
      let reg = { x0: 0, x1: 4, y0: 0, y1: 4 };
      const regions = [reg];
      for (const f of folds) { reg = applyFoldRegion(reg, f); regions.push(reg); }
      const final = regions[regions.length - 1];
      const punchCells = [];
      for (let x = final.x0; x < final.x1; x++) for (let y = final.y0; y < final.y1; y++) punchCells.push([x, y]);
      const punch = rng.pick(punchCells);
      if (ctx.usedFolds.has(sig + '|' + punch.join(','))) continue;
      const correct = unfoldHoles(folds, punch);
      const cands = [];
      for (const p of punchCells) if (p.join(',') !== punch.join(',')) cands.push({ holes: unfoldHoles(folds, p), note: 'החור נוקב במקום אחר על הדף המקופל', tag: 'מיקום חור שגוי' });
      if (folds.length > 1) cands.push({ holes: unfoldHoles(folds, punch, { skipFirst: true }), note: 'נפתח רק הקיפול האחרון', tag: 'פתיחה חלקית' });
      cands.push({ holes: unfoldHoles(folds, punch, { swapAxes: true }), note: 'השיקוף נעשה סביב הקו הלא נכון', tag: 'קו קיפול שגוי' });
      const keys = new Set([correct.join(';')]);
      const chosen = [];
      // Mix: up to two "punched elsewhere" sheets plus one conceptual error (partial unfold / wrong line).
      const positional = rng.shuffle(cands.filter(c => c.tag === 'מיקום חור שגוי'));
      const conceptual = rng.shuffle(cands.filter(c => c.tag !== 'מיקום חור שגוי'));
      const ordered = [...positional.slice(0, 2), ...conceptual, ...positional.slice(2)];
      for (const c of ordered) {
        if (chosen.length === 3) break;
        if (!c.holes) continue;
        const k = c.holes.join(';');
        if (keys.has(k)) continue;
        keys.add(k);
        chosen.push(c);
      }
      if (chosen.length !== 3) continue;
      ctx.usedFolds.add(sig + '|' + punch.join(','));

      // media: panels right-to-left
      const n = regions.length;
      const u = n === 4 ? 26 : 30;
      const gap = 600 / n;
      const panelX = i => 620 - gap * (i + 0.5);
      let inner = '';
      regions.forEach((rg, i) => {
        const cx = panelX(i);
        const ox = cx - 2 * u;
        const oy = 190 - 2 * u;
        inner += `<circle cx="${r1(cx)}" cy="58" r="15" fill="${C.border}"/><text x="${r1(cx)}" y="64" text-anchor="middle" font-size="18" font-family="Arial" font-weight="700" fill="${C.paper}">${i + 1}</text>`;
        inner += `<rect x="${r1(ox)}" y="${r1(oy)}" width="${4 * u}" height="${4 * u}" fill="none" stroke="${C.border}" stroke-width="2" stroke-dasharray="6 6"/>`;
        inner += `<rect x="${r1(ox + rg.x0 * u)}" y="${r1(oy + rg.y0 * u)}" width="${r1((rg.x1 - rg.x0) * u)}" height="${r1((rg.y1 - rg.y0) * u)}" fill="${C.paper}" stroke="${C.paperFold}" stroke-width="2"/>`;
        if (i < folds.length) {
          const f = folds[i];
          const mx = (rg.x0 + rg.x1) / 2;
          const my = (rg.y0 + rg.y1) / 2;
          if (f === 'L2R' || f === 'R2L') {
            inner += `<path d="M ${r1(ox + mx * u)} ${r1(oy + rg.y0 * u - 8)} V ${r1(oy + rg.y1 * u + 8)}" stroke="${C.line}" stroke-width="3" stroke-dasharray="8 6"/>`;
            const from = f === 'L2R' ? (rg.x0 + mx) / 2 : (mx + rg.x1) / 2;
            const to = f === 'L2R' ? (mx + rg.x1) / 2 : (rg.x0 + mx) / 2;
            const y = oy + rg.y0 * u - 12;
            inner += `<path d="M ${r1(ox + from * u)} ${r1(y + 4)} Q ${r1(ox + mx * u)} ${r1(y - 30)} ${r1(ox + to * u)} ${r1(y + 2)}" fill="none" stroke="${C.accent}" stroke-width="4"/>` + arrowHead(ox + to * u, y + 6, f === 'L2R' ? 60 : 120, 12, C.accent);
          } else {
            inner += `<path d="M ${r1(ox + rg.x0 * u - 8)} ${r1(oy + my * u)} H ${r1(ox + rg.x1 * u + 8)}" stroke="${C.line}" stroke-width="3" stroke-dasharray="8 6"/>`;
            const from = f === 'T2B' ? (rg.y0 + my) / 2 : (my + rg.y1) / 2;
            const to = f === 'T2B' ? (my + rg.y1) / 2 : (rg.y0 + my) / 2;
            const x = ox + rg.x1 * u + 12;
            inner += `<path d="M ${r1(x - 4)} ${r1(oy + from * u)} Q ${r1(x + 30)} ${r1(oy + my * u)} ${r1(x - 2)} ${r1(oy + to * u)}" fill="none" stroke="${C.accent}" stroke-width="4"/>` + arrowHead(x - 6, oy + to * u, f === 'T2B' ? 150 : 210, 12, C.accent);
          }
        } else {
          inner += `<circle cx="${r1(ox + (punch[0] + 0.5) * u)}" cy="${r1(oy + (punch[1] + 0.5) * u)}" r="${r1(u * 0.3)}" fill="${C.hole}"/>`;
        }
        if (i < n - 1) inner += flowArrow(r1(cx - 24), r1(panelX(i + 1) + 24), 58);
      });
      const media = enc(frame(640, 360, inner));
      const sheet = holes => {
        const uu = 38;
        const ox = 210 - 2 * uu;
        const oy = 150 - 2 * uu;
        let g = `<rect x="${ox}" y="${oy}" width="${4 * uu}" height="${4 * uu}" fill="${C.paper}" stroke="${C.paperFold}" stroke-width="2"/>`;
        for (let k = 1; k < 4; k++) {
          g += `<path d="M ${ox + k * uu} ${oy} V ${oy + 4 * uu} M ${ox} ${oy + k * uu} H ${ox + 4 * uu}" stroke="#CBD5E1" stroke-width="1"/>`;
        }
        holes.forEach(h => {
          const [x, y] = h.split(',').map(Number);
          g += `<circle cx="${r1(ox + (x + 0.5) * uu)}" cy="${r1(oy + (y + 0.5) * uu)}" r="11" fill="${C.hole}"/>`;
        });
        return enc(frame(420, 300, g));
      };
      const asm = assemble(rng, null, { image: sheet(correct), note: null }, chosen.map(c => ({ image: sheet(c.holes), note: c.note, tag: c.tag })));
      const steps = folds.map((f, i) => `${i + 1}. ${FOLD_HE[f]}`).join(' ');
      const explanation = `שלבי הקיפול: ${steps}. פותחים את הדף בסדר הפוך: כל פתיחה משקפת את החורים שכבר קיימים לצידו השני של קו הקיפול, ולכן מספר החורים מוכפל בכל פתיחה — ${folds.length === 1 ? 'חור אחד הופך לשניים' : `1→${folds.map((_, i) => 2 ** (i + 1)).join('→')}`}. ` +
        `בסוף מתקבלים ${correct.length} חורים הממוקמים סימטרית משני צידי ${folds.length === 1 ? 'קו הקיפול' : 'קווי הקיפול'} — צורה ${asm.correctLetter}. ${distractorSentence(asm)}`;
      return { kind: 'fold', text: 'דף מרובע מקופל לפי השלבים שבאיור (לפי המספרים), ובסוף מנקבים בו חור אחד. איך ייראה הדף לאחר פתיחתו המלאה?', media, asm, explanation };
    }
    throw new Error('fold: no plan found');
  }

  // ------------------------------------------------------------- the bank
  // [kind, difficulties...]
  const PLAN = [
    ['mirrorV', 2, 2, 3, 3, 3, 4, 4],
    ['mirrorH', 3, 3, 4, 4, 5, 5],
    ['rot90', 4, 4, 5, 5, 6, 6],
    ['rot270', 5, 5, 6, 6, 6],
    ['rot180', 3, 3, 4, 4, 5],
    ['recognition', 6, 6, 7, 7, 8],
    ['composite', 8, 8, 9, 9, 10],
    ['matrix', 5, 5, 6, 6, 7, 7, 8, 8],
    ['cube', 4, 4, 5, 6, 6, 7, 8],
    ['fold', 5, 6, 7, 8, 9, 10],
  ];

  function generateSpatialQuestions({ seed = 20260930, idPrefix = 'q_gen_spatial_2026_' } = {}) {
    const rng = makeRng(seed);
    const shapesBySize = { 4: chiralShapes(4), 5: chiralShapes(5), 6: chiralShapes(6), 7: chiralShapes(7) };
    const ctx = { shapesBySize, usedFigs: new Set(), nets: cubeNets(), usedNets: new Set(), usedFolds: new Set() };
    const rows = [];
    let n = 0;
    for (const [kind, ...diffs] of PLAN) {
      diffs.forEach((difficulty, i) => {
        let q;
        if (TRANSFORM_KINDS[kind]) q = transformQuestion(rng, ctx, kind, difficulty);
        else if (kind === 'recognition') q = recognitionQuestion(rng, ctx, difficulty);
        else if (kind === 'composite') q = compositeQuestion(rng, ctx, difficulty, i);
        else if (kind === 'matrix') q = matrixQuestion(rng, ctx, difficulty, i);
        else if (kind === 'cube') q = cubeQuestion(rng, ctx, difficulty);
        else q = foldQuestion(rng, ctx, difficulty);
        n += 1;
        rows.push({
          id: `${idPrefix}${String(n).padStart(3, '0')}`,
          target_ids: TARGETS,
          topic_id: 'topic_spatial',
          subtopic_id: null,
          question_type: 'shapes',
          question_text: q.text,
          reading_passage: null,
          media_url: q.media,
          media_type: 'image',
          options: q.asm.options,
          correct_answer: OPTION_IDS[q.asm.correctIndex],
          explanation: q.explanation,
          difficulty,
          psychometric_stats: {
            elo: 900 + 85 * difficulty,
            discrimination: 1,
            guessProbability: 0.25,
            source: 'spatial-generator-2026-09',
            generatorKind: q.kind,
            generatorSeed: seed,
          },
          // Every third question of each kind is premium; the rest are free.
          access_level: i % 3 === 2 ? 'premium' : 'free',
          validation_status: 'validated',
          smart_practice_eligible: true,
          general_practice_eligible: true,
          explanation_image_url: null,
        });
      });
    }
    return rows;
  }

  const api = { generateSpatialQuestions, _internal: { T, ALL8, normalizeFig, applyFig, figKey, rollFaces, unfoldHoles, chiralShapes, cubeNets, SYMBOLS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SpatialQuestionGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
