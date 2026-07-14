const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs');

function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'supabase.ts'), 'utf8');
  const url = src.match(/SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY =\s*'([^']+)'/s)?.[1];
  if (!url || !key) throw new Error('Could not read Supabase config from lib/supabase.ts');
  return { url, key };
}

async function fetchAllQuestions(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('topic_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

(async () => {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const questions = await fetchAllQuestions(supabase);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'live-questions-export.json');
  fs.writeFileSync(outPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    total: questions.length,
    byTopic: questions.reduce((acc, q) => {
      acc[q.topic_id] = (acc[q.topic_id] ?? 0) + 1;
      return acc;
    }, {}),
    questions,
  }, null, 2), 'utf8');
  console.log(JSON.stringify({ outPath, total: questions.length }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
