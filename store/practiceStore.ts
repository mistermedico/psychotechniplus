import { create } from 'zustand';
import { Question, UserAnswer, SessionMode } from '../data/types';
import { selectAdaptiveQuestion } from '../utils/elo';

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
}

interface PracticeState {
  session: ActiveSession | null;
  lastCompletedSessionId: string | null;

  startSession: (config: {
    targetId: string;
    topicId: string;
    mode: SessionMode;
    questions: Question[];
  }) => void;

  submitAnswer: (selectedAnswerId: string) => {
    isCorrect: boolean;
    timeSpent: number;
    correctAnswerId: string;
  };

  skipQuestion: () => void;
  nextQuestion: () => boolean; // returns true if more questions
  endSession: () => ActiveSession | null;
  getCurrentQuestion: () => Question | null;
  getAnswerForCurrent: () => UserAnswer | undefined;
  getAdaptiveNext: (userElo: number) => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  session: null,
  lastCompletedSessionId: null,

  startSession: ({ targetId, topicId, mode, questions }) => {
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

    set(state => ({
      session: state.session
        ? { ...state.session, answers: [...state.session.answers, answer] }
        : null,
    }));

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
    const next = session.currentIndex + 1;
    if (next >= session.questions.length) return false;
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            currentIndex: next,
            questionStartedAt: new Date(),
          }
        : null,
    }));
    return true;
  },

  getAdaptiveNext: (userElo) => {
    const { session } = get();
    if (!session) return;
    const answeredIds = session.answers.map(a => a.questionId);
    const next = selectAdaptiveQuestion(userElo, session.questions, answeredIds);
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
