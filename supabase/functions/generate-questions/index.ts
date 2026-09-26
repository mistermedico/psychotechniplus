import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.30.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const ADMIN_EMAIL = 'mrmedico111@gmail.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GenerateRequest {
  topicId: string;
  topicName: string;
  questionType: string;
  difficulty: number;
  count: number;
  customPrompt?: string;
  readingPassage?: string;
  language: 'he';
  mode?: 'varied' | 'uniform';
}

const TYPE_INSTRUCTIONS: Record<string, string> = {
  multiple_choice: 'שאלת בחירה מרובה קלאסית. 4 אפשרויות, תשובה אחת נכונה.',
  verbal: 'שאלת מילולית: אנלוגיות, הפכים, השלמת משפט, או זיהוי מילה.',
  logic: 'שאלת היגיון: סדרות, סילוגיזמים, חידות, אריתמטיקה מילולית.',
  quantitative: 'שאלה כמותית: חשבון, אלגברה, הנדסה, הסתברות.',
  shapes: 'שאלת מרחב/צורות: סימטריה, גיאומטריה ותפיסה מרחבית.',
  reading_comprehension: 'שאלת הבנת הנקרא מתוך הקטע שסופק.',
  true_false: 'שאלת נכון/לא נכון עם הסבר מלא. 2 אפשרויות בלבד.',
  fill_in_the_blank: 'משפט עם מקום חסר — יש למלא את המילה הנכונה מבין 4 אפשרויות.',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: 'Admin privileges required' }, 403);
  }

  const body = await req.json().catch(() => null) as GenerateRequest | null;
  if (!body) return json({ error: 'Invalid JSON body' }, 400);

  const topicName = String(body.topicName ?? '').trim().slice(0, 120);
  const questionType = String(body.questionType ?? '').trim();
  const difficulty = Math.max(1, Math.min(10, Math.round(Number(body.difficulty) || 0)));
  const count = Math.max(1, Math.min(30, Math.round(Number(body.count) || 0)));
  const customPrompt = String(body.customPrompt ?? '').trim().slice(0, 3000);
  const readingPassage = String(body.readingPassage ?? '').trim().slice(0, 12000);

  if (!topicName || !TYPE_INSTRUCTIONS[questionType]) {
    return json({ error: 'Invalid topic or question type' }, 400);
  }

  const typeInstruction = TYPE_INSTRUCTIONS[questionType];
  const isTrueFalse = questionType === 'true_false';
  const systemPrompt = `אתה מחולל שאלות מקצועי לבחינות פסיכוטכניות בישראל.
צור שאלות בעברית ברמה גבוהה, מדויקות, עם הסבר מלא.
החזר JSON בלבד — מערך של אובייקטי שאלה, ללא טקסט נוסף לפני או אחרי.`;

  const userPrompt = `צור ${count} שאלות מסוג "${questionType}" בנושא "${topicName}" ברמת קושי ${difficulty}/10.
${readingPassage ? `קטע קריאה:\n${readingPassage}\n` : ''}
${customPrompt ? `הנחיות נוספות: ${customPrompt}` : ''}
סוג שאלה: ${typeInstruction}
${isTrueFalse ? '\nלשאלות נכון/לא נכון: 2 אפשרויות בלבד.' : ''}

החזר JSON במבנה הבא בדיוק (מערך, ללא עטיפה):
[
  {
    "questionText": "...",
    "options": [
      { "id": "a", "text": "...", "isCorrect": false },
      { "id": "b", "text": "...", "isCorrect": true },
      { "id": "c", "text": "...", "isCorrect": false },
      { "id": "d", "text": "...", "isCorrect": false }
    ],
    "correctAnswer": "b",
    "explanation": "הסבר מפורט...",
    "difficulty": ${difficulty},
    "questionType": "${questionType}"
  }
]`;

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) return json({ error: 'Model returned no JSON array', questions: [] }, 502);

    let questions: unknown[];
    try {
      questions = JSON.parse(match[0]);
    } catch {
      return json({ error: 'Model returned invalid JSON', questions: [] }, 502);
    }

    if (!Array.isArray(questions)) return json({ error: 'Invalid model response', questions: [] }, 502);
    return json({ questions: questions.slice(0, count) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message, questions: [] }, 500);
  }
});
