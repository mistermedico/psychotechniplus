const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(appRoot, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const ids = [
    'q_pro_spatial_695a9749d49d2d3053a8ff57',
    'q_pro_spatial_6a11c9fc93715db00eff706a',
  ];
  const { data, error } = await supabase
    .from('questions')
    .select('id, explanation, options')
    .in('id', ids);
  if (error) throw error;

  const changes = [];
  for (const question of data ?? []) {
    const correct = (question.options ?? []).find((option) => option?.isCorrect === true);
    const label = normalizeText(correct?.text || correct?.id);
    let explanation = normalizeText(question.explanation).replace(/\s*\?{3,}.*$/g, '');
    if (label && !explanation.includes(label)) {
      explanation = `${explanation} לכן נוסח התשובה הנכונה הוא: ${label}.`;
    }
    const { error: updateError } = await supabase
      .from('questions')
      .update({ explanation })
      .eq('id', question.id);
    if (updateError) throw updateError;
    changes.push({ id: question.id, label, explanationLength: explanation.length });
  }

  console.log(JSON.stringify({ updated: changes.length, changes }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
