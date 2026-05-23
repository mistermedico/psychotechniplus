#!/usr/bin/env node
/**
 * generate-questions.mjs
 *
 * Generates Hebrew psychotechnic questions via Claude API and seeds them into:
 *   1. data/mockData.ts  (local fallback array)
 *   2. Supabase questions table (live DB)
 *
 * Usage:
 *   node scripts/generate-questions.mjs
 *   node scripts/generate-questions.mjs --topic topic_logic --count 30
 *   node scripts/generate-questions.mjs --dry-run
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://kdnkrvltgptiffxkclyg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkbmtydmx0Z3B0aWZmeGtjbHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyODcsImV4cCI6MjA5NDYxNDI4N30.FPfk0H5ln1gTkWgyt84atBJ3MgnSnWJR9Xi6ujYM6pM';

const MODEL = 'claude-sonnet-4-6';
const BATCH_SIZE = 15; // questions per Claude API call

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const argTopic   = args[args.indexOf('--topic')   + 1];
const argCount   = parseInt(args[args.indexOf('--count')   + 1]) || 50;
const DRY_RUN    = args.includes('--dry-run');

// ── Topic definitions ────────────────────────────────────────────────────────

const ALL_TOPICS = [
  {
    id: 'topic_quantitative',
    name: 'חשיבה כמותית',
    prefix: 'quant',
    targetIds: ['target_psychometric', 'target_ktzina', 'target_hightech'],
    questionType: 'multiple_choice',
    subtypes: [
      'אחוזים, יחסים ופרופורציות',
      'סדרות מספריות (חשבוניות, הנדסיות, פיבונאצ׳י, מורכבות)',
      'בעיות מהירות ומרחק',
      'בעיות עבודה ושיתוף פועלים',
      'בעיות ערבוב ותמיסות',
      'גיאומטריה (שטח, היקף, נפח של ריבוע, מלבן, עיגול, משולש)',
      'הסתברות בסיסית',
      'ממוצע, חציון ומספר הכי תכוף',
      'צירופים ותמורות',
      'אלגברה — משוואות ואי-שוויונות',
      'ריבית דריבית ושינויי אחוזים',
      'כוחות ושורשים',
    ],
    systemPrompt: `אתה מומחה בהכנה לבחינות פסיכוטכני ישראליות.
צור שאלות מתמטיות בעברית תקינה לנושא חשיבה כמותית.
כל שאלה חייבת:
• לכלול חישוב ממשי (לא שאלה עיונית בלבד)
• להיות ייחודית ולא להופיע בספרי הכנה נפוצים
• לכלול הסחות דעת סבירות (distractors) בתשובות השגויות
• ההסבר יראה את שלבי הפתרון בצורה פדגוגית`,
  },
  {
    id: 'topic_verbal',
    name: 'חשיבה מילולית',
    prefix: 'verbal',
    targetIds: ['target_psychometric', 'target_ktzina'],
    questionType: 'verbal',
    subtypes: [
      'אנלוגיות (יחס בין מילים)',
      'אנטונימים ומילים מנוגדות',
      'מילים נרדפות',
      'השלמת משפט (בחר המילה הנכונה)',
      'הבנת הנקרא — קטע קצר + שאלה',
      'מציאת המילה החריגה בסדרה',
      'פירוש ביטויים ומשלים עבריים',
    ],
    systemPrompt: `אתה מומחה לשפה עברית ולבחינות פסיכוטכני ישראליות.
צור שאלות חשיבה מילולית בעברית תקינה ועשירה.
כל שאלה חייבת:
• להשתמש במילים עבריות אמיתיות (לא ז׳רגון או שפת רחוב)
• לבדוק הבנת שפה אמיתית, לא ידע טריוויה
• להכיל הסחות דעת שנשמעות סבירות אך שגויות
• ההסבר יפרט מדוע כל תשובה שגויה נדחית`,
  },
  {
    id: 'topic_logic',
    name: 'חשיבה לוגית',
    prefix: 'logic',
    targetIds: ['target_psychometric', 'target_ktzina', 'target_modiin', 'target_hightech'],
    questionType: 'logic',
    subtypes: [
      'היקש קלאסי (כל A הם B, C הוא A, לכן...)',
      'היסק לוגי מתנאים (אם...אז)',
      'שאלות סדר ועמדות (מי גבוה יותר, מי בא לפני מי)',
      'מציאת האיבר החריג בסדרה',
      'אנלוגיות לוגיות (A לגבי B כמו C לגבי ?)',
      'שאלות כן/לא ומבחן אמת',
      'אי-הסקה תקפה (fallacy)',
      'שאלות קבוצות ויחסים (Venn)',
      'שאלות לוח (טבלאות רמזים)',
    ],
    systemPrompt: `אתה מומחה ללוגיקה ולבחינות פסיכוטכני ישראליות.
צור שאלות חשיבה לוגית בעברית.
כל שאלה חייבת:
• לבדוק חשיבה לוגית אמיתית, לא ידע כללי
• ההסחות להיראות אטרקטיביות לחושב שטחי
• ההסבר יפרט את שלבי ההיסק הלוגי`,
  },
  {
    id: 'topic_spatial',
    name: 'צורות ומרחב',
    prefix: 'spatial',
    targetIds: ['target_psychometric', 'target_tayyas', 'target_ktzina'],
    questionType: 'shapes',
    subtypes: [
      'קיפולי נייר וחורים (תאר בטקסט)',
      'ספירת קוביות ומבנים תלת-מימדיים',
      'שיקוף במראה (אופקית/אנכית)',
      'סדרות צורניות (דפוס חוזר של צורות)',
      'השלמת רשת (net) של גוף תלת-מימדי',
      'סיבוב צורות במרחב',
      'זיהוי צל של גוף תלת-מימדי',
      'תבניות קטועות — מה ייראה לאחר הרכבה',
    ],
    systemPrompt: `אתה מומחה לחשיבה מרחבית ולבחינות פסיכוטכני ישראליות (כולל קורס טיס).
צור שאלות מרחביות המתוארות בטקסט עברי ברור.
כל שאלה חייבת:
• לתאר בדיוק את הצורה/מבנה שעליו נשאלים
• לאפשר פתרון ללא ראיית ממשית — רק דרך תיאור טקסטואלי
• ההסבר יפרט את שלבי ההיסק המרחבי`,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function eloFromDifficulty(d) {
  if (d <= 2) return 900 + d * 75;
  if (d <= 4) return 1050 + (d - 2) * 100;
  if (d <= 6) return 1250 + (d - 4) * 65;
  if (d <= 8) return 1380 + (d - 6) * 60;
  return 1500 + (d - 8) * 50;
}

function parseIdNum(id, prefix) {
  const m = id.match(new RegExp(`q_${prefix}_(\\d+)$`));
  return m ? parseInt(m[1]) : 0;
}

function getMaxExistingIndex(mockDataContent, prefix) {
  const re = new RegExp(`id: 'q_${prefix}_(\\d+)'`, 'g');
  let max = 0;
  for (const m of mockDataContent.matchAll(re)) {
    const n = parseInt(m[1]);
    if (n > max) max = n;
  }
  return max;
}

function pad(n) { return String(n).padStart(3, '0'); }

function validateQuestion(q) {
  if (!q.questionText || typeof q.questionText !== 'string') return 'missing questionText';
  if (!Array.isArray(q.options) || q.options.length !== 4) return 'options must be array of 4';
  for (const opt of q.options) {
    if (!['a','b','c','d'].includes(opt.id)) return `invalid option id: ${opt.id}`;
    if (typeof opt.text !== 'string' || !opt.text) return `option ${opt.id} missing text`;
  }
  if (!['a','b','c','d'].includes(q.correctAnswer)) return `invalid correctAnswer: ${q.correctAnswer}`;
  const correctOpt = q.options.find(o => o.id === q.correctAnswer);
  if (!correctOpt) return `correctAnswer ${q.correctAnswer} not found in options`;
  if (!correctOpt.isCorrect) return `option ${q.correctAnswer} has isCorrect=false but is correctAnswer`;
  const correctCount = q.options.filter(o => o.isCorrect).length;
  if (correctCount !== 1) return `expected exactly 1 correct option, got ${correctCount}`;
  if (!q.explanation || typeof q.explanation !== 'string') return 'missing explanation';
  if (typeof q.difficulty !== 'number' || q.difficulty < 1 || q.difficulty > 9) return `invalid difficulty: ${q.difficulty}`;
  return null;
}

function questionToTs(q) {
  const opts = q.options.map(o =>
    `      { id: '${o.id}', text: '${escTs(o.text)}', isCorrect: ${o.isCorrect}${o.analysisTag ? `, analysisTag: '${escTs(o.analysisTag)}'` : ''} },`
  ).join('\n');
  const passage = q.readingPassage ? `\n    readingPassage: '${escTs(q.readingPassage)}',` : '';
  return `
  {
    id: '${q.id}',
    targetIds: ${JSON.stringify(q.targetIds)},
    topicId: '${q.topicId}',
    questionType: '${q.questionType}',
    questionText: '${escTs(q.questionText)}',${passage}
    options: [
${opts}
    ],
    correctAnswer: '${q.correctAnswer}',
    explanation: '${escTs(q.explanation)}',
    difficulty: ${q.difficulty},
    psychometricStats: { elo: ${q.psychometricStats.elo}, discrimination: ${q.psychometricStats.discrimination}, guessProbability: 0.25 },
    accessLevel: '${q.accessLevel}',
    validationStatus: 'validated',
    smartPracticeEligible: true,
    generalPracticeEligible: true,
  },`;
}

function escTs(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function questionToSupabaseRow(q) {
  return {
    id: q.id,
    target_ids: q.targetIds,
    topic_id: q.topicId,
    subtopic_id: null,
    question_type: q.questionType,
    question_text: q.questionText,
    reading_passage: q.readingPassage ?? null,
    media_url: null,
    media_type: null,
    options: q.options,
    correct_answer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    psychometric_stats: q.psychometricStats,
    access_level: q.accessLevel,
    validation_status: 'validated',
    smart_practice_eligible: true,
    general_practice_eligible: true,
  };
}

async function upsertToSupabase(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
}

// ── Question generation ───────────────────────────────────────────────────────

function buildPrompt(topic, count, previousTexts) {
  const prevSample = previousTexts.length > 0
    ? `\n\nשאלות שכבר נוצרו בסשן זה (אל תחזור עליהן):\n${previousTexts.slice(-20).map(t => `• ${t.slice(0, 80)}`).join('\n')}`
    : '';

  return `${topic.systemPrompt}

צור בדיוק ${count} שאלות בעברית לנושא "${topic.name}".
התמקד בתת-נושאים: ${topic.subtypes.join(', ')}.
חלוקת קושי רצויה: ~20% קל (1-3), ~50% בינוני (4-6), ~30% קשה (7-9).${prevSample}

החזר JSON array בלבד — ללא טקסט לפניו או אחריו. פורמט:
[
  {
    "questionText": "...",
    "readingPassage": null,
    "questionType": "${topic.questionType}",
    "options": [
      {"id": "a", "text": "...", "isCorrect": false, "analysisTag": "..."},
      {"id": "b", "text": "...", "isCorrect": true,  "analysisTag": "..."},
      {"id": "c", "text": "...", "isCorrect": false, "analysisTag": "..."},
      {"id": "d", "text": "...", "isCorrect": false, "analysisTag": "..."}
    ],
    "correctAnswer": "b",
    "explanation": "הסבר מפורט...",
    "difficulty": 4,
    "discrimination": 0.82
  }
]

כללים קריטיים:
- ה-correctAnswer חייב להתאים ל-id של האפשרות שבה isCorrect=true
- כל שאלה חייבת בדיוק אפשרות אחת נכונה
- readingPassage: השתמש רק לשאלות הבנת הנקרא, שאר הפעמים null
- ה-analysisTag יסביר בקצרה מה הטעות הנפוצה באפשרות זו`;
}

async function generateBatch(client, topic, count, previousTexts) {
  const prompt = buildPrompt(topic, count, previousTexts);

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0]?.text ?? '';

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\[[\s\S]*\])/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('  ✗ Failed to parse JSON from Claude response. Snippet:', jsonStr.slice(0, 200));
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error('  ✗ Response is not an array');
    return [];
  }

  return parsed;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 PsychoTechniPlus — Question Generator');
  console.log('=========================================');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is not set.');
    process.exit(1);
  }

  const client = new Anthropic();

  const topics = argTopic
    ? ALL_TOPICS.filter(t => t.id === argTopic)
    : ALL_TOPICS;

  if (topics.length === 0) {
    console.error(`❌ Unknown topic: ${argTopic}`);
    console.error('Available topics:', ALL_TOPICS.map(t => t.id).join(', '));
    process.exit(1);
  }

  // Read current mockData.ts
  const mockDataPath = join(ROOT, 'data/mockData.ts');
  let mockDataContent = readFileSync(mockDataPath, 'utf-8');

  const allNewQuestions = [];

  for (const topic of topics) {
    console.log(`\n📚 Topic: ${topic.name} (${topic.id})`);
    console.log(`   Target: ${argCount} questions in batches of ${BATCH_SIZE}`);

    let maxIdx = getMaxExistingIndex(mockDataContent, topic.prefix);
    console.log(`   Highest existing ID: q_${topic.prefix}_${pad(maxIdx)}`);

    const topicQuestions = [];
    const previousTexts = [];

    let remaining = argCount;
    while (remaining > 0) {
      const batchCount = Math.min(BATCH_SIZE, remaining);
      const batchNum = Math.ceil((argCount - remaining) / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(argCount / BATCH_SIZE);
      process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batchCount} questions)... `);

      const raw = await generateBatch(client, topic, batchCount, previousTexts);

      let added = 0;
      for (const rawQ of raw) {
        const err = validateQuestion(rawQ);
        if (err) {
          console.log(`\n     ⚠ Skipped (${err}): ${String(rawQ.questionText ?? '').slice(0, 60)}`);
          continue;
        }

        maxIdx++;
        const q = {
          id: `q_${topic.prefix}_${pad(maxIdx)}`,
          targetIds: topic.targetIds,
          topicId: topic.id,
          questionType: rawQ.questionType ?? topic.questionType,
          questionText: rawQ.questionText,
          readingPassage: rawQ.readingPassage ?? undefined,
          options: rawQ.options,
          correctAnswer: rawQ.correctAnswer,
          explanation: rawQ.explanation,
          difficulty: rawQ.difficulty,
          psychometricStats: {
            elo: eloFromDifficulty(rawQ.difficulty),
            discrimination: rawQ.discrimination ?? 0.8,
            guessProbability: 0.25,
          },
          accessLevel: rawQ.difficulty >= 8 ? 'premium' : 'free',
          validationStatus: 'validated',
          smartPracticeEligible: true,
          generalPracticeEligible: true,
        };

        topicQuestions.push(q);
        previousTexts.push(rawQ.questionText);
        added++;
      }

      console.log(`✓ ${added}/${raw.length} valid`);
      remaining -= batchCount;
    }

    console.log(`   ✅ Generated ${topicQuestions.length} questions for ${topic.name}`);
    allNewQuestions.push(...topicQuestions);

    // Update mockDataContent with new questions for this topic
    // (so next topic sees updated max IDs if prefix overlaps)
    if (!DRY_RUN && topicQuestions.length > 0) {
      const newTs = topicQuestions.map(questionToTs).join('');
      // Insert before the closing ]; of the QUESTIONS array
      mockDataContent = mockDataContent.replace(
        /(\n];[\s\n]*\/\/ ── Helpers)/,
        `${newTs}\n];$1`.replace('// ── Helpers', '// ── Helpers')
      );
      // Simpler replace: find "];\n\n// ── Helpers" or "];\n\n// ──"
      // Use a flexible approach:
    }
  }

  console.log(`\n📊 Total new questions: ${allNewQuestions.length}`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — sample of first 3 questions:');
    allNewQuestions.slice(0, 3).forEach((q, i) => {
      console.log(`\n[${i + 1}] ${q.id}`);
      console.log(`    Q: ${q.questionText.slice(0, 100)}`);
      console.log(`    ✓: ${q.options.find(o => o.id === q.correctAnswer)?.text}`);
      console.log(`    Diff: ${q.difficulty}, ELO: ${q.psychometricStats.elo}`);
    });
    return;
  }

  if (allNewQuestions.length === 0) {
    console.log('\n⚠ No valid questions generated. Exiting.');
    return;
  }

  // ── Write to mockData.ts ─────────────────────────────────────────────────

  console.log('\n📝 Updating data/mockData.ts...');
  try {
    // Rebuild mockDataContent with all new questions at once
    let updatedContent = readFileSync(mockDataPath, 'utf-8');
    const newTs = allNewQuestions.map(questionToTs).join('');

    // Find the closing ]; of the QUESTIONS array.
    // The array ends with the last question's }, followed by ];
    // Then comes the Helpers section comment.
    const closingPattern = /(\n\s*\}?,?\s*\n\];\s*\n\n\/\/ ── Helpers)/;
    if (closingPattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(
        closingPattern,
        `${newTs}\n];\n\n// ── Helpers`
      );
    } else {
      // Fallback: find ];\n and insert before last occurrence
      const lastBracket = updatedContent.lastIndexOf('];\n');
      if (lastBracket !== -1) {
        updatedContent =
          updatedContent.slice(0, lastBracket) +
          newTs + '\n' +
          updatedContent.slice(lastBracket);
      } else {
        console.error('  ✗ Could not find insertion point in mockData.ts');
      }
    }

    writeFileSync(mockDataPath, updatedContent, 'utf-8');
    console.log(`  ✓ Wrote ${allNewQuestions.length} questions to mockData.ts`);
  } catch (e) {
    console.error('  ✗ Failed to write mockData.ts:', e.message);
  }

  // ── Upsert to Supabase ───────────────────────────────────────────────────

  console.log('\n☁️  Upserting to Supabase...');
  const rows = allNewQuestions.map(questionToSupabaseRow);
  const SUPABASE_BATCH = 50;
  let supabaseOk = 0;
  let supabaseFail = 0;

  for (let i = 0; i < rows.length; i += SUPABASE_BATCH) {
    const batch = rows.slice(i, i + SUPABASE_BATCH);
    try {
      await upsertToSupabase(batch);
      supabaseOk += batch.length;
      process.stdout.write('.');
    } catch (e) {
      supabaseFail += batch.length;
      console.error(`\n  ✗ Batch ${i}-${i + batch.length} failed: ${e.message}`);
    }
  }

  console.log(`\n  ✓ Supabase: ${supabaseOk} upserted, ${supabaseFail} failed`);

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('\n🎉 Done!\n');
  console.log('Summary by topic:');
  for (const topic of topics) {
    const count = allNewQuestions.filter(q => q.topicId === topic.id).length;
    console.log(`  ${topic.name}: ${count} questions`);
  }
  console.log(`\n  Total: ${allNewQuestions.length} new questions added`);
  console.log('\n  Next steps:');
  console.log('  • Commit: git add data/mockData.ts && git commit -m "feat: add generated questions"');
  console.log('  • Reload app: npx expo start --clear\n');
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e.message);
  process.exit(1);
});
