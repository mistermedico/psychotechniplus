import { Question } from '../data/types';

const K_FACTOR = 32;
export const DEFAULT_ELO = 1200;

export function expectedScore(playerElo: number, questionElo: number): number {
  return 1 / (1 + Math.pow(10, (questionElo - playerElo) / 400));
}

export function updatePlayerElo(
  currentElo: number,
  questionElo: number,
  isCorrect: boolean
): number {
  const expected = expectedScore(currentElo, questionElo);
  const actual = isCorrect ? 1 : 0;
  return Math.round(currentElo + K_FACTOR * (actual - expected));
}

export function updateQuestionElo(
  currentElo: number,
  playerElo: number,
  isCorrect: boolean
): number {
  const expected = expectedScore(currentElo, playerElo);
  const actual = isCorrect ? 1 : 0;
  return Math.round(currentElo + K_FACTOR * (actual - expected));
}

// Selects next question from optimal learning zone (user ELO ± 150)
export function selectAdaptiveQuestion(
  userElo: number,
  questions: Question[],
  answeredIds: string[]
): Question | null {
  const unanswered = questions.filter(q => !answeredIds.includes(q.id));
  if (unanswered.length === 0) return null;

  const optimal = unanswered.filter(
    q => Math.abs(q.psychometricStats.elo - userElo) <= 150
  );
  const pool = optimal.length > 0 ? optimal : unanswered;

  // Weighted random: prefer questions closer to user ELO
  const weights = pool.map(q => {
    const diff = Math.abs(q.psychometricStats.elo - userElo);
    return Math.max(1, 200 - diff);
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function eloToLevel(elo: number): number {
  if (elo < 1000) return 1;
  if (elo < 1100) return 2;
  if (elo < 1200) return 3;
  if (elo < 1300) return 4;
  if (elo < 1400) return 5;
  if (elo < 1500) return 6;
  if (elo < 1600) return 7;
  if (elo < 1750) return 8;
  if (elo < 1900) return 9;
  return 10;
}

export function eloToTitle(elo: number): string {
  const level = eloToLevel(elo);
  const titles = ['', 'מתחיל', 'מתחיל+', 'בינוני', 'בינוני+', 'מתקדם', 'מתקדם+', 'מומחה', 'מומחה+', 'אליל', 'גרנד-מאסטר'];
  return titles[level];
}

export function eloToProgress(elo: number): number {
  const thresholds = [0, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1750, 1900, 2100];
  const level = eloToLevel(elo);
  if (level >= 10) return 1;
  const low = thresholds[level];
  const high = thresholds[level + 1];
  if (high === low) return 0;
  return Math.max(0, Math.min(1, (elo - low) / (high - low)));
}
