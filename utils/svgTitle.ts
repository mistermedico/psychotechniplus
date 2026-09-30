/**
 * Returns the first <text> element of an SVG data URI — i.e. the question
 * title that is drawn inside the image — or null when there is none.
 */
export function getSvgTitle(uri?: string | null): string | null {
  if (!uri || !uri.startsWith('data:image/svg+xml')) return null;
  try {
    const payload = uri.slice(uri.indexOf(',') + 1);
    let svg: string;
    if (uri.includes(';base64,')) {
      const binary = typeof atob === 'function' ? atob(payload) : '';
      svg = decodeURIComponent(
        Array.from(binary, ch => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
      );
    } else {
      svg = decodeURIComponent(payload);
    }
    const match = svg.match(/<text[^>]*>([^<]{4,})<\/text>/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function normalize(text: string): string {
  return text.replace(/[\s"'׳״.,:;!?()–—_]+/g, '').toLowerCase();
}

/** True when the image draws a title that does not match the question text. */
export function imageTitleMismatch(questionText: string, mediaUrl?: string | null): string | null {
  const title = getSvgTitle(mediaUrl);
  if (!title) return null;
  const t = normalize(title);
  const q = normalize(questionText);
  return q.startsWith(t.slice(0, Math.min(t.length, 16))) ? null : title;
}

/** True when the image already shows the full question text (no need to print it twice). */
export function imageShowsQuestionText(questionText: string, mediaUrl?: string | null): boolean {
  const title = getSvgTitle(mediaUrl);
  return !!title && normalize(title) === normalize(questionText);
}
