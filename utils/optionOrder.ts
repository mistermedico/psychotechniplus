const ORDINAL_LABEL_RE = /^(אפשרות|צורה)\s*([A-Da-d1-4]|[אבגד]['׳]?)$/;

/**
 * True when every option is labelled only by its position ("צורה א׳", "אפשרות 2"...).
 * Such options must keep their stored order: shuffling them shows "א׳, ג׳, ב׳, ד׳",
 * and the explanation refers to the options by these labels. The correct answer's
 * position is already randomized when these questions are created.
 */
export function hasOrdinalOptionLabels(options: { text?: string | null }[]): boolean {
  return options.length > 0 && options.every(o => ORDINAL_LABEL_RE.test(String(o.text ?? '').trim()));
}

/** Shuffles the options unless they are position-labelled (see hasOrdinalOptionLabels). */
export function shuffleOptionsSafely<T extends { text?: string | null }>(options: T[], shuffle: (arr: T[]) => T[]): T[] {
  return hasOrdinalOptionLabels(options) ? options : shuffle(options);
}
