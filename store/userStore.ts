import { create } from 'zustand';
import { DEFAULT_ELO, updatePlayerElo } from '../utils/elo';
import { UserBadge, BadgeType } from '../data/types';

interface TopicElo {
  elo: number;
  history: { elo: number; date: string }[];
}

interface UserState {
  userId: string;
  name: string;
  selectedTargetId: string | null;
  hasCompletedOnboarding: boolean;

  // ELO per topic
  topicElos: Record<string, TopicElo>;

  // Gamification
  streak: number;
  longestStreak: number;
  lastPracticedDate: string | null;
  level: number;
  xp: number;
  badges: UserBadge[];

  // Stats
  totalSessions: number;
  totalCorrect: number;
  totalAnswered: number;

  // Actions
  completeOnboarding: (name: string, targetId: string, initialElos: Record<string, number>) => void;
  updateElo: (topicId: string, questionElo: number, isCorrect: boolean) => void;
  addXp: (amount: number) => void;
  updateStreak: () => void;
  earnBadge: (type: BadgeType) => UserBadge;
  recordSession: (correct: number, total: number) => void;
  getTopicElo: (topicId: string) => number;
  reset: () => void;
}

const INITIAL_STATE = {
  userId: `user_${Date.now()}`,
  name: '',
  selectedTargetId: null,
  hasCompletedOnboarding: false,
  topicElos: {},
  streak: 0,
  longestStreak: 0,
  lastPracticedDate: null,
  level: 1,
  xp: 0,
  badges: [],
  totalSessions: 0,
  totalCorrect: 0,
  totalAnswered: 0,
};

function xpForLevel(level: number): number {
  return level * 100;
}

export const useUserStore = create<UserState>((set, get) => ({
  ...INITIAL_STATE,

  completeOnboarding: (name, targetId, initialElos) => {
    const topicElos: Record<string, TopicElo> = {};
    Object.entries(initialElos).forEach(([topicId, elo]) => {
      topicElos[topicId] = { elo, history: [{ elo, date: new Date().toISOString() }] };
    });
    set({
      name,
      selectedTargetId: targetId,
      hasCompletedOnboarding: true,
      topicElos,
    });
  },

  updateElo: (topicId, questionElo, isCorrect) => {
    set(state => {
      const current = state.topicElos[topicId] ?? { elo: DEFAULT_ELO, history: [] };
      const newElo = updatePlayerElo(current.elo, questionElo, isCorrect);
      const entry = { elo: newElo, date: new Date().toISOString() };
      return {
        topicElos: {
          ...state.topicElos,
          [topicId]: {
            elo: newElo,
            history: [...current.history.slice(-29), entry],
          },
        },
      };
    });
  },

  addXp: (amount) => {
    set(state => {
      let newXp = state.xp + amount;
      let newLevel = state.level;
      while (newXp >= xpForLevel(newLevel)) {
        newXp -= xpForLevel(newLevel);
        newLevel += 1;
      }
      return { xp: newXp, level: newLevel };
    });
  },

  updateStreak: () => {
    set(state => {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (state.lastPracticedDate === today) return {};
      const newStreak =
        state.lastPracticedDate === yesterday ? state.streak + 1 : 1;
      return {
        streak: newStreak,
        longestStreak: Math.max(newStreak, state.longestStreak),
        lastPracticedDate: today,
      };
    });
  },

  earnBadge: (type) => {
    const badge: UserBadge = {
      id: `badge_${Date.now()}`,
      userId: get().userId,
      badgeType: type,
      earnedAt: new Date(),
    };
    set(state => ({
      badges: [...state.badges, badge],
    }));
    return badge;
  },

  recordSession: (correct, total) => {
    set(state => ({
      totalSessions: state.totalSessions + 1,
      totalCorrect: state.totalCorrect + correct,
      totalAnswered: state.totalAnswered + total,
    }));
    get().updateStreak();
    get().addXp(correct * 10 + 20);
    // First session badge
    if (get().totalSessions === 1) get().earnBadge('first_session');
  },

  getTopicElo: (topicId) => {
    return get().topicElos[topicId]?.elo ?? DEFAULT_ELO;
  },

  reset: () => set(INITIAL_STATE),
}));
