import { create } from 'zustand';
import { UserBadge, BadgeType } from '../data/types';
import { supabase } from '../lib/supabase';
import {
  getOrCreateUserId, loadUserProfile, saveUserProfile,
  loadUserBadges, saveUserBadge,
} from '../lib/db';
import { logger } from '../utils/logger';
import { useAdminStore } from './adminStore';
import { logOutPurchases } from '../lib/purchases';
import { PerformanceLevel, computeAdaptiveLevel, LEVEL_LABELS } from '../utils/adaptive';

export interface TopicPerformanceEntry {
  isCorrect: boolean;
  difficulty: number;
}

export interface TopicPerformance {
  history: TopicPerformanceEntry[];
  currentLevel: PerformanceLevel;
}

interface UserState {
  userId: string;
  email: string;
  name: string;
  selectedTargetId: string | null;
  hasCompletedOnboarding: boolean;

  topicPerformance: Record<string, TopicPerformance>;

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

  isLoaded: boolean;
  isSyncing: boolean;
  isAuthenticated: boolean;
  initialize: (overrideUserId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;

  completeOnboarding: (name: string, targetId: string) => void;
  recordAnswer: (topicId: string, difficulty: number, isCorrect: boolean) => void;
  addXp: (amount: number) => void;
  updateStreak: () => void;
  earnBadge: (type: BadgeType) => UserBadge;
  recordSession: (correct: number, total: number) => void;
  getTopicAccuracy: (topicId: string) => number;
  getTopicLevel: (topicId: string) => PerformanceLevel;
  getTopicLevelLabel: (topicId: string) => string;
  setPremium: (val: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  userId: '',
  email: '',
  name: '',
  selectedTargetId: null,
  hasCompletedOnboarding: false,
  topicPerformance: {} as Record<string, TopicPerformance>,
  streak: 0,
  longestStreak: 0,
  lastPracticedDate: null,
  level: 1,
  xp: 0,
  badges: [] as UserBadge[],
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
    if (get().isLoaded && !overrideUserId) return;
    set({ isSyncing: true });

    let userId = overrideUserId;
    let sessionEmail = '';

    if (!userId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          userId = session.user.id;
          sessionEmail = session.user.email ?? '';
          logger.info('userStore:initialize', `משתמש מחובר: ${sessionEmail}`);
        } else {
          set({ isLoaded: true, isSyncing: false, isAuthenticated: false });
          return;
        }
      } catch (e: any) {
        logger.error('userStore:initialize', 'שגיאה בבדיקת session', e?.message);
        set({ isLoaded: true, isSyncing: false, isAuthenticated: false });
        return;
      }
    } else {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionEmail = session?.user?.email ?? '';
      } catch {}
    }

    set({ userId, isAuthenticated: true, email: sessionEmail });

    const [profile, badges] = await Promise.all([
      loadUserProfile(userId),
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

    if (badges.length > 0) set({ badges });

    set({ isLoaded: true, isSyncing: false });
  },

  signOut: async () => {
    logger.info('userStore:signOut', 'משתמש התנתק');
    await logOutPurchases().catch(() => null);
    await supabase.auth.signOut().catch(() => null);
    useAdminStore.getState().logActivity('משתמש התנתק', 'user');
    set({ ...INITIAL_STATE, isLoaded: true });
  },

  deleteAccount: async () => {
    const { userId } = get();
    if (!userId) return { success: false, error: 'No user session' };
    try {
      logger.info('userStore:deleteAccount', `מוחק חשבון: ${userId}`);
      await Promise.all([
        supabase.from('user_profiles').delete().eq('id', userId),
        supabase.from('user_elos').delete().eq('user_id', userId),
        supabase.from('user_badges').delete().eq('user_id', userId),
        supabase.from('practice_sessions').delete().eq('user_id', userId),
      ]);
      logger.success('userStore:deleteAccount', 'נתוני משתמש נמחקו');
      await supabase.functions.invoke('delete-user', { body: { userId } }).catch(() => null);
      await supabase.auth.signOut();
      set({ ...INITIAL_STATE, isLoaded: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message ?? 'Unknown error' };
    }
  },

  completeOnboarding: (name, targetId) => {
    set({ name, selectedTargetId: targetId, hasCompletedOnboarding: true });
    const { userId } = get();
    saveUserProfile(userId, {
      name, selected_target_id: targetId, has_completed_onboarding: true,
    });
    logger.success('userStore:completeOnboarding', `אונבורדינג הושלם — ${name}, מסלול: ${targetId}`);
    useAdminStore.getState().logActivity(`${name} השלים אונבורדינג — מסלול: ${targetId}`, 'user');
  },

  recordAnswer: (topicId, difficulty, isCorrect) => {
    set(state => {
      const current = state.topicPerformance[topicId] ?? { history: [], currentLevel: 'beginner' as PerformanceLevel };
      const newHistory = [...current.history.slice(-39), { isCorrect, difficulty }];
      const newLevel = computeAdaptiveLevel(newHistory, current.currentLevel);
      return {
        topicPerformance: {
          ...state.topicPerformance,
          [topicId]: { history: newHistory, currentLevel: newLevel },
        },
      };
    });
  },

  getTopicAccuracy: (topicId) => {
    const perf = get().topicPerformance[topicId];
    if (!perf || perf.history.length === 0) return 0;
    return perf.history.filter(h => h.isCorrect).length / perf.history.length;
  },

  getTopicLevel: (topicId) => {
    return get().topicPerformance[topicId]?.currentLevel ?? 'beginner';
  },

  getTopicLevelLabel: (topicId) => {
    const level = get().topicPerformance[topicId]?.currentLevel ?? 'beginner';
    return LEVEL_LABELS[level];
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
    const existing = get().badges.find(b => b.badgeType === type);
    if (existing) return existing;
    const badge: UserBadge = {
      id: `badge_${Date.now()}`,
      userId: get().userId,
      badgeType: type,
      earnedAt: new Date(),
    };
    set(state => ({ badges: [...state.badges, badge] }));
    saveUserBadge(badge);
    useAdminStore.getState().logActivity(`תג הושג: ${type}`, 'user');
    return badge;
  },

  recordSession: (correct, total) => {
    const wasFirstSession = get().totalSessions === 0;
    const xpGain = correct * 10 + 20;
    set(state => {
      const totalSessions = state.totalSessions + 1;
      const totalCorrect = state.totalCorrect + correct;
      const totalAnswered = state.totalAnswered + total;

      let newXp = state.xp + xpGain;
      let newLevel = state.level;
      while (newXp >= xpForLevel(newLevel)) { newXp -= xpForLevel(newLevel); newLevel++; }

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = state.lastPracticedDate === today
        ? state.streak
        : state.lastPracticedDate === yesterday ? state.streak + 1 : 1;
      const longestStreak = Math.max(newStreak, state.longestStreak);

      saveUserProfile(state.userId, {
        total_sessions: totalSessions,
        total_correct: totalCorrect,
        total_answered: totalAnswered,
        xp: newXp,
        level: newLevel,
        streak: newStreak,
        longest_streak: longestStreak,
        last_practiced_date: today,
      });

      return {
        totalSessions, totalCorrect, totalAnswered,
        xp: newXp, level: newLevel,
        streak: newStreak, longestStreak,
        lastPracticedDate: today,
      };
    });

    if (wasFirstSession) get().earnBadge('first_session');
    logger.success('userStore:recordSession', `סשן הושלם — נכון: ${correct}/${total}, XP+${xpGain}`);
    useAdminStore.getState().logActivity(`סשן הושלם — ${correct}/${total} נכון, XP+${xpGain}`, 'session');
  },

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
