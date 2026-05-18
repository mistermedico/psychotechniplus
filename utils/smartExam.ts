import { Question } from '../data/types';
import { SmartExamTemplate, SmartRule } from '../store/adminStore';

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

    // Base pool: correct topic, validated, not used, not excluded
    let pool = allQuestions.filter(q =>
      q.topicId === topicId &&
      q.validationStatus === 'validated' &&
      !usedIds.has(q.id) &&
      !excludedIds.has(q.id)
    );

    // If pool is empty, fallback: relax used-id filter
    if (pool.length < rule.count) {
      pool = allQuestions.filter(q =>
        q.topicId === topicId &&
        q.validationStatus === 'validated' &&
        !excludedIds.has(q.id)
      );
    }
    // Still empty: use all questions for this topic regardless of status
    if (pool.length === 0) {
      pool = allQuestions.filter(q => q.topicId === topicId);
    }

    let selected: Question[] = [];

    if (rule.subRules && rule.subRules.length > 0) {
      // Select per sub-rule (subcategory)
      let remaining = rule.count;
      for (const sub of rule.subRules) {
        const subPool = pool.filter(
          q => (q as any).subcategory === sub.value || !sub.value
        );
        const subCount = Math.min(sub.count, remaining, subPool.length || pool.length);
        const subSelected = rule.useAdaptiveAlgorithm
          ? selectByElo(subPool.length > 0 ? subPool : pool, userElo, subCount, rule.minDifficulty, rule.maxDifficulty)
          : selectRandom(subPool.length > 0 ? subPool : pool, subCount, rule.minDifficulty, rule.maxDifficulty);
        selected.push(...subSelected);
        subSelected.forEach(q => usedIds.add(q.id));
        remaining -= subSelected.length;
      }
      // Fill remaining if subRules don't add up
      if (remaining > 0) {
        const fillPool = pool.filter(q => !usedIds.has(q.id));
        const fill = rule.useAdaptiveAlgorithm
          ? selectByElo(fillPool, userElo, remaining, rule.minDifficulty, rule.maxDifficulty)
          : selectRandom(fillPool, remaining, rule.minDifficulty, rule.maxDifficulty);
        selected.push(...fill);
        fill.forEach(q => usedIds.add(q.id));
      }
    } else {
      selected = rule.useAdaptiveAlgorithm
        ? selectByElo(pool, userElo, rule.count, rule.minDifficulty, rule.maxDifficulty)
        : selectRandom(pool, rule.count, rule.minDifficulty, rule.maxDifficulty);
      selected.forEach(q => usedIds.add(q.id));
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
  answers: Array<{ isCorrect: boolean; timeSpent: number; difficulty: number }>,
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

  const correct = answers.filter(a => a.isCorrect).length;
  const rawScore = Math.round((correct / total) * 100);

  // Difficulty-weighted score
  const totalDiff = answers.reduce((s, a) => s + a.difficulty, 0);
  const weightedCorrect = answers.filter(a => a.isCorrect).reduce((s, a) => s + a.difficulty, 0);
  const difficultyWeightedScore = totalDiff > 0
    ? Math.round((weightedCorrect / totalDiff) * 100)
    : rawScore;

  // Speed score: bonus for fast answers (avg under 30s per question)
  const avgTime = answers.reduce((s, a) => s + a.timeSpent, 0) / total;
  const speedBonus = avgTime < 20 ? 8 : avgTime < 30 ? 4 : avgTime < 45 ? 0 : -4;
  const speedAdjustedScore = Math.max(0, Math.min(100, rawScore + speedBonus));

  // Stability: how consistent the performance is (less variance = more stable)
  const windowSize = 5;
  const windows: number[] = [];
  for (let i = 0; i <= answers.length - windowSize; i++) {
    const w = answers.slice(i, i + windowSize);
    windows.push(w.filter(a => a.isCorrect).length / windowSize);
  }
  const mean = windows.length > 0 ? windows.reduce((s, v) => s + v, 0) / windows.length : rawScore / 100;
  const variance = windows.length > 0
    ? windows.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / windows.length
    : 0;
  const stabilityScore = Math.round(Math.max(0, 1 - variance * 4) * 100);

  // Percentile estimate (simplified — compare to gaussian distribution)
  const z = (rawScore - 65) / 15;
  const percentileRank = Math.round(Math.min(99, Math.max(1,
    50 + 50 * Math.tanh(z * 0.8)
  )));

  const performanceLevel: 'low' | 'medium' | 'high' | 'very_high' =
    rawScore >= 85 ? 'very_high' :
    rawScore >= 70 ? 'high' :
    rawScore >= 50 ? 'medium' : 'low';

  return {
    rawScore,
    difficultyWeightedScore,
    speedAdjustedScore,
    stabilityScore,
    percentileRank,
    performanceLevel,
    passed: rawScore >= passingScore,
  };
}
