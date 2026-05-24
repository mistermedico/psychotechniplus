#!/usr/bin/env node
/**
 * ai-seed-questions.mjs
 *
 * מחולל שאלות AI — יוצר עשרות שאלות ברמות חשיבה שונות ומזריק ל-Supabase
 * עם סטטוס "pending" (ממתין לאישור מנהל).
 *
 * המנהל יצטרך לאחר מכן:
 *   - לאשר / לדחות כל שאלה (validate)
 *   - לשייך לפרקים / מסלולים (topic_id, target_ids)
 *   - להגדיר גישה (free / premium)
 *
 * שימוש:
 *   node scripts/ai-seed-questions.mjs                     # הרצה מלאה
 *   node scripts/ai-seed-questions.mjs --dry-run           # תצוגה מקדימה
 *   node scripts/ai-seed-questions.mjs --topic logic       # נושא ספציפי
 *   node scripts/ai-seed-questions.mjs --count 5           # מספר שאלות לנושא (ברירת מחדל: 15)
 *   node scripts/ai-seed-questions.mjs --model claude-haiku-4-5-20251001  # מודל זול יותר
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://kdnkrvltgptiffxkclyg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkbmtydmx0Z3B0aWZmeGtjbHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyODcsImV4cCI6MjA5NDYxNDI4N30.FPfk0H5ln1gTkWgyt84atBJ3MgnSnWJR9Xi6ujYM6pM';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

// ── CLI args ──────────────────────────────────────────────────────────────────

const DRY_RUN      = process.argv.includes('--dry-run');
const TOPIC_FILTER = (() => {
  const i = process.argv.indexOf('--topic');
  return i !== -1 ? process.argv[i + 1] : null;
})();
const COUNT_PER_TOPIC = (() => {
  const i = process.argv.indexOf('--count');
  return i !== -1 ? parseInt(process.argv[i + 1]) || 15 : 15;
})();
const MODEL = (() => {
  const i = process.argv.indexOf('--model');
  return i !== -1 ? process.argv[i + 1] : 'claude-sonnet-4-6';
})();

// ── Topic definitions ─────────────────────────────────────────────────────────

const TOPICS = [
  {
    id: 'topic_quantitative',
    name: 'חשיבה כמותית',
    defaultTargets: ['target_psychometric', 'target_ktzina', 'target_hightech'],
    types: ['multiple_choice', 'quantitative'],
    subtopics: [
      'אחוזים ויחסים',
      'משוואות ואלגברה',
      'הנדסה וגיאומטריה',
      'סדרות ודפוסים',
      'שאלות מילוליות (ברזים, מרחק-מהירות-זמן)',
      'הסתברות וסטטיסטיקה',
      'תמורות וצירופים (קומבינטוריקה)',
    ],
  },
  {
    id: 'topic_verbal',
    name: 'חשיבה מילולית',
    defaultTargets: ['target_psychometric', 'target_ktzina'],
    types: ['verbal', 'reading_comprehension'],
    subtopics: [
      'אנלוגיות',
      'אנטונימים ומילים נרדפות',
      'מילה חריגה',
      'ביטויים ופתגמים עבריים',
      'הבנת הנקרא',
      'השלמת משפט',
      'מילים זרות נפוצות (פרגמטי, דיאלקטי, לאקוני...)',
    ],
  },
  {
    id: 'topic_logic',
    name: 'חשיבה לוגית',
    defaultTargets: ['target_psychometric', 'target_ktzina', 'target_modiin', 'target_hightech'],
    types: ['logic'],
    subtopics: [
      'סילוגיזמים (Modus Ponens / Tollens)',
      'תנאים לוגיים (אם–אז)',
      'סדרות מספרים וצורות',
      'בעיות ישיבה וסידור',
      'קופסאות וחדות תשומת-לב',
      'גשר ולפיד (אופטימיזציה)',
      'הסתברות גיאומטרית',
      'חידות לוגיות קלאסיות',
    ],
  },
  {
    id: 'topic_spatial',
    name: 'צורות ומרחב',
    defaultTargets: ['target_psychometric', 'target_tayyas', 'target_ktzina'],
    types: ['shapes'],
    subtopics: [
      'קיפולי נייר וחורים',
      'קוביות ומבנים תלת-ממדיים',
      'סיבובים ושיקופים',
      'פריסות (nets) של גופות',
      'גיאומטריה של עיגולים ומשולשים',
      'ספירת קוביות במבנים',
      'חתכים של גופות',
    ],
  },
];

// ── Difficulty distribution ───────────────────────────────────────────────────
// Per batch call: we ask for questions at specific difficulty levels
// Distribution across difficulty 2-8, weighted toward middle (4-6)

function buildDifficultyBatches(totalCount) {
  // Returns array of {difficulty, count} summing to totalCount
  const weights = { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3, 7: 2, 8: 1 };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const batches = [];
  let remaining = totalCount;

  for (const [diff, weight] of Object.entries(weights)) {
    const count = Math.round((weight / totalWeight) * totalCount);
    if (count > 0 && remaining > 0) {
      batches.push({ difficulty: parseInt(diff), count: Math.min(count, remaining) });
      remaining -= count;
    }
  }

  // Add leftover to difficulty 5
  if (remaining > 0) {
    const mid = batches.find(b => b.difficulty === 5);
    if (mid) mid.count += remaining;
    else batches.push({ difficulty: 5, count: remaining });
  }

  return batches;
}

// ── Claude prompt ─────────────────────────────────────────────────────────────

function buildPrompt(topic, difficulty, count, subtopic) {
  const isTrueFalse = false;
  const typeStr = topic.types[0];

  const TYPE_INSTRUCTIONS = {
    multiple_choice: 'שאלת בחירה מרובה קלאסית. 4 אפשרויות (a/b/c/d), תשובה אחת נכונה.',
    quantitative:    'שאלה כמותית: חשבון, אלגברה, הנדסה, סטטיסטיקה, הסתברות. 4 אפשרויות.',
    verbal:          'שאלה מילולית: אנלוגיות, אנטונימים, השלמת משפט, מילים נרדפות/חריגות.',
    logic:           'שאלת היגיון: סדרות, סילוגיזמים, תנאים לוגיים, ישיבה, חידות.',
    reading_comprehension: 'שאלת הבנת הנקרא — כלול קטע קריאה קצר (3-5 משפטים) ושאלה לגביו.',
    shapes:          'שאלת מרחב/צורות: קוביות, קיפולים, סיבובים, גיאומטריה. אם הצורה מורכבת — תאר אותה בטקסט.',
  };

  const typeInstruction = TYPE_INSTRUCTIONS[typeStr] ?? TYPE_INSTRUCTIONS.multiple_choice;

  return {
    system: `אתה מחולל שאלות מקצועי לבחינות פסיכוטכניות ישראליות (צבא, הייטק, שב"ס).
צור שאלות מקוריות, מדויקות, בעברית תקנית.
ודא שהתשובה הנכונה אכן נכונה וההסבר מפורט ומדויק.
החזר JSON בלבד — מערך, ללא טקסט לפני או אחרי.`,

    user: `צור ${count} שאלות בנושא "${topic.name}" — תת-נושא: "${subtopic}" — ברמת קושי ${difficulty}/10.
סוג שאלה: ${typeInstruction}

${typeStr === 'reading_comprehension' ? 'כלול שדה "readingPassage" עם קטע קריאה.' : ''}

החזר JSON — מערך בדיוק במבנה:
[
  {
    "questionText": "...",
    ${typeStr === 'reading_comprehension' ? '"readingPassage": "...",\n    ' : ''}"options": [
      { "id": "a", "text": "...", "isCorrect": false },
      { "id": "b", "text": "...", "isCorrect": true },
      { "id": "c", "text": "...", "isCorrect": false },
      { "id": "d", "text": "...", "isCorrect": false }
    ],
    "correctAnswer": "b",
    "explanation": "הסבר מפורט ומדויק...",
    "difficulty": ${difficulty},
    "questionType": "${typeStr}",
    "subtopic": "${subtopic}"
  }
]

חשוב: ודא שרק אפשרות אחת היא isCorrect:true, ו-correctAnswer תואם לה.`,
  };
}

// ── AI generation ─────────────────────────────────────────────────────────────

async function generateQuestions(client, topic, difficulty, count, subtopic) {
  const { system, user } = buildPrompt(topic, difficulty, count, subtopic);

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]);
  } catch {
    // Try extracting individual objects
    const objMatches = raw.match(/\{[\s\S]*?\}(?=\s*[,\]])/g) ?? [];
    return objMatches.flatMap(s => { try { return [JSON.parse(s)]; } catch { return []; } });
  }
}

// ── ID generation ─────────────────────────────────────────────────────────────

function generateId(topicId) {
  const prefix = topicId.replace('topic_', 'q_');
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_ai_${ts}_${rand}`;
}

// ── ELO from difficulty ───────────────────────────────────────────────────────

function eloFromDifficulty(d) {
  if (d <= 2) return 900 + d * 75;
  if (d <= 4) return 1050 + (d - 2) * 100;
  if (d <= 6) return 1250 + (d - 4) * 65;
  if (d <= 8) return 1380 + (d - 6) * 60;
  return 1500 + (d - 8) * 50;
}

// ── Build Supabase row ────────────────────────────────────────────────────────

function buildRow(q, topic) {
  const id = generateId(topic.id);

  // Validate options
  const options = (q.options ?? []).map(o => ({
    id: o.id,
    text: String(o.text ?? ''),
    isCorrect: Boolean(o.isCorrect),
  }));

  const correctAnswer = q.correctAnswer ?? options.find(o => o.isCorrect)?.id ?? 'a';

  return {
    id,
    target_ids: [],                         // מנהל ישייך למסלולים
    topic_id: topic.id,
    subtopic_id: q.subtopic ?? null,
    question_type: q.questionType ?? topic.types[0],
    question_text: String(q.questionText ?? ''),
    reading_passage: q.readingPassage ?? null,
    media_url: null,
    media_type: null,
    options,
    correct_answer: correctAnswer,
    explanation: String(q.explanation ?? ''),
    difficulty: Number(q.difficulty ?? 5),
    psychometric_stats: {
      elo: eloFromDifficulty(Number(q.difficulty ?? 5)),
      discrimination: parseFloat((0.65 + Math.random() * 0.25).toFixed(2)),
      guessProbability: 0.25,
    },
    access_level: 'free',                   // מנהל יקבע גישה
    validation_status: 'pending',           // ממתין לאישור מנהל ← מרכזי!
    smart_practice_eligible: false,
    general_practice_eligible: false,
  };
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertToSupabase(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🤖 PsychoTechniPlus — AI Question Seeder');
  console.log('==========================================');

  if (!ANTHROPIC_API_KEY) {
    console.error('\n❌ ANTHROPIC_API_KEY לא מוגדר!');
    console.error('   הגדר: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  if (DRY_RUN) console.log('🔍 מצב DRY RUN — לא יישמר לSupabase\n');

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const topicsToProcess = TOPIC_FILTER
    ? TOPICS.filter(t => t.id.includes(TOPIC_FILTER) || t.name.includes(TOPIC_FILTER))
    : TOPICS;

  if (topicsToProcess.length === 0) {
    console.error(`❌ לא נמצא נושא: "${TOPIC_FILTER}"`);
    process.exit(1);
  }

  console.log(`📋 נושאים לעיבוד: ${topicsToProcess.map(t => t.name).join(', ')}`);
  console.log(`📊 שאלות לנושא: ${COUNT_PER_TOPIC}`);
  console.log(`🤖 מודל: ${MODEL}`);
  console.log(`📌 סטטוס: pending (ממתין לאישור מנהל)\n`);

  const allRows = [];
  let totalGenerated = 0;
  let totalFailed = 0;

  for (const topic of topicsToProcess) {
    console.log(`\n── ${topic.name} (${topic.id}) ──`);

    const batches = buildDifficultyBatches(COUNT_PER_TOPIC);
    const subtopics = [...topic.subtopics];

    for (const { difficulty, count } of batches) {
      // Pick a random subtopic for this batch
      const subtopic = subtopics[Math.floor(Math.random() * subtopics.length)];

      process.stdout.write(`  רמה ${difficulty}/10 × ${count} שאלות (${subtopic})... `);

      try {
        const questions = await generateQuestions(client, topic, difficulty, count, subtopic);

        if (questions.length === 0) {
          console.log('⚠️  אין תוצאות');
          totalFailed += count;
          continue;
        }

        const rows = questions.slice(0, count).map(q => buildRow(q, topic));
        allRows.push(...rows);
        totalGenerated += rows.length;
        console.log(`✓ ${rows.length} שאלות`);

        if (DRY_RUN && rows.length > 0) {
          const sample = rows[0];
          console.log(`    דוגמה: "${sample.question_text.slice(0, 70)}..."`);
          console.log(`    תשובה נכונה: ${sample.correct_answer.toUpperCase()} | ELO: ${sample.psychometric_stats.elo}`);
        }

        // Small delay to respect rate limits
        if (!DRY_RUN) await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`❌ שגיאה: ${e.message.slice(0, 80)}`);
        totalFailed += count;
      }
    }
  }

  // ── Summary before insert ─────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════');
  console.log(`✅ נוצרו: ${totalGenerated} שאלות`);
  if (totalFailed > 0) console.log(`⚠️  נכשלו: ${totalFailed} שאלות`);

  // Breakdown by topic
  const byTopic = {};
  for (const r of allRows) {
    byTopic[r.topic_id] = (byTopic[r.topic_id] ?? 0) + 1;
  }
  for (const [tid, cnt] of Object.entries(byTopic)) {
    console.log(`   ${tid.replace('topic_', '')}: ${cnt} שאלות`);
  }

  // Breakdown by difficulty
  const byDiff = {};
  for (const r of allRows) {
    byDiff[r.difficulty] = (byDiff[r.difficulty] ?? 0) + 1;
  }
  const diffStr = Object.entries(byDiff).sort(([a],[b]) => a-b).map(([d,c]) => `רמה ${d}: ${c}`).join(', ');
  console.log(`   ${diffStr}`);
  console.log('══════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — לא נשמר. הסר --dry-run להרצה אמיתית.\n');
    return;
  }

  if (allRows.length === 0) {
    console.log('\n⚠️  אין שאלות לשמירה.\n');
    return;
  }

  // ── Upsert to Supabase ────────────────────────────────────────────────────

  console.log('\n☁️  מזריק לSupabase...');
  const BATCH_SIZE = 20;
  let ok = 0, fail = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    try {
      await upsertToSupabase(batch);
      ok += batch.length;
      process.stdout.write('.');
    } catch (e) {
      fail += batch.length;
      console.error(`\n  ✗ Batch ${i}–${i + batch.length}: ${e.message.slice(0, 150)}`);
    }
  }

  console.log(`\n\n  ✅ ${ok} שאלות הוזנו לSupabase`);
  if (fail > 0) console.log(`  ⚠️  ${fail} שאלות נכשלו`);

  // ── Next steps ────────────────────────────────────────────────────────────

  console.log('\n🎯 שלבים הבאים למנהל:');
  console.log('  1. פתח לוח הניהול → "שאלות" → סנן לפי סטטוס: pending');
  console.log('  2. לכל שאלה: אשר ✓ / דחה ✗ / ערוך');
  console.log('  3. שייך שאלות לפרקים/מסלולים (topic_id, target_ids)');
  console.log('  4. הגדר גישה (free / premium)');
  console.log('  5. סמן smart_practice_eligible / general_practice_eligible\n');
}

main().catch(e => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
