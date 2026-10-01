export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function previousLocalDateKey(date = new Date()): string {
  const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  return localDateKey(previous);
}

// The server (quota, streaks, daily challenges) defines "today" in Israel time.
// Use these helpers wherever the client must agree with the server's day key.
const SERVER_TIME_ZONE = 'Asia/Jerusalem';
let serverDayFormatter: Intl.DateTimeFormat | null | undefined;

function getServerDayFormatter(): Intl.DateTimeFormat | null {
  if (serverDayFormatter !== undefined) return serverDayFormatter;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SERVER_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // Some engines (older Hermes builds) accept the options but ignore/mangle them.
    serverDayFormatter = /^\d{4}-\d{2}-\d{2}$/.test(formatter.format(new Date())) ? formatter : null;
  } catch {
    serverDayFormatter = null;
  }
  return serverDayFormatter;
}

export function serverDateKey(date = new Date()): string {
  const formatter = getServerDayFormatter();
  if (!formatter) return localDateKey(date);
  try {
    return formatter.format(date);
  } catch {
    return localDateKey(date);
  }
}

export function previousServerDateKey(date = new Date()): string {
  const [year, month, day] = serverDateKey(date).split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

export function serverDateKeyDaysAgo(daysAgo: number, date = new Date()): string {
  const [year, month, day] = serverDateKey(date).split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return target.toISOString().slice(0, 10);
}

/** Streak as the server would report it today: 0 unless practiced today or yesterday (server day). */
export function effectiveStreak(streak: number | null | undefined, lastPracticedDate: string | null | undefined): number {
  const value = Math.max(0, Number(streak) || 0);
  if (value === 0) return 0;
  const last = normalizeStoredDateKey(lastPracticedDate);
  if (!last) return 0;
  return last === serverDateKey() || last === previousServerDateKey() ? value : 0;
}

export function normalizeStoredDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return localDateKey(parsed);
}
