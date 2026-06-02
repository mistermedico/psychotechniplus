import { create } from 'zustand';
import { Question, UserAnswer, SessionMode } from '../data/types';
import { selectAdaptiveQuestion, computeAdaptiveLevel, PerformanceLevel } from '../utils/adaptive';

interface ActiveSession {
  id: string;
  targetId: string;
  topicId: string;
  mode: SessionMode;
  questions: Question[];
  currentIndex: number;
  answers: UserAnswer[];
  startedAt: Date;
  questionStartedAt: Date;
  adaptiveLevel: PerformanceLevel;
}

interface PracticeState {
  session: ActiveSession | null;
  lastCompletedSessionId: string | null;

  startSession: (config: {
    targetId: string;
    topicId: string;
    mode: SessionMode;
    questions: Question[];
    initialLevel?: PerformanceLevel;
  }) => void;

  submitAnswer: (selectedAnswerId: string) => {
    isCorrect: boolean;
    timeSpent: number;
    correctAnswerId: string;
  };

  skipQuestion: () => void;
  nextQuestion: () => boolean;
  endSession: () => ActiveSession | null;
  getCurrentQuestion: () => Question | null;
  getAnswerForCurrent: () => UserAnswer | undefined;
  getAdaptiveNext: () => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  session: null,
  lastCompletedSessionId: null,

  startSession: ({ targetId, topicId, mode, questions, initialLevel = 'beginner' }) => {
    const now = new Date();
    set({
      session: {
        id: `session_${Date.now()}`,
        targetId,
        topicId,
        mode,
        questions,
        currentIndex: 0,
        answers: [],
        startedAt: now,
        questionStartedAt: now,
        adaptiveLevel: initialLevel,
      },
    });
  },

  submitAnswer: (selectedAnswerId) => {
    const { session } = get();
    if (!session) return { isCorrect: false, timeSpent: 0, correctAnswerId: '' };

    const question = session.questions[session.currentIndex];
    const isCorrect = question.correctAnswer === selectedAnswerId;
    const timeSpent = Math.round(
      (Date.now() - session.questionStartedAt.getTime()) / 1000
    );

    const answer: UserAnswer = {
      questionId: question.id,
      selectedAnswerId,
      isCorrect,
      timeSpent,
      isSkipped: false,
      questionDifficulty: question.difficulty,
    };

    set(state => {
      if (!state.session) return {};
      const newAnswers = [...state.session.answers, answer];
      const history = newAnswers.map(a => ({ isCorrect: a.isCorrect, difficulty: a.questionDifficulty }));
      const newLevel = computeAdaptiveLevel(history, state.session.adaptiveLevel);
      return { session: { ...state.session, answers: newAnswers, adaptiveLevel: newLevel } };
    });

    return { isCorrect, timeSpent, correctAnswerId: question.correctAnswer };
  },

  skipQuestion: () => {
    const { session } = get();
    if (!session) return;
    const question = session.questions[session.currentIndex];
    const timeSpent = Math.round(
      (Date.now() - session.questionStartedAt.getTime()) / 1000
    );
    const answer: UserAnswer = {
      questionId: question.id,
      selectedAnswerId: '',
      isCorrect: false,
      timeSpent,
      isSkipped: true,
      questionDifficulty: question.difficulty,
    };
    set(state => ({
      session: state.session
        ? { ...state.session, answers: [...state.session.answers, answer] }
        : null,
    }));
  },

  nextQuestion: () => {
    const { session } = get();
    if (!session) return false;
    if (session.currentIndex + 1 >= session.questions.length) return false;
    set(state => {
      if (!state.session) return {};
      const next = state.session.currentIndex + 1;
      if (next >= state.session.questions.length) return {};
      return { session: { ...state.session, currentIndex: next, questionStartedAt: new Date() } };
    });
    return true;
  },

  // Reorder to next best adaptive question within the session pool
  getAdaptiveNext: () => {
    const { session } = get();
    if (!session) return;
    const answeredIds = session.answers.map(a => a.questionId);
    const next = selectAdaptiveQuestion(session.adaptiveLevel, session.questions, answeredIds);
    if (!next) return;
    const nextIndex = session.questions.findIndex(q => q.id === next.id);
    if (nextIndex === -1) return;
    set(state => ({
      session: state.session
        ? { ...state.session, currentIndex: nextIndex, questionStartedAt: new Date() }
        : null,
    }));
  },

  endSession: () => {
    const { session } = get();
    if (!session) return null;
    set(state => ({
      lastCompletedSessionId: state.session?.id ?? null,
      session: null,
    }));
    return session;
  },

  getCurrentQuestion: () => {
    const { session } = get();
    if (!session) return null;
    return session.questions[session.currentIndex] ?? null;
  },

  getAnswerForCurrent: () => {
    const { session } = get();
    if (!session) return undefined;
    const q = session.questions[session.currentIndex];
    return session.answers.find(a => a.questionId === q?.id);
  },
}));
