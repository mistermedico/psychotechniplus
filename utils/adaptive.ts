import { Question } from '../data/types';

export type PerformanceLevel = 'beginner' | 'intermediate' | 'advanced';

export const LEVEL_LABELS: Record<PerformanceLevel, string> = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
};

export function difficultyToLevel(difficulty: number): PerformanceLevel {
  if (difficulty <= 4) return 'beginner';
  if (difficulty <= 7) return 'intermediate';
  return 'advanced';
}

export function levelToDifficultyRange(level: PerformanceLevel): [number, number] {
  if (level === 'beginner') return [1, 4];
  if (level === 'intermediate') return [3, 7];
  return [6, 10];
}

export function computeAdaptiveLevel(
  history: { isCorrect: boolean; difficulty: number }[],
  currentLevel: PerformanceLevel
): PerformanceLevel {
  const recent = history.slice(-8);
  if (recent.length < 4) return currentLevel;
  const accuracy = recent.filter(h => h.isCorrect).length / recent.length;
  if (accuracy >= 0.75 && currentLevel !== 'advanced') {
    return currentLevel === 'beginner' ? 'intermediate' : 'advanced';
  }
  if (accuracy <= 0.35 && currentLevel !== 'beginner') {
    return currentLevel === 'advanced' ? 'intermediate' : 'beginner';
  }
  return currentLevel;
}

export function selectAdaptiveQuestion(
  currentLevel: PerformanceLevel,
  questions: Question[],
  answeredIds: string[]
): Question | null {
  const unanswered = questions.filter(q => !answeredIds.includes(q.id));
  if (unanswered.length === 0) return null;

  const [minD, maxD] = levelToDifficultyRange(currentLevel);
  const optimal = unanswered.filter(q => q.difficulty >= minD && q.difficulty <= maxD);
  const pool = optimal.length > 0 ? optimal : unanswered;

  const midD = (minD + maxD) / 2;
  const weights = pool.map(q => Math.max(1, 10 - Math.abs(q.difficulty - midD) * 2));
  const total = weights.reduce((s, w) => s + w, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
