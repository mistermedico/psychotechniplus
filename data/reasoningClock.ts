export const challengeMinutes = { a: 20, b: 18, c: 16, expert: 14 } as const;
export type TimedFormId = keyof typeof challengeMinutes;
export function minutesForForm(id: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(challengeMinutes, id)
    ? challengeMinutes[id as TimedFormId] : undefined;
}
export function remainingMs(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}
export function timerText(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
