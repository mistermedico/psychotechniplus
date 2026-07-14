const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config');
  return { url, key };
}

async function main() {
  const report = JSON.parse(fs.readFileSync('outputs/live-question-quality-cleanup-report.json', 'utf8'));
  const ids = report.changes
    .filter(change => change.topic === 'topic_spatial')
    .filter(change => change.reasons.includes('duplicate_validated_question'))
    .map(change => change.id);

  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const restored = [];

  for (const id of ids) {
    const { error } = await supabase
      .from('questions')
      .update({
        validation_status: 'validated',
        smart_practice_eligible: true,
        general_practice_eligible: true,
      })
      .eq('id', id);
    if (error) throw error;
    restored.push(id);
  }

  const restoreReport = {
    restoredAt: new Date().toISOString(),
    restoredCount: restored.length,
    reason: 'Spatial questions can share generic text while having different image assets; text-only duplicate cleanup should not disable them.',
    restored,
  };
  fs.writeFileSync('outputs/restored-spatial-text-duplicate-cleanup.json', JSON.stringify(restoreReport, null, 2), 'utf8');
  console.log(JSON.stringify(restoreReport, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
