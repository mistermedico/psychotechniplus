import { Question, QuestionOption } from '../data/types';

type SpatialMode = 'series' | 'analogy' | 'rotation' | 'matrix' | 'mirror' | 'cube';

interface ShapeSignature {
  kind: number;
  rotation: number;
  scale: number;
  secondaryKind: number;
  secondaryDx: number;
  secondaryDy: number;
  flip: boolean;
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function palette(seed: number): [string, string, string] {
  const palettes: Array<[string, string, string]> = [
    ['#7C6FF7', '#22D3EE', '#0F172A'],
    ['#10B981', '#FBBF24', '#111827'],
    ['#F97316', '#38BDF8', '#1E293B'],
    ['#E879F9', '#34D399', '#111827'],
    ['#60A5FA', '#F87171', '#0B1120'],
  ];
  return palettes[seed % palettes.length];
}

function shapeMarkup(kind: number, x: number, y: number, size: number, fill: string, stroke = '#E5E7EB'): string {
  const half = size / 2;
  if (kind % 6 === 0) return `<circle cx="${x}" cy="${y}" r="${half}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  if (kind % 6 === 1) return `<rect x="${x - half}" y="${y - half}" width="${size}" height="${size}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  if (kind % 6 === 2) return `<polygon points="${x},${y - half} ${x + half},${y + half} ${x - half},${y + half}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  if (kind % 6 === 3) return `<path d="M ${x - half} ${y - half} L ${x + half} ${y - half} L ${x - half} ${y + half} Z" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  if (kind % 6 === 4) return `<path d="M ${x - half} ${y - half} H ${x + half} V ${y - 8} H ${x - 8} V ${y + half} H ${x - half} Z" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  return `<path d="M ${x - half} ${y} H ${x + half} M ${x} ${y - half} V ${y + half}" stroke="${fill}" stroke-width="16" stroke-linecap="round"/>`;
}

function visualMode(question: Question): SpatialMode {
  const text = `${question.id} ${question.questionText} ${question.subtopicId ?? ''}`.toLowerCase();
  if (text.includes('analog') || text.includes('אנלוג')) return 'analogy';
  if (text.includes('matrix') || text.includes('מטריצ')) return 'matrix';
  if (text.includes('mirror') || text.includes('reflection') || text.includes('שיקוף') || text.includes('מראה')) return 'mirror';
  if (text.includes('rotate') || text.includes('rotation') || text.includes('סיבוב')) return 'rotation';
  if (text.includes('cube') || text.includes('קוב') || text.includes('פריס')) return 'cube';

  const modes: SpatialMode[] = ['series', 'analogy', 'rotation', 'matrix', 'mirror', 'cube'];
  return modes[hashString(question.id) % modes.length];
}

function baseSignature(seed: number): ShapeSignature {
  return {
    kind: seed % 6,
    rotation: (seed % 4) * 90,
    scale: 0.88 + (seed % 3) * 0.08,
    secondaryKind: (seed + 2) % 6,
    secondaryDx: 24 + (seed % 3) * 8,
    secondaryDy: 20 + ((seed >> 2) % 3) * 8,
    flip: seed % 2 === 0,
  };
}

function transformSignature(base: ShapeSignature, step: number, mode: SpatialMode): ShapeSignature {
  if (mode === 'cube') {
    return {
      ...base,
      kind: (base.kind + (step % 2)) % 6,
      rotation: (base.rotation + step * 90) % 360,
      secondaryDx: base.secondaryDx + step * 4,
      secondaryDy: base.secondaryDy - step * 2,
      flip: step % 2 === 0 ? base.flip : !base.flip,
    };
  }

  if (mode === 'mirror') {
    return {
      ...base,
      secondaryDx: -base.secondaryDx,
      rotation: (360 - base.rotation) % 360,
      flip: !base.flip,
    };
  }

  if (mode === 'matrix') {
    const row = Math.floor(step / 3);
    const col = step % 3;
    return {
      ...base,
      kind: (base.kind + row) % 6,
      rotation: (base.rotation + col * 90) % 360,
      scale: 0.82 + row * 0.08,
      secondaryKind: (base.secondaryKind + col) % 6,
      secondaryDx: base.secondaryDx + col * 9,
      secondaryDy: base.secondaryDy + row * 8,
      flip: col % 2 === 1 ? !base.flip : base.flip,
    };
  }

  if (mode === 'analogy') {
    const pairStep = step % 2;
    const pairIndex = Math.floor(step / 2);
    return {
      ...base,
      kind: (base.kind + pairIndex) % 6,
      rotation: (base.rotation + pairStep * 90 + pairIndex * 45) % 360,
      scale: base.scale + pairStep * 0.1,
      secondaryKind: (base.secondaryKind + pairStep + pairIndex) % 6,
      secondaryDx: base.secondaryDx + pairStep * 18,
      secondaryDy: base.secondaryDy - pairStep * 12,
      flip: pairStep ? !base.flip : base.flip,
    };
  }

  return {
    ...base,
    kind: mode === 'rotation' ? base.kind : (base.kind + Math.floor(step / 2)) % 6,
    rotation: (base.rotation + step * 90) % 360,
    scale: 0.82 + ((step + base.kind) % 3) * 0.1,
    secondaryKind: (base.secondaryKind + step) % 6,
    secondaryDx: base.secondaryDx + step * 5,
    secondaryDy: base.secondaryDy + (step % 2 ? -10 : 8),
    flip: step % 2 ? !base.flip : base.flip,
  };
}

function targetStepForMode(mode: SpatialMode): number {
  if (mode === 'analogy') return 3;
  if (mode === 'mirror') return 1;
  if (mode === 'rotation') return 2;
  if (mode === 'matrix') return 8;
  return 4;
}

function targetSignature(question: Question): ShapeSignature {
  const seed = hashString(`${question.id}:spatial-rule`);
  return transformSignature(baseSignature(seed), targetStepForMode(visualMode(question)), visualMode(question));
}

function distractorSignature(target: ShapeSignature, index: number, mode: SpatialMode): ShapeSignature {
  if (mode === 'cube') {
    const variants: Array<Partial<ShapeSignature>> = [
      { rotation: (target.rotation + 90) % 360 },
      { secondaryKind: (target.secondaryKind + 1) % 6 },
      { rotation: (target.rotation + 180) % 360 },
      { secondaryKind: (target.secondaryKind + 2) % 6, rotation: (target.rotation + 270) % 360 },
    ];
    return { ...target, ...variants[index % variants.length] };
  }

  const variants: Array<Partial<ShapeSignature>> = [
    { rotation: (target.rotation + 90) % 360 },
    { secondaryDx: target.secondaryDx * -1 },
    { secondaryDy: target.secondaryDy * -1, flip: !target.flip },
    { rotation: (target.rotation + 180) % 360, scale: target.scale },
  ];
  return { ...target, ...variants[index % variants.length] };
}

function correctOptionId(question: Question): string {
  const byId = question.options.find(option => option.id === question.correctAnswer);
  const byText = question.options.find(option => option.text === question.correctAnswer);
  const byMarked = question.options.find(option => option.isCorrect);
  return (byId ?? byText ?? byMarked ?? question.options[0])?.id ?? question.correctAnswer;
}

function modePrompt(mode: SpatialMode): string {
  if (mode === 'analogy') return 'איזו צורה משלימה את האנלוגיה?';
  if (mode === 'rotation') return 'איזו צורה מתקבלת אחרי הסיבוב?';
  if (mode === 'matrix') return 'איזו צורה חסרה במטריצה?';
  if (mode === 'mirror') return 'איזו צורה היא השיקוף הנכון?';
  if (mode === 'cube') return 'איזו קובייה ממשיכה את החוק המרחבי?';
  return 'איזו צורה משלימה את הסדרה?';
}

function spatialExplanation(question: Question): string {
  const mode = visualMode(question);
  const correct = correctOptionId(question).toUpperCase();
  if (mode === 'analogy') {
    return `התשובה הנכונה היא ${correct}. בזוג הראשון מזהים שינוי קבוע: הצורה הראשית, הכיוון והסימן הפנימי משתנים יחד. מחילים את אותו שינוי בדיוק על הצורה השלישית, ורק אפשרות ${correct} שומרת על אותה התאמה. שאר האפשרויות משנות פרט אחד לפחות ולכן אינן משלימות את האנלוגיה.`;
  }
  if (mode === 'rotation') {
    return `התשובה הנכונה היא ${correct}. משווים את הצורה לפני הסיבוב ולאחר סיבוב של 180 מעלות: הכיוון מתהפך, אך היחס בין הצורה החיצונית לסימן הפנימי נשמר. רק אפשרות ${correct} מציגה את תוצאת הסיבוב המדויקת.`;
  }
  if (mode === 'matrix') {
    return `התשובה הנכונה היא ${correct}. במטריצה בודקים מה משתנה בכל עמודה ובכל שורה: סוג הצורה, הסיבוב, הגודל והמיקום הפנימי. התא החסר צריך להמשיך את שני החוקים יחד, ורק אפשרות ${correct} עושה זאת ללא חריגה.`;
  }
  if (mode === 'mirror') {
    return `התשובה הנכונה היא ${correct}. קו המראה הופך ימין ושמאל, ולכן גם הסימן הפנימי עובר לצד המקביל לאחר השיקוף. האפשרות הנכונה שומרת על הצורה והצבעים, אך מציבה אותם בצד המשוקף.`;
  }
  if (mode === 'cube') {
    return `התשובה הנכונה היא ${correct}. בשאלת קובייה משווים פרט-פרט: כיוון הפאות, סיבוב הגוף והסימן הפנימי שעל הפאה. אפשרות ${correct} היא היחידה שממשיכה את אותו חוק מרחבי; המסיחים דומים אך משנים פרט אחד כמו כיוון, פאה או מיקום פנימי.`;
  }
  return `התשובה הנכונה היא ${correct}. בסדרת הצורות בודקים את החוק המדויק: שינוי צורה, סיבוב, גודל ומיקום פנימי. רק אפשרות ${correct} ממשיכה את אותו רצף חזותי; המסיחים דומים אך טועים בפרט אחד.`;
}

function renderSignature(signature: ShapeSignature, x: number, y: number, size: number, primary: string, accent: string): string {
  const flipScale = signature.flip ? -1 : 1;
  return `
    <g transform="translate(${x} ${y}) rotate(${signature.rotation}) scale(${flipScale} ${signature.scale})">
      ${shapeMarkup(signature.kind, 0, 0, size, primary)}
      ${shapeMarkup(signature.secondaryKind, signature.secondaryDx, signature.secondaryDy, size * 0.38, accent)}
    </g>
  `;
}

function renderCubeSignature(signature: ShapeSignature, x: number, y: number, primary: string, accent: string, visualScale = 1): string {
  const shade = '#38BDF8';
  const scale = signature.scale * visualScale;
  return `
    <g transform="translate(${x} ${y}) rotate(${signature.rotation / 4}) scale(${scale})">
      <path d="M -42 -24 L 0 -48 L 42 -24 L 0 0 Z" fill="${primary}" stroke="#E5E7EB" stroke-width="3"/>
      <path d="M -42 -24 L 0 0 V 58 L -42 34 Z" fill="${accent}" stroke="#E5E7EB" stroke-width="3"/>
      <path d="M 42 -24 L 0 0 V 58 L 42 34 Z" fill="${shade}" stroke="#E5E7EB" stroke-width="3"/>
      ${shapeMarkup(signature.secondaryKind, 0, -18, 18, '#0F172A', '#E5E7EB')}
    </g>
  `;
}

function renderCell(content: string, cx: number, y = 124): string {
  return `<g><rect x="${cx - 38}" y="${y}" width="76" height="96" rx="14" fill="#111827" stroke="#334155" stroke-width="2"/>${content}</g>`;
}

function questionSvg(question: Question): string {
  const seed = hashString(`${question.id}:spatial-rule`);
  const [primary, accent, bg] = palette(seed);
  const mode = visualMode(question);
  const base = baseSignature(seed);
  const prompt = escapeXml(modePrompt(mode));

  if (mode === 'matrix') {
    const positions = [
      [176, 104], [288, 104], [400, 104],
      [176, 196], [288, 196], [400, 196],
      [176, 288], [288, 288], [400, 288],
    ];
    const cells = positions.map(([cx, cy], step) => {
      const content = step === 8
        ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="52" font-family="Arial" font-weight="700" fill="#F8FAFC">?</text>`
        : renderSignature(transformSignature(base, step, mode), cx, cy, 34, primary, accent);
      return `<g><rect x="${cx - 43}" y="${cy - 39}" width="86" height="78" rx="12" fill="#111827" stroke="#334155" stroke-width="2"/>${content}</g>`;
    }).join('');

    return svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" direction="rtl">
        <rect width="640" height="360" rx="28" fill="${bg}"/>
        <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
        <text x="592" y="62" text-anchor="end" font-size="24" font-family="Arial" font-weight="700" fill="#F8FAFC">${prompt}</text>
        <g>${cells}</g>
      </svg>
    `);
  }

  if (mode === 'mirror') {
    const source = renderSignature(base, 188, 178, 78, primary, accent);
    const missing = renderCell(`<text x="450" y="196" text-anchor="middle" font-size="58" font-family="Arial" font-weight="700" fill="#F8FAFC">?</text>`, 450, 130);
    return svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" direction="rtl">
        <rect width="640" height="360" rx="28" fill="${bg}"/>
        <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
        <text x="592" y="62" text-anchor="end" font-size="24" font-family="Arial" font-weight="700" fill="#F8FAFC">${prompt}</text>
        ${renderCell(source, 188, 130)}
        <path d="M 320 108 V 250" stroke="#22D3EE" stroke-width="6" stroke-dasharray="10 10" stroke-linecap="round"/>
        <text x="320" y="278" text-anchor="middle" font-size="18" font-family="Arial" font-weight="700" fill="#CBD5E1">קו מראה</text>
        ${missing}
      </svg>
    `);
  }

  if (mode === 'rotation') {
    const source = renderSignature(base, 188, 178, 78, primary, accent);
    const missing = renderCell(`<text x="450" y="196" text-anchor="middle" font-size="58" font-family="Arial" font-weight="700" fill="#F8FAFC">?</text>`, 450, 130);
    return svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" direction="rtl">
        <rect width="640" height="360" rx="28" fill="${bg}"/>
        <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
        <text x="592" y="62" text-anchor="end" font-size="24" font-family="Arial" font-weight="700" fill="#F8FAFC">${prompt}</text>
        ${renderCell(source, 188, 130)}
        <path d="M 266 178 C 306 118, 394 118, 430 176" fill="none" stroke="#22D3EE" stroke-width="8" stroke-linecap="round"/>
        <path d="M 430 176 l-26 -6 l14 24 z" fill="#22D3EE"/>
        <text x="348" y="118" text-anchor="middle" font-size="22" font-family="Arial" font-weight="700" fill="#CBD5E1">180°</text>
        ${missing}
      </svg>
    `);
  }

  const visibleSteps = mode === 'analogy' ? [0, 1, 2] : [0, 1, 2, 3];
  const xPositions = mode === 'analogy' ? [104, 210, 386, 492] : [88, 176, 264, 352, 440];
  const cells = visibleSteps.map((step, i) => {
    const sig = transformSignature(base, step, mode);
    const cx = xPositions[i];
    const shape = mode === 'cube'
      ? renderCubeSignature(sig, cx, 172, primary, accent, 0.58)
      : renderSignature(sig, cx, 172, 40, primary, accent);
    return renderCell(shape, cx);
  }).join('');

  const missingCx = xPositions[xPositions.length - 1];
  const missing = renderCell(`<text x="${missingCx}" y="190" text-anchor="middle" font-size="58" font-family="Arial" font-weight="700" fill="#F8FAFC">?</text>`, missingCx);
  const connectors = xPositions.slice(1).map((cx, index) => {
    if (index === xPositions.length - 2) return '';
    return `<path d="M ${cx - 65} 172 H ${cx - 43}" stroke="#94A3B8" stroke-width="5" stroke-linecap="round"/><path d="M ${cx - 43} 172 l-10 -7 v14 z" fill="#94A3B8"/>`;
  }).join('');
  const relation = mode === 'analogy'
    ? `<path d="M 142 96 H 196" stroke="#22D3EE" stroke-width="7" stroke-linecap="round"/><path d="M 196 96 l-16 -10 v20 z" fill="#22D3EE"/><text x="300" y="103" text-anchor="middle" font-size="30" font-family="Arial" font-weight="700" fill="#CBD5E1">::</text><path d="M 424 96 H 478" stroke="#22D3EE" stroke-width="7" stroke-linecap="round"/><path d="M 478 96 l-16 -10 v20 z" fill="#22D3EE"/>`
    : '';

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" direction="rtl">
      <rect width="640" height="360" rx="28" fill="${bg}"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <text x="592" y="62" text-anchor="end" font-size="24" font-family="Arial" font-weight="700" fill="#F8FAFC">${prompt}</text>
      <g>${relation}${connectors}</g>
      <g>${cells}${missing}</g>
    </svg>
  `);
}

function optionSvg(question: Question, option: QuestionOption, index: number): string {
  const seed = hashString(`${question.id}:spatial-rule`);
  const [primary, accent, bg] = palette(seed);
  const mode = visualMode(question);
  const correctId = correctOptionId(question);
  const target = targetSignature(question);
  const signature = option.id === correctId ? target : distractorSignature(target, index, mode);
  const shape = mode === 'cube'
    ? renderCubeSignature(signature, 210, 150, primary, accent, 1.25)
    : renderSignature(signature, 210, 146, 110, primary, accent);

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300">
      <rect width="420" height="300" rx="24" fill="${bg}"/>
      <rect x="20" y="20" width="380" height="260" rx="18" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      ${shape}
    </svg>
  `);
}

