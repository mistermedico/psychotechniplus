import { Question, QuestionOption } from '../data/types';

function svgDataUri(svg: string): string {
  const encoded = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(svg)))
    : (globalThis as any).Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
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

function visualMode(question: Question): 'series' | 'analogy' | 'rotation' | 'cube' {
  const text = `${question.questionText} ${question.subtopicId ?? ''}`.toLowerCase();
  if (text.includes('analog') || text.includes('אנלוג')) return 'analogy';
  if (text.includes('rotate') || text.includes('rotation') || text.includes('סיבוב')) return 'rotation';
  if (text.includes('cube') || text.includes('קוב') || text.includes('פריס')) return 'cube';
  return 'series';
}

function sequenceShape(seed: number, index: number, x: number, y: number, size: number, primary: string, accent: string): string {
  const rotation = ((seed + index) % 4) * 90;
  const scale = 0.78 + ((seed + index) % 3) * 0.1;
  return `
    <g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})">
      ${shapeMarkup(seed + index, 0, 0, size, primary)}
      ${shapeMarkup(seed + index + 2, size * 0.34, size * 0.32, size * 0.34, accent)}
    </g>
  `;
}

function questionSvg(question: Question): string {
  const seed = hashString(`${question.id}:${question.questionText}`);
  const [primary, accent, bg] = palette(seed);
  const mode = visualMode(question);
  const count = mode === 'analogy' ? 5 : 6;
  const cells = Array.from({ length: count }, (_, i) => {
    const cx = 88 + i * 88;
    const isQuestionMark = i === count - 1;
    const mark = isQuestionMark
      ? `<text x="${cx}" y="190" text-anchor="middle" font-size="58" font-family="Arial" font-weight="700" fill="#F8FAFC">?</text>`
      : sequenceShape(seed, i, cx, 170, 46, (i + seed) % 2 === 0 ? primary : accent, (i + seed) % 2 === 0 ? accent : primary);
    const arrow = i > 0 && !isQuestionMark
      ? `<path d="M ${cx - 58} 170 H ${cx - 34}" stroke="#94A3B8" stroke-width="5" stroke-linecap="round"/><path d="M ${cx - 34} 170 l-10 -7 v14 z" fill="#94A3B8"/>`
      : '';
    return `${arrow}<g><rect x="${cx - 34}" y="124" width="68" height="92" rx="14" fill="#111827" stroke="#334155" stroke-width="2"/>${mark}</g>`;
  }).join('');

  const relation = mode === 'analogy'
    ? `<path d="M 175 105 H 245" stroke="#22D3EE" stroke-width="7" stroke-linecap="round"/><path d="M 245 105 l-16 -10 v20 z" fill="#22D3EE"/><path d="M 352 105 H 422" stroke="#22D3EE" stroke-width="7" stroke-linecap="round"/><path d="M 422 105 l-16 -10 v20 z" fill="#22D3EE"/>`
    : mode === 'rotation'
      ? `<path d="M 266 92 C 330 42, 412 50, 460 105" fill="none" stroke="#22D3EE" stroke-width="8" stroke-linecap="round"/><path d="M 460 105 l-28 -7 l16 25 z" fill="#22D3EE"/>`
      : mode === 'cube'
        ? `<g transform="translate(450 66)"><path d="M0 40 L42 16 L84 40 L42 64 Z" fill="${primary}" stroke="#E5E7EB" stroke-width="3"/><path d="M0 40 L42 64 V112 L0 88 Z" fill="${accent}" stroke="#E5E7EB" stroke-width="3"/><path d="M84 40 L42 64 V112 L84 88 Z" fill="#38BDF8" stroke="#E5E7EB" stroke-width="3"/></g>`
        : '';

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="28" fill="${bg}"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <g>${relation}</g>
      <g>${cells}</g>
      <text x="320" y="286" text-anchor="middle" font-size="18" font-family="Arial" font-weight="700" fill="#CBD5E1">בחרו את הצורה המתאימה</text>
    </svg>
  `);
}

function optionSvg(question: Question, option: QuestionOption, index: number): string {
  const seed = hashString(`${question.id}:${option.id}:${option.text}:${index}`);
  const [primary, accent, bg] = palette(seed + index);
  const rotation = (seed % 4) * 90;
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300">
      <rect width="420" height="300" rx="24" fill="${bg}"/>
      <rect x="20" y="20" width="380" height="260" rx="18" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <g transform="translate(210 146) rotate(${rotation})">
        ${shapeMarkup(seed, 0, 0, 106, primary)}
        ${shapeMarkup(seed + index + 1, 62, 48, 48, accent)}
        <path d="M -104 104 H 104" stroke="#94A3B8" stroke-width="8" stroke-linecap="round"/>
      </g>
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
  const seed = hashString(`${question.id}:explanation:${question.explanation}`);
  const [primary, accent, bg] = palette(seed + 11);
  const correct = question.options.find(option => option.id === question.correctAnswer);
  const correctLabel = escapeXml((correct?.id || question.correctAnswer).toUpperCase());
  const steps = [
    'מזהים את הכלל החזותי',
    'משווים סיבוב / שיקוף / מיקום',
    `התשובה המתאימה: ${correctLabel}`,
  ];

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" direction="rtl">
      <rect width="640" height="360" rx="28" fill="${bg}"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <text x="592" y="62" text-anchor="end" font-size="26" font-family="Arial" font-weight="700" fill="#F8FAFC">תרשים פתרון חזותי</text>
      <g transform="translate(76 106)">
        <rect x="0" y="0" width="160" height="150" rx="18" fill="#111827" stroke="#475569" stroke-width="2"/>
        ${shapeMarkup(seed, 80, 74, 86, primary)}
        ${shapeMarkup(seed + 1, 116, 108, 42, accent)}
        <text x="80" y="132" text-anchor="middle" font-size="15" font-family="Arial" fill="#CBD5E1">מקור</text>
      </g>
      <path d="M 260 182 C 306 138, 354 138, 400 182" fill="none" stroke="#94A3B8" stroke-width="9" stroke-linecap="round"/>
      <path d="M 400 182 l-28 -14 l9 31 z" fill="#94A3B8"/>
      <g transform="translate(428 106) rotate(${(seed % 4) * 90} 80 74)">
        <rect x="0" y="0" width="160" height="150" rx="18" fill="#111827" stroke="${primary}" stroke-width="3"/>
        ${shapeMarkup(seed, 80, 74, 86, primary)}
        ${shapeMarkup(seed + 1, 116, 108, 42, accent)}
      </g>
      <text x="508" y="238" text-anchor="middle" font-size="15" font-family="Arial" fill="#CBD5E1">לאחר שינוי</text>
      <g>
        ${steps.map((step, index) => `
          <g transform="translate(548 ${104 + index * 42})">
            <circle cx="0" cy="0" r="15" fill="${index === 2 ? accent : primary}"/>
            <text x="0" y="5" text-anchor="middle" font-size="14" font-family="Arial" font-weight="700" fill="#0B1220">${index + 1}</text>
            <text x="-24" y="5" text-anchor="end" font-size="17" font-family="Arial" fill="#F8FAFC">${escapeXml(step)}</text>
          </g>
        `).join('')}
      </g>
    </svg>
  `);
}

export function ensureSpatialVisualAssets(question: Question): Question {
  if (!isSpatialQuestion(question)) return question;

  const options = question.options.map((option, index) => ({
    ...option,
    text: '',
    imageUrl: option.imageUrl?.trim() || optionSvg(question, option, index),
  }));

  return {
    ...question,
    questionType: 'shapes',
    questionText: 'בחרו את התמונה המתאימה.',
    mediaUrl: question.mediaUrl?.trim() || questionSvg(question),
    mediaType: 'image',
    explanationImageUrl: question.explanationImageUrl?.trim() || explanationSvg(question),
    options,
  };
}
