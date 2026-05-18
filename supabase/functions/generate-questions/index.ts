import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = 'claude-opus-4-7';

interface GenerateRequest {
  topicId: string;
  topicName: string;
  questionType: string;
  difficulty: number;
  count: number;
  customPrompt?: string;
  readingPassage?: string;  // for reading_comprehension type
  language: 'he';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  const body: GenerateRequest = await req.json();

  const typeInstructions: Record<string, string> = {
    multiple_choice: 'שאלת בחירה מרובה קלאסית. 4 אפשרויות, תשובה אחת נכונה.',
    verbal: 'שאלת מילולית: אנלוגיות, הפכים, השלמת משפט, או זיהוי מילה.',
    logic: 'שאלת היגיון: סדרות, סילוגיזמים, חידות, אריתמטיקה מילולית.',
    quantitative: 'שאלה כמותית: חשבון, אלגברה, הנדסה, הסתברות.',
    shapes: 'שאלת מרחב/צורות: סימטריה, גיאומטריה, תמונות שנסברות מתוך תיאור.',
    reading_comprehension: 'שאלת הבנת הנקרא מתוך הקטע שסופק.',
    true_false: 'שאלת נכון/לא נכון עם הסבר מלא.',
    fill_in_the_blank: 'משפט עם מקום חסר — יש למלא את המילה הנכונה מבין 4 אפשרויות.',
  };

  const systemPrompt = `אתה מחולל שאלות מקצועי לבחינות פסיכוטכניות בישראל (פסיכומטרי, קצינים, טייסים, וכו').
צור שאלות בעברית ברמה גבוהה, מדויקות, עם הסבר מלא.
החזר JSON בלבד — מערך של אובייקטי שאלה. אין להוסיף טקסט נוסף.`;

  const userPrompt = `צור ${body.count} שאלות מסוג "${body.questionType}" בנושא "${body.topicName}" ברמת קושי ${body.difficulty}/10.
${body.readingPassage ? `קטע קריאה:\n${body.readingPassage}\n` : ''}
${body.customPrompt ? `הנחיות נוספות: ${body.customPrompt}` : ''}
סוג שאלה: ${typeInstructions[body.questionType] ?? typeInstructions.multiple_choice}

החזר JSON במבנה הבא בדיוק:
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
    "explanation": "הסבר מפורט ומחנך...",
    "difficulty": ${body.difficulty},
    "questionType": "${body.questionType}"
  }
]
${body.questionType === 'true_false' ? 'לשאלות נכון/לא נכון: 2 אפשרויות בלבד: { id: "a", text: "נכון" } ו { id: "b", text: "לא נכון" }' : ''}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '[]';

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  const questions = match ? JSON.parse(match[0]) : [];

  return new Response(JSON.stringify({ questions }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
