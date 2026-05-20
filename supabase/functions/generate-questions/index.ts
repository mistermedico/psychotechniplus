import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.30.1';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  shapes: 'שאלת מרחב/צורות: סימטריה, גיאומטריה, קורות מרחביות.',
  reading_comprehension: 'שאלת הבנת הנקרא מתוך הקטע שסופק.',
  true_false: 'שאלת נכון/לא נכון עם הסבר מלא. 2 אפשרויות בלבד.',
  fill_in_the_blank: 'משפט עם מקום חסר — יש למלא את המילה הנכונה מבין 4 אפשרויות.',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { topicName, questionType, difficulty, count, customPrompt, readingPassage } = body;

  const typeInstruction = TYPE_INSTRUCTIONS[questionType] ?? TYPE_INSTRUCTIONS.multiple_choice;
  const isTrueFalse = questionType === 'true_false';

  const systemPrompt = `אתה מחולל שאלות מקצועי לבחינות פסיכוטכניות בישראל (פסיכומטרי, קצינים, טייסים, וכו').
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

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Robust JSON extraction: find outermost [...] array
    let questions: unknown[] = [];
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        questions = JSON.parse(match[0]);
      } catch {
        // Try extracting individual objects if array parse fails
        const objMatches = rawText.match(/\{[\s\S]*?\}(?=\s*[,\]])/g);
        if (objMatches) {
          questions = objMatches.flatMap(s => {
            try { return [JSON.parse(s)]; } catch { return []; }
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message, questions: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
