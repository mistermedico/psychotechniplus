import { create } from 'zustand';
import { DEFAULT_ELO, updatePlayerElo } from '../utils/elo';
import { UserBadge, BadgeType } from '../data/types';
import { supabase } from '../lib/supabase';
import {
  getOrCreateUserId, loadUserProfile, saveUserProfile,
  loadUserElos, saveUserElo, loadUserBadges, saveUserBadge,
} from '../lib/db';

interface TopicElo {
  elo: number;
  history: { elo: number; date: string }[];
}

interface UserState {
  userId: string;
  email: string;
  name: string;
  selectedTargetId: string | null;
  hasCompletedOnboarding: boolean;

  topicElos: Record<string, TopicElo>;

  streak: number;
  longestStreak: number;
  lastPracticedDate: string | null;
  level: number;
  xp: number;
  badges: UserBadge[];

  totalSessions: number;
  totalCorrect: number;
  totalAnswered: number;
  isPremium: boolean;

  // Auth + Supabase sync
  isLoaded: boolean;
  isSyncing: boolean;
  isAuthenticated: boolean;
  initialize: (overrideUserId?: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Actions
  completeOnboarding: (name: string, targetId: string, initialElos: Record<string, number>) => void;
  updateElo: (topicId: string, questionElo: number, isCorrect: boolean) => void;
  addXp: (amount: number) => void;
  updateStreak: () => void;
  earnBadge: (type: BadgeType) => UserBadge;
  recordSession: (correct: number, total: number) => void;
  getTopicElo: (topicId: string) => number;
  setPremium: (val: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  userId: '',
  email: '',
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
  isPremium: false,
  isLoaded: false,
  isSyncing: false,
  isAuthenticated: false,
};

function xpForLevel(level: number): number { return level * 100; }

export const useUserStore = create<UserState>((set, get) => ({
  ...INITIAL_STATE,

  initialize: async (overrideUserId?: string) => {
    // If already loaded and no override, skip
    if (get().isLoaded && !overrideUserId) return;
    set({ isSyncing: true });

    let userId = overrideUserId;
    let sessionEmail = '';

    // If no userId provided, check Supabase Auth session (single call)
    if (!userId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          userId = session.user.id;
          sessionEmail = session.user.email ?? '';
        } else {
          // Not authenticated — stop here, let index.tsx redirect to /auth
          set({ isLoaded: true, isSyncing: false, isAuthenticated: false });
          return;
        }
      } catch {
        set({ isLoaded: true, isSyncing: false, isAuthenticated: false });
        return;
      }
    } else {
      // userId provided externally (after login) — still grab email from session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionEmail = session?.user?.email ?? '';
      } catch {}
    }

    set({ userId, isAuthenticated: true, email: sessionEmail });

    const [profile, elos, badges] = await Promise.all([
      loadUserProfile(userId),
      loadUserElos(userId),
      loadUserBadges(userId),
    ]);

    if (profile) {
      set({
        name: profile.name,
        selectedTargetId: profile.selected_target_id,
        hasCompletedOnboarding: profile.has_completed_onboarding,
        streak: profile.streak,
        longestStreak: profile.longest_streak,
        lastPracticedDate: profile.last_practiced_date,
        level: profile.level,
        xp: profile.xp,
        totalSessions: profile.total_sessions,
        totalCorrect: profile.total_correct,
        totalAnswered: profile.total_answered,
      });
    }

    if (Object.keys(elos).length > 0) set({ topicElos: elos });
    if (badges.length > 0) set({ badges });

    set({ isLoaded: true, isSyncing: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ ...INITIAL_STATE, isLoaded: true });
  },

  completeOnboarding: (name, targetId, initialElos) => {
    const topicElos: Record<string, TopicElo> = {};
    Object.entries(initialElos).forEach(([topicId, elo]) => {
      topicElos[topicId] = { elo, history: [{ elo, date: new Date().toISOString() }] };
    });
    set({ name, selectedTargetId: targetId, hasCompletedOnboarding: true, topicElos });

    const { userId } = get();
    saveUserProfile(userId, {
      name, selected_target_id: targetId, has_completed_onboarding: true,
    });
    Object.entries(topicElos).forEach(([topicId, { elo, history }]) => {
      saveUserElo(userId, topicId, elo, history);
    });
  },

  updateElo: (topicId, questionElo, isCorrect) => {
    set(state => {
      const current = state.topicElos[topicId] ?? { elo: DEFAULT_ELO, history: [] };
      const newElo = updatePlayerElo(current.elo, questionElo, isCorrect);
      const entry = { elo: newElo, date: new Date().toISOString() };
      const updated = { elo: newElo, history: [...current.history.slice(-29), entry] };
      saveUserElo(state.userId, topicId, newElo, updated.history);
      return {
        topicElos: { ...state.topicElos, [topicId]: updated },
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
      saveUserProfile(state.userId, { xp: newXp, level: newLevel });
      return { xp: newXp, level: newLevel };
    });
  },

  updateStreak: () => {
    set(state => {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (state.lastPracticedDate === today) return {};
      const newStreak = state.lastPracticedDate === yesterday ? state.streak + 1 : 1;
      const updates = {
        streak: newStreak,
        longestStreak: Math.max(newStreak, state.longestStreak),
        lastPracticedDate: today,
      };
      saveUserProfile(state.userId, {
        streak: updates.streak,
        longest_streak: updates.longestStreak,
        last_practiced_date: today,
      });
      return updates;
    });
  },

  earnBadge: (type) => {
    const badge: UserBadge = {
      id: `badge_${Date.now()}`,
      userId: get().userId,
      badgeType: type,
      earnedAt: new Date(),
    };
    set(state => ({ badges: [...state.badges, badge] }));
    saveUserBadge(badge);
    return badge;
  },

  recordSession: (correct, total) => {
    set(state => {
      const updates = {
        totalSessions: state.totalSessions + 1,
        totalCorrect: state.totalCorrect + correct,
        totalAnswered: state.totalAnswered + total,
      };
      saveUserProfile(state.userId, {
        total_sessions: updates.totalSessions,
        total_correct: updates.totalCorrect,
        total_answered: updates.totalAnswered,
      });
      return updates;
    });
    get().updateStreak();
    get().addXp(correct * 10 + 20);
    if (get().totalSessions === 1) get().earnBadge('first_session');
  },

  getTopicElo: (topicId) => get().topicElos[topicId]?.elo ?? DEFAULT_ELO,

  setPremium: (val) => set({ isPremium: val }),

  reset: () => {
    const { userId } = get();
    if (userId) saveUserProfile(userId, {
      name: '', selected_target_id: null, has_completed_onboarding: false,
      streak: 0, longest_streak: 0, last_practiced_date: null,
      level: 1, xp: 0, total_sessions: 0, total_correct: 0, total_answered: 0,
    });
    set({ ...INITIAL_STATE, userId, isLoaded: true });
  },
}));
