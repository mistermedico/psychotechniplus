const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const outputPath = 'C:\\Users\\nitai\\Documents\\Codex\\2026-06-27\\new-chat\\outputs\\question-hebrew-grammar-fixes.json';

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(appRoot, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

const replacements = [
  ['איזה מהאפשרויות מייצגת', 'איזו מהאפשרויות מייצגת'],
  ['איזה מהאפשרויות', 'איזו מהאפשרויות'],
  ['איזה אפשרות', 'איזו אפשרות'],
  ['אחד מהאפשרויות', 'אחת מהאפשרויות'],
  ['מה הצורה חסרה', 'מה הצורה החסרה'],
  ['הריבוע הכחול בכל תא זזה', 'הריבוע הכחול בכל תא זז'],
  ['איזה קובייה', 'איזו קובייה'],
  ['איזה צורה', 'איזו צורה'],
  ['איזה מהצורות', 'איזו מהצורות'],
  ['בכל תא זזה', 'בכל תא זז'],
  ['מה מהי הצורה החסרה?', 'מהי הצורה החסרה?'],
];

function applyReplacements(value) {
  let next = String(value ?? '');
  for (const [bad, good] of replacements) {
    next = next.split(bad).join(good);
  }
  return next;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function fetchAllQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text, explanation, options')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  const changes = [];

  for (const question of questions) {
    const nextQuestionText = applyReplacements(question.question_text);
    const nextExplanation = applyReplacements(question.explanation);
    const nextOptions = Array.isArray(question.options)
      ? question.options.map((option) => ({
          ...option,
          text: applyReplacements(option?.text),
        }))
      : question.options;

    const changed =
      nextQuestionText !== question.question_text ||
      nextExplanation !== question.explanation ||
      JSON.stringify(nextOptions) !== JSON.stringify(question.options);

    if (!changed) continue;

    const update = {
      question_text: nextQuestionText,
      explanation: nextExplanation,
      options: nextOptions,
    };
    const { error } = await supabase.from('questions').update(update).eq('id', question.id);
    if (error) throw error;

    changes.push({
      id: question.id,
      oldQuestionText: normalizeText(question.question_text),
      newQuestionText: normalizeText(nextQuestionText),
      changedExplanation: nextExplanation !== question.explanation,
      changedOptions: JSON.stringify(nextOptions) !== JSON.stringify(question.options),
    });
  }

  const report = {
    fixedAt: new Date().toISOString(),
    scanned: questions.length,
    updated: changes.length,
    replacements: replacements.map(([bad, good]) => ({ bad, good })),
    changes,
  };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
