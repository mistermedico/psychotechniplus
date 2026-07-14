import { UserAnswer } from '../data/types';

export interface ScoreResult {
  rawScore: number;
  score: number;
  difficultyWeightedScore: number;
  speedAdjustedScore: number;
  stabilityScore: number;
  percentileRank: number;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeDifficulty(value: number): number {
  return Math.max(1, Math.min(10, Number.isFinite(value) ? value : 5));
}

export function calcRawScore(answers: UserAnswer[]): number {
  const correct = answers.filter(a => a.isCorrect && !a.isSkipped).length;
  const total = answers.length;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function calcDifficultyWeightedScore(answers: UserAnswer[]): number {
  if (answers.length === 0) return 0;
  const weightedCorrect = answers.reduce(
    (s, a) => s + (a.isCorrect && !a.isSkipped ? safeDifficulty(a.questionDifficulty) : 0),
    0
  );
  const totalWeight = answers.reduce((s, a) => s + safeDifficulty(a.questionDifficulty), 0);
  return totalWeight === 0 ? 0 : Math.round((weightedCorrect / totalWeight) * 100);
}

export function calcSpeedAdjustedScore(
  answers: UserAnswer[],
  baseScore: number
): number {
  const answered = answers.filter(a => !a.isSkipped);
  if (answered.length === 0) return baseScore;

  const speedDeltas = answered.map(a => {
    const difficulty = safeDifficulty(a.questionDifficulty);
    const expectedSeconds = 18 + difficulty * 5;
    if (!a.isCorrect) {
      return a.timeSpent > expectedSeconds * 1.7 ? -2 : 0;
    }
    if (a.timeSpent <= expectedSeconds * 0.55 && difficulty >= 6) return 4;
    if (a.timeSpent <= expectedSeconds * 0.75) return 2;
    if (a.timeSpent <= expectedSeconds * 1.15) return 0;
    return -1;
  });
  const averageDelta = speedDeltas.reduce((s: number, b: number) => s + b, 0) / answered.length;
  return clampScore(baseScore + averageDelta);
}

export function calcStabilityScore(answers: UserAnswer[]): number {
  if (answers.length < 3) return 100;
  // Sliding window of 3: measure variance in correctness
  const windows: number[] = [];
  for (let i = 0; i <= answers.length - 3; i++) {
    const window = answers.slice(i, i + 3);
    const correctRatio = window.filter(a => a.isCorrect).length / 3;
    windows.push(correctRatio);
  }
  const mean = windows.reduce((s, v) => s + v, 0) / windows.length;
  const variance =
    windows.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / windows.length;
  const stdDev = Math.sqrt(variance);
  return Math.max(0, Math.round((1 - stdDev) * 100));
}

export function estimatePercentileRank(score: number): number {
  const z = (score - 64) / 14;
  return Math.round(Math.min(99, Math.max(1, 50 + 49 * Math.tanh(z * 0.72))));
}

export function calcPsychotechnicScore(answers: UserAnswer[]): number {
  if (answers.length === 0) return 0;
  const rawScore = calcRawScore(answers);
  const difficultyWeightedScore = calcDifficultyWeightedScore(answers);
  const speedAdjustedScore = calcSpeedAdjustedScore(answers, difficultyWeightedScore);
  const stabilityScore = calcStabilityScore(answers);
  const skippedRate = answers.filter(a => a.isSkipped).length / answers.length;

  const composite =
    rawScore * 0.42 +
    difficultyWeightedScore * 0.38 +
    speedAdjustedScore * 0.12 +
    stabilityScore * 0.08 -
    skippedRate * 8;

  return clampScore(composite);
}

export function calcAllScores(answers: UserAnswer[]): ScoreResult {
  const rawScore = calcRawScore(answers);
  const difficultyWeightedScore = calcDifficultyWeightedScore(answers);
  const speedAdjustedScore = calcSpeedAdjustedScore(answers, difficultyWeightedScore);
  const stabilityScore = calcStabilityScore(answers);
  const score = calcPsychotechnicScore(answers);
  const percentileRank = estimatePercentileRank(score);
  return {
    rawScore,
    score,
    difficultyWeightedScore,
    speedAdjustedScore,
    stabilityScore,
    percentileRank,
  };
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}ש'`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}ד'` : `${m}ד' ${s}ש'`;
}

export function getPerformanceLevel(score: number) {
  if (score >= 85) return { level: 'very_high', label: 'מצוין', color: '#10B981' };
  if (score >= 70) return { level: 'high', label: 'טוב מאוד', color: '#4F46E5' };
  if (score >= 55) return { level: 'medium', label: 'בינוני', color: '#F59E0B' };
  return { level: 'low', label: 'דורש שיפור', color: '#EF4444' };
}
