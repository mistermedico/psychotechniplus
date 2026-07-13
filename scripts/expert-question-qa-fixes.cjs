const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config');
  return { url, key };
}

function svgData(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function shapeSvg(label, shape, fill = '#6D5DF6', extra = '') {
  const shapeMarkup = {
    square: `<rect x="54" y="54" width="92" height="92" rx="8" fill="${fill}" stroke="#111827" stroke-width="5"/>`,
    rectangle: `<rect x="40" y="64" width="120" height="72" rx="8" fill="${fill}" stroke="#111827" stroke-width="5"/>`,
    parallelogram: `<polygon points="65,54 162,54 135,146 38,146" fill="${fill}" stroke="#111827" stroke-width="5"/>`,
    trapezoid: `<polygon points="64,62 136,62 162,146 38,146" fill="${fill}" stroke="#111827" stroke-width="5"/>`,
    circle: `<circle cx="100" cy="100" r="52" fill="${fill}" stroke="#111827" stroke-width="5"/>`,
    triangle: `<polygon points="100,42 158,150 42,150" fill="${fill}" stroke="#111827" stroke-width="5"/>`,
  }[shape] ?? '';
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" rx="20" fill="#F8FAFC"/><g transform="translate(10 0)">${shapeMarkup}${extra}</g><text x="110" y="204" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#111827">${label}</text></svg>`);
}

function matrixCell(x, y, shape, fillMode, arrow) {
  const fill = fillMode === 'full' ? '#111827' : fillMode === 'stripe' ? 'url(#stripe)' : '#FFFFFF';
  const stroke = '#111827';
  const shapeMarkup = shape === 'circle'
    ? `<circle cx="${x+45}" cy="${y+55}" r="22" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`
    : shape === 'square'
      ? `<rect x="${x+23}" y="${y+33}" width="44" height="44" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`
      : `<polygon points="${x+45},${y+28} ${x+70},${y+78} ${x+20},${y+78}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  const arrowMap = { up: ['45,14 36,26 54,26', 'M45 26 L45 88'], right: ['76,55 64,46 64,64', 'M14 55 L64 55'], down: ['45,96 36,84 54,84', 'M45 22 L45 84'] };
  const [head, line] = arrowMap[arrow];
  return `<rect x="${x}" y="${y}" width="90" height="100" rx="12" fill="#EEF2FF" stroke="#CBD5E1"/>${shapeMarkup}<path d="${line}" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/><polygon points="${head}" fill="#2563EB"/>`;
}

function matrixQuestionSvg() {
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="430" height="390" viewBox="0 0 430 390"><defs><pattern id="stripe" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 8 L8 -2 M0 10 L10 0" stroke="#111827" stroke-width="2"/></pattern></defs><rect width="430" height="390" rx="24" fill="#F8FAFC"/><text x="215" y="34" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#111827">השלם את התא החסר במטריצה</text><g transform="translate(60 54)">${matrixCell(0,0,'circle','empty','up')}${matrixCell(105,0,'square','stripe','up')}${matrixCell(210,0,'triangle','full','up')}${matrixCell(0,110,'square','full','right')}${matrixCell(105,110,'triangle','empty','right')}${matrixCell(210,110,'circle','stripe','right')}${matrixCell(0,220,'triangle','stripe','down')}${matrixCell(105,220,'circle','full','down')}<rect x="210" y="220" width="90" height="100" rx="12" fill="#FDE68A" stroke="#F59E0B" stroke-width="3"/><text x="255" y="282" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#92400E">?</text></g></svg>`);
}

function matrixOptionSvg(label, shape, fillMode, arrow) {
  const fill = fillMode === 'full' ? '#111827' : fillMode === 'stripe' ? 'url(#stripe)' : '#FFFFFF';
  const shapeMarkup = shape === 'circle'
    ? `<circle cx="100" cy="104" r="38" fill="${fill}" stroke="#111827" stroke-width="5"/>`
    : shape === 'square'
      ? `<rect x="62" y="66" width="76" height="76" rx="9" fill="${fill}" stroke="#111827" stroke-width="5"/>`
      : `<polygon points="100,56 146,148 54,148" fill="${fill}" stroke="#111827" stroke-width="5"/>`;
  const arrowMap = { right: ['158,104 140,92 140,116', 'M42 104 L140 104'], down: ['100,172 88,154 112,154', 'M100 36 L100 154'] };
  const [head, line] = arrowMap[arrow];
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><defs><pattern id="stripe" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 8 L8 -2 M0 10 L10 0" stroke="#111827" stroke-width="2"/></pattern></defs><rect width="220" height="220" rx="20" fill="#F8FAFC"/>${shapeMarkup}<path d="${line}" stroke="#2563EB" stroke-width="5" stroke-linecap="round"/><polygon points="${head}" fill="#2563EB"/><text x="110" y="204" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#111827">${label}</text></svg>`);
}

