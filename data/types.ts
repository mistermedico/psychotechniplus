// ── Entities ──────────────────────────────────────────────────────────────

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'logic'
  | 'verbal'
  | 'quantitative'
  | 'shapes'
  | 'reading_comprehension'
  | 'fill_in_the_blank';

export type AccessLevel = 'free' | 'premium';
export type ValidationStatus = 'pending' | 'validated' | 'rejected' | 'draft';
export type PerformanceLevel = 'low' | 'medium' | 'high' | 'very_high';
export type SessionMode = 'practice' | 'speed' | 'simulation' | 'review' | 'adaptive';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Target {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  gradientColors: [string, string];
  order: number;
  totalQuestions: number;
  freeQuestionsCount: number;
  isPremiumOnly: boolean;
  isActive: boolean;
  comingSoon: boolean;
  accessSettings: {
    accessType: 'free' | 'freemium' | 'premium_only';
    freeQuestionLimit: number;
  };
}

export interface Topic {
  id: string;
  targetId: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
  isPremiumOnly: boolean;
  color: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
  analysisTag?: string;
}

export interface Question {
  id: string;
  targetIds: string[];
  topicId: string;
  subtopicId?: string;
  questionType: QuestionType;
  questionText: string;
  readingPassage?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  explanationImageUrl?: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  psychometricStats: {
    elo: number;
    discrimination: number;
    guessProbability: number;
  };
  accessLevel: AccessLevel;
  validationStatus: ValidationStatus;
  smartPracticeEligible: boolean;
  generalPracticeEligible: boolean;
}

export interface PracticeSession {
  id: string;
  userId: string;
  targetId: string;
  topicId?: string;
  mode: SessionMode;
  isAdaptive: boolean;
  questions: Question[];
  currentIndex: number;
  answers: UserAnswer[];
  startedAt: Date;
  completedAt?: Date;
  status: SessionStatus;
  score?: number;
  totalTimeSpent?: number;
}

export interface UserAnswer {
  questionId: string;
  selectedAnswerId: string;
  isCorrect: boolean;
  timeSpent: number;
  isSkipped: boolean;
  questionDifficulty: number;
}

export interface UserSkill {
  userId: string;
  targetId: string;
  topicId: string;
  elo: number;
  confidence: number;
  weaknesses: string[];
  errorPatterns: Record<string, number>;
  lastPracticedAt?: Date;
}

export interface UserProgress {
  userId: string;
  targetId: string;
  totalSessions: number;
  totalQuestions: number;
  correctAnswers: number;
  avgScore: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  xp: number;
  lastPracticedAt?: Date;
}

export type BadgeType =
  | 'first_session'
  | 'streak_7'
  | 'streak_30'
  | 'perfect_score'
  | 'speed_master'
  | 'topic_complete'
  | 'simulation_pass'
  | 'level_up';

export interface UserBadge {
  id: string;
  userId: string;
  badgeType: BadgeType;
  earnedAt: Date;
  metadata?: Record<string, unknown>;
}

// ── Session Results ────────────────────────────────────────────────────────

export interface SessionResult {
  sessionId: string;
  score: number;
  rawScore: number;
  difficultyWeightedScore: number;
  speedAdjustedScore: number;
  stabilityScore: number;
  percentileRank: number;
  performanceLevel: PerformanceLevel;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  avgTimePerQuestion: number;
  totalTimeSpent: number;
  topicBreakdown: Array<{
    topicId: string;
    topicName: string;
    correct: number;
    total: number;
    score: number;
  }>;
  weaknesses: string[];
  newBadges: UserBadge[];
  eloChange: number;
  newElo: number;
}
