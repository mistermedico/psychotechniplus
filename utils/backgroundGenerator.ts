import { supabase } from '../lib/supabase';
import { Question } from '../data/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BulkGenProgress {
  done: number;
  total: number;
  currentTopic: string;
  currentType: string;
  log: string[]; // most recent first
}

// ── Generation plan ────────────────────────────────────────────────────────

interface GenJob {
  topicId: string;
  topicName: string;
  type: string;
  difficulty: number;
}

const GENERATION_PLAN: GenJob[] = [];

const TOPICS_PLAN = [
  {
    topicId: 'topic_quantitative',
    topicName: 'חשבון וכמות',
    types: ['quantitative', 'multiple_choice'],
    difficulties: [2, 4, 6, 8],
  },
  {
    topicId: 'topic_verbal',
    topicName: 'שפה ומילולי',
    types: ['verbal', 'fill_in_the_blank'],
    difficulties: [2, 4, 6],
  },
  {
    topicId: 'topic_logic',
    topicName: 'חשיבה לוגית',
    types: ['logic', 'multiple_choice'],
    difficulties: [3, 5, 7],
  },
  {
    topicId: 'topic_spatial',
    topicName: 'מרחב וצורות',
    types: ['shapes', 'multiple_choice'],
    difficulties: [3, 5, 7],
  },
  {
    topicId: 'topic_english',
    topicName: 'אנגלית',
    types: ['verbal', 'fill_in_the_blank'],
    difficulties: [2, 4, 6],
  },
];

for (const topic of TOPICS_PLAN) {
  for (const type of topic.types) {
    for (const difficulty of topic.difficulties) {
      GENERATION_PLAN.push({
        topicId: topic.topicId,
        topicName: topic.topicName,
        type,
        difficulty,
      });
    }
  }
}

// ── Cancellation flag ──────────────────────────────────────────────────────

let cancelFlag = false;

export function stopBulkGeneration(): void {
  cancelFlag = true;
}

// ── Main function ──────────────────────────────────────────────────────────

export async function startBulkGeneration(
  addQuestion: (q: Omit<Question, 'id'>) => Question,
  onProgress: (p: BulkGenProgress) => void,
  onComplete: (totalDone: number) => void,
  questionsPerBatch = 3,
): Promise<void> {
  cancelFlag = false;

  const total = GENERATION_PLAN.length;
  let done = 0;
  const log: string[] = [];

  for (const job of GENERATION_PLAN) {
    if (cancelFlag) break;

    onProgress({
      done,
      total,
      currentTopic: job.topicName,
      currentType: job.type,
      log,
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          topicId: job.topicId,
          topicName: job.topicName,
          questionType: job.type,
          difficulty: job.difficulty,
          count: questionsPerBatch,
          language: 'he',
          mode: 'varied',
        },
      });

      if (error || !data) {
        const msg = `⚠️ ${job.topicName} / ${job.type} / רמה ${job.difficulty}: שגיאה בקריאה`;
        log.unshift(msg);
      } else {
        const generated: any[] = Array.isArray(data) ? data : (data.questions ?? []);
        let savedCount = 0;

        for (const g of generated) {
          if (cancelFlag) break;
          try {
            addQuestion({
              targetIds: ['target_psychometric'],
              topicId: job.topicId,
              questionType: job.type as Question['questionType'],
              questionText: g.questionText ?? '',
              options: g.options ?? [],
              correctAnswer: g.correctAnswer ?? 'a',
              explanation: g.explanation ?? '',
              difficulty: g.difficulty ?? job.difficulty,
              psychometricStats: {
                elo: 900 + job.difficulty * 70,
                discrimination: 0.65 + Math.random() * 0.25,
                guessProbability: 0.25,
              },
              accessLevel: 'free',
              validationStatus: 'pending',
              smartPracticeEligible: false,
              generalPracticeEligible: false,
            });
            savedCount++;
          } catch {
            // skip individual question errors
          }
        }

        const msg = `✅ ${job.topicName} / ${job.type} / רמה ${job.difficulty}: ${savedCount} שאלות נוצרו`;
        log.unshift(msg);
      }
    } catch {
      const msg = `⚠️ ${job.topicName} / ${job.type} / רמה ${job.difficulty}: שגיאה לא צפויה`;
      log.unshift(msg);
    }

    done++;

    onProgress({
      done,
      total,
      currentTopic: job.topicName,
      currentType: job.type,
      log,
    });

    if (!cancelFlag && done < total) {
      await new Promise<void>(resolve => setTimeout(resolve, 1200));
    }
  }

  onComplete(done);
}