function pRotationSvg() {
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220" viewBox="0 0 420 220"><rect width="420" height="220" rx="24" fill="#F8FAFC"/><text x="210" y="34" text-anchor="middle" font-family="Arial" font-size="19" font-weight="700" fill="#111827">סיבוב האות P ב-180 מעלות</text><text x="110" y="140" text-anchor="middle" font-family="Arial" font-size="92" font-weight="700" fill="#4F46E5">P</text><path d="M175 110 H245" stroke="#111827" stroke-width="5" marker-end="url(#a)"/><text x="310" y="140" text-anchor="middle" font-family="Arial" font-size="92" font-weight="700" fill="#16A34A" transform="rotate(180 310 110)">P</text><text x="310" y="185" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#111827">דומה ל-d</text><defs><marker id="a" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#111827"/></marker></defs></svg>`);
}

function setCorrect(options, id) {
  return (options ?? []).map(o => ({ ...o, isCorrect: o.id === id }));
}

async function fetchAllQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('questions').select('*').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function normalizeQuestion(q) {
  const options = Array.isArray(q.options) ? q.options : [];
  const correctId = q.correct_answer || options.find(o => o.isCorrect)?.id || options[0]?.id;
  const normalizedOptions = options.map(o => ({ ...o, isCorrect: o.id === correctId }));
  const update = {};
  if (options.filter(o => o.isCorrect).length !== 1 || options.some((o, i) => o.isCorrect !== normalizedOptions[i].isCorrect)) {
    update.options = normalizedOptions;
  }
  return update;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  const fixes = [];

  const targeted = new Map();
  targeted.set('q_pro_spatial_69564ba92ef39aa110626958', q => ({
    media_url: svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="240" viewBox="0 0 520 240"><rect width="520" height="240" rx="24" fill="#F8FAFC"/><text x="260" y="36" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#111827">בחר את הצורה החריגה</text><text x="260" y="66" text-anchor="middle" font-family="Arial" font-size="15" fill="#475569">שלוש צורות הן מקביליות: יש להן שני זוגות צלעות מקבילות</text><image href="${shapeSvg('ריבוע','square','#60A5FA')}" x="20" y="78" width="110" height="110"/><image href="${shapeSvg('מלבן','rectangle','#60A5FA')}" x="145" y="78" width="110" height="110"/><image href="${shapeSvg('מקבילית','parallelogram','#60A5FA')}" x="270" y="78" width="110" height="110"/><image href="${shapeSvg('טרפז','trapezoid','#F97316')}" x="395" y="78" width="110" height="110"/></svg>`),
    options: q.options.map(o => ({ ...o, imageUrl: ({ '1': shapeSvg('ריבוע','square','#60A5FA'), '2': shapeSvg('מלבן','rectangle','#60A5FA'), '3': shapeSvg('מקבילית','parallelogram','#60A5FA'), '4': shapeSvg('טרפז','trapezoid','#F97316') })[o.id] })),
    explanation: 'התשובה הנכונה היא טרפז. ריבוע, מלבן ומקבילית הם כולם מרובעים עם שני זוגות של צלעות נגדיות מקבילות. לטרפז יש זוג אחד בלבד של צלעות מקבילות, ולכן רק הוא אינו שייך לקבוצה. כך נשארת תשובה נכונה אחת בלבד.',
  }));

  targeted.set('q_pro_spatial_695a9749d49d2d3053a8ff57', q => ({
    question_text: 'לפניך מטריצה 3x3 של צורות, מילויים וכיווני חצים. איזו אפשרות משלימה את התא החסר?',
    media_url: matrixQuestionSvg(),
    options: q.options.map(o => ({ ...o, imageUrl: ({
      a: matrixOptionSvg('ריבוע מלא, חץ למטה','square','full','down'),
      b: matrixOptionSvg('עיגול ריק, חץ למטה','circle','empty','down'),
      c: matrixOptionSvg('ריבוע ריק, חץ ימינה','square','empty','right'),
      d: matrixOptionSvg('ריבוע ריק, חץ למטה','square','empty','down'),
    })[o.id] })),
    explanation: 'התשובה הנכונה היא ד. בכל שורה מופיעות שלוש צורות שונות: עיגול, ריבוע ומשולש. בשורה התחתונה כבר מופיעים משולש ועיגול, לכן חסר ריבוע. בכל שורה מופיעים גם שלושה סוגי מילוי: מפוספס, מלא וריק; בשורה התחתונה יש מפוספס ומלא, לכן חסר ריק. כיוון החץ בשורה התחתונה הוא למטה. רק אפשרות ד משלבת ריבוע ריק עם חץ למטה.',
  }));

  targeted.set('q_pro_spatial_6969183d2950e337c3845308', q => ({
    correct_answer: '2',
    media_url: pRotationSvg(),
    options: setCorrect(q.options.map(o => ({ ...o, imageUrl: ({
      '1': svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="18" fill="#F8FAFC"/><text x="80" y="112" text-anchor="middle" font-family="Arial" font-size="96" font-weight="700" fill="#111827">b</text></svg>`),
      '2': svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="18" fill="#DCFCE7"/><text x="80" y="112" text-anchor="middle" font-family="Arial" font-size="96" font-weight="700" fill="#166534">d</text></svg>`),
      '3': svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="18" fill="#F8FAFC"/><text x="80" y="112" text-anchor="middle" font-family="Arial" font-size="96" font-weight="700" fill="#111827">q</text></svg>`),
      '4': svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="18" fill="#F8FAFC"/><text x="80" y="112" text-anchor="middle" font-family="Arial" font-size="96" font-weight="700" fill="#111827">p</text></svg>`),
    })[o.id] })), '2'),
    explanation: 'התשובה הנכונה היא d. באות P הקו האנכי נמצא משמאל והלולאה נמצאת בחלק העליון. כאשר מסובבים את כל הצורה ב-180 מעלות, הקו האנכי עובר לימין והלולאה עוברת לצד שמאל-תחתון. מבין האפשרויות, הצורה הדומה ביותר היא האות d; b, p ו-q משאירות את הקו או הלולאה בכיוון שאינו מתאים לסיבוב מלא.',
  }));

  targeted.set('q_pro_spatial_696b4544a7273f46ed8fe658', q => ({
    topic_id: 'topic_logic',
    question_type: 'logic',
    media_url: null,
    explanation: 'התשובה הנכונה היא שלא ניתן להסיק דבר ודאי לגבי דני. מהנתון "כל החתולים אוהבים חלב" נובע שאם מישהו חתול אז הוא אוהב חלב. אך הכיוון ההפוך אינו תקף: העובדה שדני אוהב חלב אינה מוכיחה שהוא חתול, ואינה מוכיחה שאינו חתול. לכן רק אפשרות ג נכונה.',
  }));

  targeted.set('q_pro_spatial_6a18ac3e935e65d95a751158', q => ({
    explanation: 'התשובה הנכונה היא 5 צלעות אדום. בסדרה יש שני חוקים במקביל: מספר הצלעות מתקדם 3, 4, 5, 6 ואז חוזר ל-3, 4, ולכן בשלב 7 חוזרים ל-5 צלעות. הצבעים מתחלפים אדום, כחול, אדום, כחול וכן הלאה; שלב 7 הוא אי-זוגי ולכן אדום. רק אפשרות ב משלבת חמש צלעות וצבע אדום.',
  }));

  for (const q of questions) {
    const update = { ...normalizeQuestion(q) };
    const targetedFix = targeted.get(q.id)?.(q);
    if (targetedFix) Object.assign(update, targetedFix);
    if (Object.keys(update).length === 0) continue;
    const { error } = await supabase.from('questions').update(update).eq('id', q.id);
    fixes.push({ id: q.id, ok: !error, fields: Object.keys(update), error: error?.message });
    if (error) throw error;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { fixedAt: new Date().toISOString(), scanned: questions.length, fixesCount: fixes.length, fixes };
  fs.writeFileSync(path.join(OUT_DIR, 'expert-question-qa-fixes-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
