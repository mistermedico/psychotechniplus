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

const fixes = {
  q_logic_011: 'התשובה הנכונה היא "אי אפשר לדעת". מהנתונים מתקבל שריבה מבוגרת משמעון, שמעון מבוגר מטלי, ויולנד הצעיר מכולם. לגבי עוזי ידוע רק שהוא מבוגר מטלי, אך לא ידוע היחס שלו לריבה או לשמעון, ולכן אי אפשר לקבוע בוודאות מי השני בגיל.',
  q_logic_019: 'התשובה הנכונה היא "אי אפשר לדעת". ד מסיים ראשון, א חייב להיות לפני ב, וב חייב להיות מיד לפני ג. המתחרה ה אינו כפוף לאילוץ כלשהו, ולכן יש יותר מסדר אפשרי אחד: לפעמים ג אחרון ולפעמים ה אחרון.',
  q_logic_039: 'התשובה הנכונה היא "אי אפשר לדעת". מהנתונים מתקבל שריבה מבוגרת משמעון, שמעון מבוגר מטלי, ויולנד הצעיר מכולם. לגבי עוזי ידוע רק שהוא מבוגר מטלי, אך לא ידוע היחס שלו לריבה או לשמעון, ולכן אי אפשר לקבוע בוודאות מי השני בגיל.',
  q_logic_047: 'התשובה הנכונה היא "אי אפשר לדעת". ד מסיים ראשון, א חייב להיות לפני ב, וב חייב להיות מיד לפני ג. המתחרה ה אינו כפוף לאילוץ כלשהו, ולכן יש יותר מסדר אפשרי אחד: לפעמים ג אחרון ולפעמים ה אחרון.',
  q_exp_logic_deduction_117: 'התשובה הנכונה היא "אין מסקנה אפשרית". הנתונים אינם יוצרים קשר הכרחי שמאפשר להסיק אחת מהאפשרויות האחרות. במבחן לוגי בוחרים רק מסקנה שנובעת בוודאות מהנתונים, וכאן אין מסקנה כזו.',
  q_exp_logic_arrangement_235: 'התשובה הנכונה היא "כחול". אם אדום נמצא מימין לכחול, אז כחול נמצא משמאל לאדום. הנתון שירוק מימין לאדום רק מחזק את הסדר כחול, אדום, ירוק.',
  q_exp_logic_arrangement_238: 'התשובה הנכונה היא "ירוק". כחול מופיע לפני ירוק ואדום אחרי ירוק, לכן הסדר היחיד שמתאים הוא כחול, ירוק, אדום. הצבע שבאמצע הוא ירוק.',
  q_exp_quant_probability_194: 'התשובה הנכונה היא 3/5. בכיתה יש 12 בנים ו-18 בנות, כלומר 30 תלמידים בסך הכול. ההסתברות לבחור בת היא 18 מתוך 30, ולאחר צמצום מתקבל 3/5.',
  q_exp_quant_probability_198: 'התשובה הנכונה היא 1/2. בקופסה יש 4+4+8 = 16 פריטים בסך הכול, ומתוכם 8 ירוקים. לכן ההסתברות לשלוף ירוק היא 8/16, ולאחר צמצום 1/2.',
};

const algebra = {
  q_exp_quant_algebra_145: ['3x + 12 = 30', '3x = 18', 'x = 6'],
  q_exp_quant_algebra_146: ['5x - 7 = 38', '5x = 45', 'x = 9'],
  q_exp_quant_algebra_147: ['2x + 3x = 45', '5x = 45', 'x = 9'],
  q_exp_quant_algebra_148: ['4x - 16 = 2x + 8', '2x = 24', 'x = 12'],
  q_exp_quant_algebra_149: ['7x + 5 = 3x + 29', '4x = 24', 'x = 6'],
  q_exp_quant_algebra_150: ['9x - 18 = 6x + 12', '3x = 30', 'x = 10'],
  q_exp_quant_algebra_151: ['x/3 + 8 = 15', 'x/3 = 7', 'x = 21'],
  q_exp_quant_algebra_152: ['2(x+4)=30', 'x+4 = 15', 'x = 11'],
  q_exp_quant_algebra_153: ['5(x-2)=35', 'x-2 = 7', 'x = 9'],
  q_exp_quant_algebra_154: ['3x + 2 = x + 18', '2x = 16', 'x = 8'],
  q_exp_quant_algebra_155: ['10x - 4x = 54', '6x = 54', 'x = 9'],
  q_exp_quant_algebra_156: ['4(x+3)=2x+30', '4x+12 = 2x+30, ולכן 2x = 18', 'x = 9'],
};

for (const [id, steps] of Object.entries(algebra)) {
  fixes[id] = `התשובה הנכונה היא ${steps[2].replace('x = ', '')}. פותרים את המשוואה בשלבים: ${steps[0]}; לאחר העברת אגפים מקבלים ${steps[1]}; ולכן ${steps[2]}.`;
}

const divisibility = {
  q_exp_quant_divisibility_199: ['84', '12', '7'],
  q_exp_quant_divisibility_200: ['96', '16', '6'],
  q_exp_quant_divisibility_201: ['125', '25', '5'],
  q_exp_quant_divisibility_202: ['144', '18', '8'],
  q_exp_quant_divisibility_203: ['168', '24', '7'],
  q_exp_quant_divisibility_204: ['210', '30', '7'],
  q_exp_quant_divisibility_206: ['256', '32', '8'],
  q_exp_quant_divisibility_207: ['315', '45', '7'],
  q_exp_quant_divisibility_208: ['360', '40', '9'],
};

for (const [id, [number, divisor, quotient]] of Object.entries(divisibility)) {
  fixes[id] = `התשובה הנכונה היא ${divisor}. בודקים חלוקה ללא שארית: ${divisor} × ${quotient} = ${number}, ולכן ${number} מתחלק ב-${divisor} בדיוק.`;
}

async function main() {
  const { url, key } = readSupabaseConfig();
  const supabase = createClient(url, key);
  const applied = [];

  for (const [id, explanation] of Object.entries(fixes)) {
    const { error } = await supabase
      .from('questions')
      .update({ explanation })
      .eq('id', id);
    if (error) throw error;
    applied.push({ id, explanation });
  }

  const report = {
    fixedAt: new Date().toISOString(),
    fixesCount: applied.length,
    applied,
  };
  fs.writeFileSync('outputs/fix-remaining-live-question-explanations.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
