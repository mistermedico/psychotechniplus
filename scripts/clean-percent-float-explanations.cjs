const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

function cleanNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return String(Math.round(n * 100) / 100);
}

(async () => {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('questions')
    .select('id, explanation')
    .ilike('explanation', '%999999%');
  if (error) throw error;

  const results = [];
  for (const row of data ?? []) {
    const explanation = String(row.explanation ?? '').replace(/\d+\.\d{6,}/g, cleanNumber);
    const { error: updateError } = await supabase
      .from('questions')
      .update({ explanation })
      .eq('id', row.id);
    results.push({ id: row.id, ok: !updateError, error: updateError?.message, explanation });
    if (updateError) throw updateError;
  }
  console.log(JSON.stringify({ cleaned: results.length, results }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