export function isSpatialQuestion(question: Question): boolean {
  const text = `${question.topicId} ${question.questionType} ${question.questionText} ${question.subtopicId ?? ''}`.toLowerCase();
  return question.topicId === 'topic_spatial'
    || question.questionType === 'shapes'
    || text.includes('spatial')
    || text.includes('shape')
    || text.includes('צור')
    || text.includes('מרחב')
    || text.includes('קוב')
    || text.includes('פריס')
    || text.includes('סיבוב')
    || text.includes('מראה')
    || text.includes('מטריצ');
}

function explanationSvg(question: Question): string {
  const seed = hashString(`${question.id}:spatial-rule`);
  const [primary, accent, bg] = palette(seed);
  const mode = visualMode(question);
  const target = targetSignature(question);
  const correctLabel = escapeXml(correctOptionId(question).toUpperCase());
  const targetVisual = mode === 'cube'
    ? renderCubeSignature(target, 178, 214, primary, accent, 1.02)
    : renderSignature(target, 178, 208, 88, primary, accent);
  const title = mode === 'cube'
    ? 'התאמת קובייה נכונה'
    : mode === 'mirror'
      ? 'שיקוף נכון'
      : mode === 'matrix'
        ? 'השלמת מטריצה'
        : mode === 'rotation'
          ? 'תוצאת סיבוב'
          : mode === 'analogy'
            ? 'השלמת אנלוגיה'
            : 'המשך סדרה';
  const checks = mode === 'cube'
    ? ['כיוון הפאות', 'סיבוב הגוף', 'סימן פנימי']
    : mode === 'mirror'
      ? ['צד משוקף', 'אותה צורה', 'סימן פנימי']
      : mode === 'matrix'
        ? ['חוק שורה', 'חוק עמודה', 'תא חסר']
        : mode === 'rotation'
          ? ['סיבוב 180°', 'אותה צורה', 'אותו סימן']
          : mode === 'analogy'
            ? ['שינוי בזוג', 'יישום זהה', 'התאמה מלאה']
            : ['רצף צורות', 'סיבוב וגודל', 'מיקום פנימי'];

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" direction="rtl">
      <rect width="640" height="400" rx="28" fill="${bg}"/>
      <rect x="28" y="28" width="584" height="344" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <text x="562" y="70" text-anchor="end" font-size="25" font-family="Arial" font-weight="700" fill="#F8FAFC">${escapeXml(title)}</text>
      <text x="562" y="101" text-anchor="end" font-size="17" font-family="Arial" fill="#CBD5E1">אפשרות ${correctLabel} משלימה את החוק החזותי.</text>
      <rect x="68" y="120" width="220" height="190" rx="24" fill="#111827" stroke="#475569" stroke-width="2"/>
      ${targetVisual}
      <text x="178" y="335" text-anchor="middle" font-size="20" font-family="Arial" font-weight="700" fill="#F8FAFC">אפשרות ${correctLabel}</text>
      <g transform="translate(540 150)">
        <circle cx="0" cy="0" r="15" fill="${primary}"/>
        <text x="0" y="5" text-anchor="middle" font-size="14" font-family="Arial" font-weight="700" fill="#0B1220">1</text>
        <text x="-28" y="5" text-anchor="end" font-size="18" font-family="Arial" fill="#F8FAFC">${escapeXml(checks[0])}</text>
      </g>
      <g transform="translate(540 204)">
        <circle cx="0" cy="0" r="15" fill="${accent}"/>
        <text x="0" y="5" text-anchor="middle" font-size="14" font-family="Arial" font-weight="700" fill="#0B1220">2</text>
        <text x="-28" y="5" text-anchor="end" font-size="18" font-family="Arial" fill="#F8FAFC">${escapeXml(checks[1])}</text>
      </g>
      <g transform="translate(540 258)">
        <circle cx="0" cy="0" r="15" fill="#38BDF8"/>
        <text x="0" y="5" text-anchor="middle" font-size="14" font-family="Arial" font-weight="700" fill="#0B1220">3</text>
        <text x="-28" y="5" text-anchor="end" font-size="18" font-family="Arial" fill="#F8FAFC">${escapeXml(checks[2])}</text>
      </g>
    </svg>
  `);
}

export function ensureSpatialVisualAssets(question: Question): Question {
  if (!isSpatialQuestion(question)) return question;

  const correctId = correctOptionId(question);
  const generatedQuestionImage = question.mediaUrl ? undefined : questionSvg(question);
  const generatedExplanationImage = question.explanationImageUrl ? undefined : explanationSvg(question);
  const options = question.options.map((option, index) => ({
    ...option,
    isCorrect: option.id === correctId,
    imageUrl: option.imageUrl ?? optionSvg(question, option, index),
  }));

  return {
    ...question,
    correctAnswer: correctId,
    questionType: 'shapes',
    questionText: question.questionText || modePrompt(visualMode(question)),
    mediaUrl: question.mediaUrl ?? generatedQuestionImage,
    mediaType: question.mediaType ?? 'image',
    explanation: question.explanation || spatialExplanation(question),
    explanationImageUrl: question.explanationImageUrl ?? generatedExplanationImage,
    options,
  };
}

export function getSpatialVisualModeForQa(question: Question): SpatialMode {
  return visualMode(question);
}
