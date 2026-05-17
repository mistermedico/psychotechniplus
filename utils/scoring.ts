import { UserAnswer } from '../data/types';

export interface ScoreResult {
  rawScore: number;
  score: number;
  difficultyWeightedScore: number;
  speedAdjustedScore: number;
  stabilityScore: number;
  percentileRank: number;
}

export function calcRawScore(answers: UserAnswer[]): number {
  const correct = answers.filter(a => a.isCorrect && !a.isSkipped).length;
  const total = answers.filter(a => !a.isSkipped).length;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function calcDifficultyWeightedScore(answers: UserAnswer[]): number {
  const answered = answers.filter(a => !a.isSkipped);
  if (answered.length === 0) return 0;
  const weightedCorrect = answered.reduce(
    (s, a) => s + (a.isCorrect ? a.questionDifficulty : 0),
    0
  );
  const totalWeight = answered.reduce((s, a) => s + a.questionDifficulty, 0);
  return totalWeight === 0 ? 0 : Math.round((weightedCorrect / totalWeight) * 100);
}

export function calcSpeedAdjustedScore(
  answers: UserAnswer[],
  baseScore: number
): number {
  const answered = answers.filter(a => !a.isSkipped && a.isCorrect);
  if (answered.length === 0) return baseScore;

  // Bonus for answering hard questions quickly (< 20s)
  const speedBonuses = answered.map(a => {
    if (a.timeSpent < 10 && a.questionDifficulty >= 6) return 3;
    if (a.timeSpent < 20 && a.questionDifficulty >= 5) return 2;
    if (a.timeSpent < 30 && a.questionDifficulty >= 4) return 1;
    return 0;
  });
  const totalBonus = speedBonuses.reduce((s: number, b: number) => s + b, 0);
  return Math.min(100, baseScore + Math.round(totalBonus / answered.length));
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
  // Simulated normal distribution (mean=65, std=15)
  if (score >= 95) return 99;
  if (score >= 90) return 96;
  if (score >= 85) return 92;
  if (score >= 80) return 85;
  if (score >= 75) return 75;
  if (score >= 70) return 63;
  if (score >= 65) return 50;
  if (score >= 60) return 38;
  if (score >= 55) return 27;
  if (score >= 50) return 18;
  if (score >= 45) return 11;
  if (score >= 40) return 6;
  return 3;
}

export function calcAllScores(answers: UserAnswer[]): ScoreResult {
  const rawScore = calcRawScore(answers);
  const difficultyWeightedScore = calcDifficultyWeightedScore(answers);
  const speedAdjustedScore = calcSpeedAdjustedScore(answers, rawScore);
  const stabilityScore = calcStabilityScore(answers);
  const percentileRank = estimatePercentileRank(rawScore);
  return {
    rawScore,
    score: rawScore,
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
