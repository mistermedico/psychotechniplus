import { create } from 'zustand';
import { Question, UserAnswer, SessionMode } from '../data/types';
import { selectAdaptiveQuestion, computeAdaptiveLevel, PerformanceLevel } from '../utils/adaptive';
import { ensureSpatialVisualAssets, isSpatialQuestion } from '../utils/spatialVisualAssets';

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
  completedSession: ActiveSession | null;
  lastCompletedSessionId: string | null;

  startSession: (config: {
    targetId: string;
    topicId: string;
    mode: SessionMode;
    questions: Question[];
    initialLevel?: PerformanceLevel;
  }) => void;
  refreshSessionQuestions: (questions: Question[]) => void;

  submitAnswer: (selectedAnswerId: string) => {
    isCorrect: boolean;
    timeSpent: number;
    correctAnswerId: string;
  };

  skipQuestion: () => void;
  completeUnansweredAsSkipped: () => void;
  nextQuestion: () => boolean;
  endSession: () => ActiveSession | null;
  getCurrentQuestion: () => Question | null;
  getAnswerForCurrent: () => UserAnswer | undefined;
  getAdaptiveNext: () => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  session: null,
  completedSession: null,
  lastCompletedSessionId: null,

  startSession: ({ targetId, topicId, mode, questions, initialLevel = 'beginner' }) => {
    const now = new Date();
    const normalizedQuestions = questions.map(question =>
      isSpatialQuestion(question) ? ensureSpatialVisualAssets(question) : question
    );
    set({
      session: {
        id: `session_${Date.now()}`,
        targetId,
        topicId,
        mode,
        questions: normalizedQuestions,
        currentIndex: 0,
        answers: [],
        startedAt: now,
        questionStartedAt: now,
        adaptiveLevel: initialLevel,
      },
    });
  },

  refreshSessionQuestions: (questions) => {
    const { session } = get();
    if (!session || questions.length === 0) return;

    const normalizedQuestions = questions.map(question =>
      isSpatialQuestion(question) ? ensureSpatialVisualAssets(question) : question
    );
    const incomingById = new Map(normalizedQuestions.map(question => [question.id, question]));
    const answeredIds = new Set(session.answers.map(answer => answer.questionId));
    const oldCurrentId = session.questions[session.currentIndex]?.id;

    const mergedExisting = session.questions
      .map(question => incomingById.get(question.id) ?? (answeredIds.has(question.id) ? question : null))
      .filter((question): question is Question => Boolean(question));

    const existingIds = new Set(mergedExisting.map(question => question.id));
    const additions = normalizedQuestions.filter(question => !existingIds.has(question.id));
    const nextQuestions = [...mergedExisting, ...additions];
    if (nextQuestions.length === 0) return;

    let nextIndex = nextQuestions.findIndex(question => question.id === oldCurrentId);
    if (nextIndex === -1) nextIndex = Math.min(session.currentIndex, nextQuestions.length - 1);
    const nextCurrentId = nextQuestions[nextIndex]?.id;

    set({
      session: {
        ...session,
        questions: nextQuestions,
        currentIndex: nextIndex,
        questionStartedAt: nextCurrentId !== oldCurrentId ? new Date() : session.questionStartedAt,
      },
    });
  },

  submitAnswer: (selectedAnswerId) => {
    const { session } = get();
    if (!session) return { isCorrect: false, timeSpent: 0, correctAnswerId: '' };

    const question = session.questions[session.currentIndex];
    const existing = session.answers.find(answer => answer.questionId === question.id);
    if (existing) {
      return {
        isCorrect: existing.isCorrect,
        timeSpent: existing.timeSpent,
        correctAnswerId: question.correctAnswer,
      };
    }
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

    // Update adaptive level based on session performance so far
    const updatedAnswers = [...session.answers, answer];
    const history = updatedAnswers.map(a => ({ isCorrect: a.isCorrect, difficulty: a.questionDifficulty }));
    const newLevel = computeAdaptiveLevel(history, session.adaptiveLevel);

    set(state => ({
      session: state.session
        ? { ...state.session, answers: updatedAnswers, adaptiveLevel: newLevel }
        : null,
    }));

    return { isCorrect, timeSpent, correctAnswerId: question.correctAnswer };
  },

  skipQuestion: () => {
    const { session } = get();
    if (!session) return;
    const question = session.questions[session.currentIndex];
    if (session.answers.some(answer => answer.questionId === question.id)) return;
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

  completeUnansweredAsSkipped: () => {
    const { session } = get();
    if (!session) return;
    const answeredIds = new Set(session.answers.map(answer => answer.questionId));
    const now = Date.now();
    const skippedAnswers = session.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !answeredIds.has(question.id))
      .map(({ question, index }) => ({
        questionId: question.id,
        selectedAnswerId: '',
        isCorrect: false,
        timeSpent: index === session.currentIndex
          ? Math.max(0, Math.round((now - session.questionStartedAt.getTime()) / 1000))
          : 0,
        isSkipped: true,
        questionDifficulty: question.difficulty,
      }));
    if (skippedAnswers.length === 0) return;
    set(state => ({
      session: state.session
        ? { ...state.session, answers: [...state.session.answers, ...skippedAnswers] }
        : null,
    }));
  },

  nextQuestion: () => {
    const { session } = get();
    if (!session) return false;
    const next = session.currentIndex + 1;
    if (next >= session.questions.length) return false;
    set(state => ({
      session: state.session
        ? { ...state.session, currentIndex: next, questionStartedAt: new Date() }
        : null,
    }));
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
      completedSession: state.session,
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
