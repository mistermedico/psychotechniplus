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
  answeredIds: string[],
  history: { isCorrect: boolean; difficulty: number }[] = []
): Question | null {
  const unanswered = questions.filter(q => !answeredIds.includes(q.id));
  if (unanswered.length === 0) return null;

  const [minD, maxD] = levelToDifficultyRange(currentLevel);
  const last = history[history.length - 1];

  let targetDifficulty = Math.round((minD + maxD) / 2);
  let directionalPool = unanswered;

  if (last) {
    const lastDifficulty = Math.max(1, Math.min(10, Math.round(last.difficulty)));
    targetDifficulty = Math.max(1, Math.min(10, lastDifficulty + (last.isCorrect ? 1 : -1)));

    // A wrong answer must not make the next question harder when an equal/easier
    // question is available; likewise a correct answer should not move backward.
    const directional = last.isCorrect
      ? unanswered.filter(q => q.difficulty >= lastDifficulty)
      : unanswered.filter(q => q.difficulty <= lastDifficulty);
    if (directional.length > 0) directionalPool = directional;
  } else {
    const inBand = unanswered.filter(q => q.difficulty >= minD && q.difficulty <= maxD);
    if (inBand.length > 0) directionalPool = inBand;
  }

  const minDistance = Math.min(...directionalPool.map(q => Math.abs(q.difficulty - targetDifficulty)));
  const closest = directionalPool.filter(q => Math.abs(q.difficulty - targetDifficulty) === minDistance);

  return closest[Math.floor(Math.random() * closest.length)] ?? directionalPool[0] ?? null;
}
