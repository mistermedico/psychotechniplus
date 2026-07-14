import { Question } from '../data/types';
import { SmartExamTemplate, SmartRule } from '../store/adminStore';
import { isPsychotechnicQuestionReady } from './questionQuality';
import { estimatePercentileRank } from './scoring';

export interface GeneratedExamSection {
  ruleId: string;
  ruleName: string;
  topicId: string;
  questions: Question[];
  timeLimitSeconds: number;
  useAdaptive: boolean;
}

export interface GeneratedExam {
  sections: GeneratedExamSection[];
  allQuestions: Question[];
  totalQuestions: number;
  estimatedMinutes: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function eloDistance(qElo: number, userElo: number): number {
  return Math.abs(qElo - userElo);
}

function selectByElo(
  pool: Question[],
  userElo: number,
  count: number,
  minDiff: number,
  maxDiff: number
): Question[] {
  const filtered = pool.filter(
    q => q.difficulty >= minDiff && q.difficulty <= maxDiff
  );
  if (filtered.length === 0) return pool.slice(0, count);

  // Sort by ELO closeness to user level, with slight randomization
  const scored = filtered.map(q => ({
    q,
    score: eloDistance(q.psychometricStats.elo, userElo) + Math.random() * 80,
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map(s => s.q);
}

function selectRandom(
  pool: Question[],
  count: number,
  minDiff: number,
  maxDiff: number
): Question[] {
  const filtered = pool.filter(
    q => q.difficulty >= minDiff && q.difficulty <= maxDiff
  );
  const source = filtered.length >= count ? filtered : pool;
  return shuffle(source).slice(0, count);
}

function safeCount(value: number): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function safeDifficultyRange(min?: number, max?: number): { min: number; max: number } {
  const safeMin = Math.max(1, Math.min(10, Number(min) || 1));
  const safeMax = Math.max(1, Math.min(10, Number(max) || 10));
  return safeMin <= safeMax ? { min: safeMin, max: safeMax } : { min: safeMax, max: safeMin };
}

function isUsableQuestion(q: Question): boolean {
  return q.validationStatus === 'validated' && isPsychotechnicQuestionReady(q);
}

export function generateSmartExamQuestions(
  template: SmartExamTemplate,
  allQuestions: Question[],
  userTopicElos: Record<string, number>,
  answeredQuestionIds: Set<string> = new Set()
): GeneratedExam {
  const usedIds = new Set<string>(answeredQuestionIds);
  const sections: GeneratedExamSection[] = [];

  const rules: SmartRule[] = template.smartRules && template.smartRules.length > 0
    ? template.smartRules
    : template.rules.map(r => ({
        id: r.id,
        name: '',
        topicId: r.topicId,
        count: r.count,
        minDifficulty: r.minDifficulty,
        maxDifficulty: r.maxDifficulty,
        useAdaptiveAlgorithm: r.useAdaptive,
        subRules: [],
        conditions: [],
        fallback: { type: 'nextRule' as const },
      }));

  // Build exclude set from excludeRules
  const excludedIds = new Set<string>();
  if (template.excludeRules) {
    for (const ex of template.excludeRules) {
      if (ex.type === 'difficulty') {
        allQuestions.forEach(q => {
          if (q.difficulty >= ex.minDifficulty && q.difficulty <= ex.maxDifficulty) {
            excludedIds.add(q.id);
          }
        });
      }
      if (ex.type === 'questionIds' && ex.ids) {
        ex.ids.forEach(id => excludedIds.add(id));
      }
    }
  }

  for (const rule of rules) {
    const topicId = rule.topicId;
    const userElo = userTopicElos[topicId] ?? 1200;
    const requestedCount = safeCount(rule.count);
    const { min: minDifficulty, max: maxDifficulty } = safeDifficultyRange(rule.minDifficulty, rule.maxDifficulty);

    if (requestedCount === 0) continue;

    // Base pool: correct topic, validated, not used, not excluded
    let pool = allQuestions.filter(q =>
      q.topicId === topicId &&
      isUsableQuestion(q) &&
      !usedIds.has(q.id) &&
      !excludedIds.has(q.id)
    );

    // If pool is too small, keep the no-duplicate rule and use the available pool.
    if (pool.length < requestedCount) {
      pool = allQuestions.filter(q =>
        q.topicId === topicId &&
        isUsableQuestion(q) &&
        !usedIds.has(q.id) &&
        !excludedIds.has(q.id)
      );
    }
    // Still empty: use only quality-checked validated questions for this topic.
    if (pool.length === 0) {
      pool = allQuestions.filter(q =>
        q.topicId === topicId &&
        isUsableQuestion(q)
      );
    }

    let selected: Question[] = [];

    if (rule.subRules && rule.subRules.length > 0) {
      // Select per sub-rule (subcategory)
      let remaining = requestedCount;
      for (const sub of rule.subRules) {
        const subPool = pool.filter(
          q => !usedIds.has(q.id) && ((q as any).subcategory === sub.value || !sub.value)
        );
        const subCount = Math.min(safeCount(sub.count), remaining, subPool.length || pool.length);
        const subSelected = rule.useAdaptiveAlgorithm
          ? selectByElo(subPool.length > 0 ? subPool : pool.filter(q => !usedIds.has(q.id)), userElo, subCount, minDifficulty, maxDifficulty)
          : selectRandom(subPool.length > 0 ? subPool : pool.filter(q => !usedIds.has(q.id)), subCount, minDifficulty, maxDifficulty);
        selected.push(...subSelected);
        subSelected.forEach(q => usedIds.add(q.id));
        remaining -= subSelected.length;
      }
      // Fill remaining if subRules don't add up
      if (remaining > 0) {
        const fillPool = pool.filter(q => !usedIds.has(q.id));
        const fill = rule.useAdaptiveAlgorithm
          ? selectByElo(fillPool, userElo, remaining, minDifficulty, maxDifficulty)
          : selectRandom(fillPool, remaining, minDifficulty, maxDifficulty);
        selected.push(...fill);
        fill.forEach(q => usedIds.add(q.id));
      }
    } else {
      selected = rule.useAdaptiveAlgorithm
        ? selectByElo(pool, userElo, requestedCount, minDifficulty, maxDifficulty)
        : selectRandom(pool, requestedCount, minDifficulty, maxDifficulty);
      selected.forEach(q => usedIds.add(q.id));
    }

    if (selected.length < requestedCount && rule.fallback?.type === 'anyTopic') {
      const fillPool = allQuestions.filter(q =>
        isUsableQuestion(q) &&
        !usedIds.has(q.id) &&
        !excludedIds.has(q.id)
      );
      const fillCount = requestedCount - selected.length;
      const fill = rule.useAdaptiveAlgorithm
        ? selectByElo(fillPool, userElo, fillCount, minDifficulty, maxDifficulty)
        : selectRandom(fillPool, fillCount, minDifficulty, maxDifficulty);
      selected.push(...fill);
      fill.forEach(q => usedIds.add(q.id));
    }

    // Per-topic time: template.topicTimeSettings or fallback to timeLimitMinutes / totalQ
    const perQuestionSeconds = template.topicTimeSettings?.[topicId]
      ?? Math.round((template.timeLimitMinutes * 60) / (template.totalQuestions || 1));

    sections.push({
      ruleId: rule.id,
      ruleName: rule.name || topicId,
      topicId,
      questions: shuffle(selected),
      timeLimitSeconds: perQuestionSeconds * selected.length,
      useAdaptive: rule.useAdaptiveAlgorithm ?? false,
    });
  }

  const allQ = sections.flatMap(s => s.questions);
  const estimatedMinutes = template.timeLimitMinutes
    ?? Math.ceil(allQ.length * 1.5);

  return {
    sections,
    allQuestions: allQ,
    totalQuestions: allQ.length,
    estimatedMinutes,
  };
}

export function calcSmartExamScore(
  answers: Array<{ isCorrect: boolean; timeSpent: number; difficulty: number; isSkipped?: boolean }>,
  passingScore: number
): {
  rawScore: number;
  difficultyWeightedScore: number;
  speedAdjustedScore: number;
  stabilityScore: number;
  percentileRank: number;
  performanceLevel: 'low' | 'medium' | 'high' | 'very_high';
  passed: boolean;
} {
  const total = answers.length;
  if (total === 0) return {
    rawScore: 0, difficultyWeightedScore: 0, speedAdjustedScore: 0,
    stabilityScore: 0, percentileRank: 0, performanceLevel: 'low', passed: false,
  };

  const safeDifficulty = (value: number) => Math.max(1, Math.min(10, Number.isFinite(value) ? value : 5));
  const correct = answers.filter(a => a.isCorrect && !a.isSkipped).length;
  const rawScore = Math.round((correct / total) * 100);

  const totalDiff = answers.reduce((sum, answer) => sum + safeDifficulty(answer.difficulty), 0);
  const weightedCorrect = answers
    .filter(answer => answer.isCorrect && !answer.isSkipped)
    .reduce((sum, answer) => sum + safeDifficulty(answer.difficulty), 0);
  const difficultyWeightedScore = totalDiff > 0
    ? Math.round((weightedCorrect / totalDiff) * 100)
    : rawScore;

  const answered = answers.filter(answer => !answer.isSkipped);
  const speedDelta = answered.length > 0
    ? answered.reduce((sum, answer) => {
        const difficulty = safeDifficulty(answer.difficulty);
        const expectedSeconds = 18 + difficulty * 5;
        if (!answer.isCorrect) return sum + (answer.timeSpent > expectedSeconds * 1.7 ? -2 : 0);
        if (answer.timeSpent <= expectedSeconds * 0.55 && difficulty >= 6) return sum + 4;
        if (answer.timeSpent <= expectedSeconds * 0.75) return sum + 2;
        if (answer.timeSpent <= expectedSeconds * 1.15) return sum;
        return sum - 1;
      }, 0) / answered.length
    : 0;
  const speedAdjustedScore = Math.max(0, Math.min(100, Math.round(difficultyWeightedScore + speedDelta)));

  const windowSize = 5;
  const windows: number[] = [];
  for (let i = 0; i <= answers.length - windowSize; i++) {
    const window = answers.slice(i, i + windowSize);
    windows.push(window.filter(answer => answer.isCorrect && !answer.isSkipped).length / windowSize);
  }
  const mean = windows.length > 0 ? windows.reduce((sum, value) => sum + value, 0) / windows.length : rawScore / 100;
  const variance = windows.length > 0
    ? windows.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / windows.length
    : 0;
  const stabilityScore = Math.round(Math.max(0, 1 - variance * 4) * 100);

  const skippedRate = answers.filter(answer => answer.isSkipped).length / total;
  const finalScore = Math.max(0, Math.min(100, Math.round(
    rawScore * 0.42 +
    difficultyWeightedScore * 0.38 +
    speedAdjustedScore * 0.12 +
    stabilityScore * 0.08 -
    skippedRate * 8
  )));

  const performanceLevel: 'low' | 'medium' | 'high' | 'very_high' =
    finalScore >= 85 ? 'very_high' :
    finalScore >= 70 ? 'high' :
    finalScore >= 50 ? 'medium' : 'low';

  return {
    rawScore,
    difficultyWeightedScore,
    speedAdjustedScore,
    stabilityScore,
    percentileRank: estimatePercentileRank(finalScore),
    performanceLevel,
    passed: finalScore >= passingScore,
  };
}
