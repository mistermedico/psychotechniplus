import { Question, QuestionOption } from '../data/types';

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

function questionSvg(question: Question): string {
  const seed = hashString(`${question.id}:${question.questionText}`);
  const [primary, accent, bg] = palette(seed);
  const label = escapeXml(question.questionText.replace(/\s+/g, ' ').slice(0, 88));
  const title = question.questionText.includes('קוב') || question.questionText.includes('פריס')
    ? 'תרשים קוביות / פריסה'
    : question.questionText.includes('מטריצ') || question.questionText.includes('סדרה')
      ? 'מטריצת צורות'
      : 'חשיבה מרחבית';
  const cells = Array.from({ length: 9 }, (_, i) => {
    const cx = 86 + (i % 3) * 92;
    const cy = 88 + Math.floor(i / 3) * 72;
    const fill = i === 8 ? '#111827' : (i + seed) % 2 === 0 ? primary : accent;
    const mark = i === 8
      ? `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="34" font-family="Arial" font-weight="700" fill="#F8FAFC">?</text>`
      : shapeMarkup(seed + i, cx, cy, 40, fill);
    return `<g><rect x="${cx - 34}" y="${cy - 30}" width="68" height="60" rx="10" fill="rgba(255,255,255,0.06)" stroke="#334155"/>${mark}</g>`;
  }).join('');

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="28" fill="${bg}"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <text x="592" y="58" text-anchor="end" font-size="25" font-family="Arial" font-weight="700" fill="#F8FAFC">${escapeXml(title)}</text>
      <text x="592" y="88" text-anchor="end" font-size="17" font-family="Arial" fill="#CBD5E1">${label}</text>
      <g transform="translate(232 96) rotate(${seed % 4 * 90} 120 80)">
        ${shapeMarkup(seed, 120, 80, 92, primary)}
        ${shapeMarkup(seed + 2, 194, 132, 54, accent)}
        <path d="M 36 184 C 96 230, 206 228, 274 184" fill="none" stroke="#94A3B8" stroke-width="8" stroke-linecap="round"/>
        <path d="M 274 184 l-28 -12 l8 30 z" fill="#94A3B8"/>
      </g>
      <g>${cells}</g>
    </svg>
  `);
}

function optionSvg(question: Question, option: QuestionOption, index: number): string {
  const seed = hashString(`${question.id}:${option.id}:${option.text}`);
  const [primary, accent, bg] = palette(seed + index);
  const label = escapeXml((option.text || `אפשרות ${option.id.toUpperCase()}`).replace(/\s+/g, ' ').slice(0, 52));
  const rotation = (seed % 4) * 90;
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300">
      <rect width="420" height="300" rx="24" fill="${bg}"/>
      <rect x="20" y="20" width="380" height="260" rx="18" fill="#0B1220" stroke="#334155" stroke-width="2"/>
      <text x="374" y="54" text-anchor="end" font-size="22" font-family="Arial" font-weight="700" fill="#F8FAFC">אפשרות ${escapeXml(option.id.toUpperCase())}</text>
      <text x="374" y="80" text-anchor="end" font-size="15" font-family="Arial" fill="#CBD5E1">${label}</text>
      <g transform="translate(210 166) rotate(${rotation})">
        ${shapeMarkup(seed, 0, 0, 96, primary)}
        ${shapeMarkup(seed + 1, 58, 46, 48, accent)}
        <path d="M -96 94 H 96" stroke="#94A3B8" stroke-width="8" stroke-linecap="round"/>
      </g>
    </svg>
  `);
}

function isSpatialQuestion(question: Question): boolean {
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
  const correctLabel = escapeXml((correct?.text || `אפשרות ${question.correctAnswer.toUpperCase()}`).replace(/\s+/g, ' ').slice(0, 58));
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
    imageUrl: option.imageUrl || optionSvg(question, option, index),
  }));

  return {
    ...question,
    mediaUrl: question.mediaUrl || questionSvg(question),
    mediaType: 'image',
    explanationImageUrl: question.explanationImageUrl || explanationSvg(question),
    options,
  };
}
