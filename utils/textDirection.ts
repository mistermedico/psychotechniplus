// Hebrew Unicode block: U+0590–U+05FF
const HEBREW_RE = /[֐-׿]/g;
const LATIN_RE = /[a-zA-Z]/g;

export function detectDir(text: string): 'rtl' | 'ltr' {
  if (!text) return 'rtl';
  const hebrew = (text.match(HEBREW_RE) ?? []).length;
  const latin = (text.match(LATIN_RE) ?? []).length;
  return hebrew >= latin ? 'rtl' : 'ltr';
}

export function textAlign(text: string): 'right' | 'left' {
  return detectDir(text) === 'rtl' ? 'right' : 'left';
}
