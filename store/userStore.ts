import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserBadge, BadgeType } from '../data/types';
import { supabase } from '../lib/supabase';
import {
  loadUserProfile, saveUserProfile,
  loadUserBadges, saveUserBadge, loadUserElos, saveUserElo,
} from '../lib/db';
import { logger } from '../utils/logger';
import { ADMIN_EMAIL, useAdminStore } from './adminStore';
import { logOutPurchases } from '../lib/purchases';
import { PerformanceLevel, computeAdaptiveLevel, LEVEL_LABELS } from '../utils/adaptive';
import { localDateKey, previousLocalDateKey, normalizeStoredDateKey } from '../utils/date';

const PREMIUM_REVIEW_EMAILS = new Set([
  'apple-review@psychotechniplus.app',
  'apple-review-2026@psychotechniplus.app',
]);

const GUEST_USER_ID_KEY = '@psychotechniplus/guestUserId';
const GUEST_NAME = 'אורח';
const DEFAULT_TARGET_ID = 'target_psychometric';
let userRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let userRealtimeReloadTimer: ReturnType<typeof setTimeout> | null = null;
const USER_REALTIME_DEBOUNCE_MS = 500;

async function getOrCreateGuestUserId(): Promise<string> {
  const saved = await AsyncStorage.getItem(GUEST_USER_ID_KEY).catch(() => null);
  if (saved?.startsWith('guest_')) return saved;
  const id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(GUEST_USER_ID_KEY, id).catch(() => null);
  return id;
}

export interface TopicPerformanceEntry {
  isCorrect: boolean;
  difficulty: number;
  date?: string;
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
  serverPremium: boolean;
  purchasePremium: boolean;

  isLoaded: boolean;
  isSyncing: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  initialize: (overrideUserId?: string) => Promise<void>;
  refreshFromServer: () => Promise<void>;
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;

  completeOnboarding: (name: string, targetId: string) => void;
  recordAnswer: (topicId: string, difficulty: number, isCorrect: boolean) => void;
  addXp: (amount: number) => void;
  updateStreak: () => void;
  earnBadge: (type: BadgeType) => UserBadge;
  claimDailyChallengeBonus: (challengeId: string, guestBonusXp: number) => Promise<boolean>;
  recordSession: (correct: number, total: number) => void;
  getTopicAccuracy: (topicId: string) => number;
  getTopicLevel: (topicId: string) => PerformanceLevel;
  getTopicLevelLabel: (topicId: string) => string;
  setPremium: (val: boolean) => void;
  reset: () => Promise<void>;
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
  serverPremium: false,
  purchasePremium: false,
  isLoaded: false,
  isSyncing: false,
  isAuthenticated: false,
  isGuest: false,
};

function xpForLevel(level: number): number { return level * 100; }

function levelToElo(level: PerformanceLevel): number {
  if (level === 'advanced') return 1600;
  if (level === 'intermediate') return 1300;
  return 1000;
}

function clampDifficulty(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 3;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export const useUserStore = create<UserState>((set, get) => ({
  ...INITIAL_STATE,

  initialize: async (overrideUserId?: string) => {
    if (get().isLoaded && !overrideUserId) return;
    get().stopRealtimeSync();
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

    const isAdminPremium = sessionEmail.toLowerCase() === ADMIN_EMAIL;
    const isReviewPremium = PREMIUM_REVIEW_EMAILS.has(sessionEmail.toLowerCase());
    const shouldForcePremium = isAdminPremium || isReviewPremium;

    // Always clear user-scoped state before hydrating a newly authenticated account.
    // This prevents guest/admin/profile/progress data from leaking between accounts.
    set({
      ...INITIAL_STATE,
      userId,
      email: sessionEmail,
      isAuthenticated: true,
      isGuest: false,
      isLoaded: false,
      isSyncing: true,
      isPremium: shouldForcePremium,
      serverPremium: false,
      purchasePremium: false,
    });

    const [profile, badges, savedTopicPerformance] = await Promise.all([
      loadUserProfile(userId),
      loadUserBadges(userId),
      loadUserElos(userId),
    ]);

    if (profile) {
      set({
        name: profile.name,
        selectedTargetId: DEFAULT_TARGET_ID,
        hasCompletedOnboarding: profile.has_completed_onboarding,
        // Premium is the union of protected server/admin entitlement and
        // store entitlement. The DB trigger prevents regular clients from
        // changing is_premium, so an admin grant is safe to honor on every platform.
        serverPremium: !!profile.is_premium,
        isPremium: shouldForcePremium || !!profile.is_premium,
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

    const topicPerformance = Object.entries(savedTopicPerformance).reduce<Record<string, TopicPerformance>>(
      (acc, [topicId, value]) => {
        const rawHistory = Array.isArray(value.history) ? value.history : [];
        const history = rawHistory
          .filter((entry: any) => typeof entry.isCorrect === 'boolean')
          .map((entry: any) => ({
            isCorrect: !!entry.isCorrect,
            difficulty: clampDifficulty(entry.difficulty),
            date: typeof entry.date === 'string' ? entry.date : undefined,
          }))
          .slice(-40);
        if (history.length === 0) return acc;
        acc[topicId] = {
          history,
          currentLevel: computeAdaptiveLevel(history, 'beginner'),
        };
        return acc;
      },
      {},
    );
    if (Object.keys(topicPerformance).length > 0) set({ topicPerformance });

    set({ isLoaded: true, isSyncing: false });
    get().startRealtimeSync();
  },

  refreshFromServer: async () => {
    const state = get();
    if (!state.userId || state.isGuest || !state.isAuthenticated) return;

    try {
      const [{ data: { session } }, profile, badges, savedTopicPerformance] = await Promise.all([
        supabase.auth.getSession(),
        loadUserProfile(state.userId),
        loadUserBadges(state.userId),
        loadUserElos(state.userId),
      ]);

      const sessionEmail = session?.user?.email ?? state.email;
      const isAdminPremium = sessionEmail.toLowerCase() === ADMIN_EMAIL;
      const isReviewPremium = PREMIUM_REVIEW_EMAILS.has(sessionEmail.toLowerCase());
      const topicPerformance = Object.entries(savedTopicPerformance).reduce<Record<string, TopicPerformance>>(
        (acc, [topicId, value]) => {
          const rawHistory = Array.isArray(value.history) ? value.history : [];
          const history = rawHistory
            .filter((entry: any) => typeof entry.isCorrect === 'boolean')
            .map((entry: any) => ({
              isCorrect: !!entry.isCorrect,
              difficulty: clampDifficulty(entry.difficulty),
              date: typeof entry.date === 'string' ? entry.date : undefined,
            }))
            .slice(-40);
          if (history.length === 0) return acc;
          acc[topicId] = {
            history,
            currentLevel: computeAdaptiveLevel(history, 'beginner'),
          };
          return acc;
        },
        {},
      );

      set(current => ({
        email: sessionEmail,
        ...(profile ? {
          name: profile.name,
          selectedTargetId: DEFAULT_TARGET_ID,
          hasCompletedOnboarding: profile.has_completed_onboarding,
          serverPremium: !!profile.is_premium,
          isPremium: isAdminPremium || isReviewPremium || !!profile.is_premium || current.purchasePremium,
          streak: profile.streak,
          longestStreak: profile.longest_streak,
          lastPracticedDate: profile.last_practiced_date,
          level: profile.level,
          xp: profile.xp,
          totalSessions: profile.total_sessions,
          totalCorrect: profile.total_correct,
          totalAnswered: profile.total_answered,
        } : {}),
        badges,
        topicPerformance,
        isLoaded: true,
        isSyncing: false,
      }));
    } catch (e: any) {
      logger.warn('userStore:refreshFromServer', 'סנכרון נתוני משתמש מהשרת נכשל', e?.message);
    }
  },

  startRealtimeSync: () => {
    const { userId, isGuest, isAuthenticated } = get();
    if (!userId || isGuest || !isAuthenticated || userRealtimeChannel) return;

    const scheduleRefresh = () => {
      if (userRealtimeReloadTimer) clearTimeout(userRealtimeReloadTimer);
      userRealtimeReloadTimer = setTimeout(() => {
        get().refreshFromServer().catch(() => null);
      }, USER_REALTIME_DEBOUNCE_MS);
    };

    userRealtimeChannel = supabase
      .channel(`psychotechniplus-user-sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_elos', filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_sessions', filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') logger.info('userStore:realtime', 'סנכרון משתמש חי פעיל');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('userStore:realtime', `Realtime status: ${status}`);
        }
      });
  },

  stopRealtimeSync: () => {
    if (userRealtimeReloadTimer) {
      clearTimeout(userRealtimeReloadTimer);
      userRealtimeReloadTimer = null;
    }
    if (userRealtimeChannel) {
      supabase.removeChannel(userRealtimeChannel);
      userRealtimeChannel = null;
    }
  },

  continueAsGuest: async () => {
    get().stopRealtimeSync();
    await logOutPurchases().catch(() => null);
    await supabase.auth.signOut().catch(() => null);
    useAdminStore.getState().setIsAdmin(false);
    const guestUserId = await getOrCreateGuestUserId();
    set({
      ...INITIAL_STATE,
      userId: guestUserId,
      email: '',
      name: GUEST_NAME,
      selectedTargetId: DEFAULT_TARGET_ID,
      hasCompletedOnboarding: true,
      isAuthenticated: true,
      isGuest: true,
      isLoaded: true,
      isSyncing: false,
    });
    logger.info('userStore:continueAsGuest', 'משתמש נכנס כאורח ללא הרשמה');
  },

  signOut: async () => {
    get().stopRealtimeSync();
    logger.info('userStore:signOut', 'משתמש התנתק');
    await logOutPurchases().catch(() => null);
    await supabase.auth.signOut().catch(() => null);
    const adminStore = useAdminStore.getState();
    adminStore.logActivity('משתמש התנתק', 'user');
    adminStore.setIsAdmin(false);
    adminStore.stopRealtimeSync();
    set({ ...INITIAL_STATE, isLoaded: true });
  },

  deleteAccount: async () => {
    get().stopRealtimeSync();
    const { userId, isGuest } = get();
    if (isGuest) {
      set({ ...INITIAL_STATE, isLoaded: true });
      return { success: true };
    }
    if (!userId) return { success: false, error: 'No user session' };

    try {
      logger.info('userStore:deleteAccount', `מוחק חשבון: ${userId}`);

      // The Edge Function is the single authority for deletion. Keeping all
      // destructive server operations there avoids a partially-deleted account
      // if a client request fails midway.
      const { data, error } = await supabase.functions.invoke('delete-user', { body: {} });
      if (error) throw error;
      if (data?.success !== true) throw new Error(data?.error ?? 'Account deletion failed');

      logger.success('userStore:deleteAccount', 'נתוני המשתמש וחשבון האימות נמחקו');
      await logOutPurchases().catch(() => null);
      await supabase.auth.signOut().catch(() => null);
      const adminStore = useAdminStore.getState();
      adminStore.setIsAdmin(false);
      adminStore.stopRealtimeSync();
      set({ ...INITIAL_STATE, isLoaded: true });
      return { success: true };
    } catch (e: any) {
      logger.error('userStore:deleteAccount', 'מחיקת החשבון נכשלה', e?.message);
      return { success: false, error: e.message ?? 'Unknown error' };
    }
  },


  completeOnboarding: (name, _targetId) => {
    const targetId = DEFAULT_TARGET_ID;
    set({ name, selectedTargetId: targetId, hasCompletedOnboarding: true });
    const { userId, isGuest } = get();
    if (userId && !isGuest) saveUserProfile(userId, {
      name, selected_target_id: targetId, has_completed_onboarding: true,
    });
    logger.success('userStore:completeOnboarding', `אונבורדינג הושלם — ${name}, מסלול: ${targetId}`);
    useAdminStore.getState().logActivity(`${name} השלים אונבורדינג — מסלול: ${targetId}`, 'user');
  },

  recordAnswer: (topicId, difficulty, isCorrect) => {
    const { topicPerformance, userId, isGuest } = get();
    const current = topicPerformance[topicId] ?? { history: [], currentLevel: 'beginner' as PerformanceLevel };
    const now = new Date().toISOString();
    const newHistory = [...current.history.slice(-39), { isCorrect, difficulty: clampDifficulty(difficulty), date: now }];
    const newLevel = computeAdaptiveLevel(newHistory, current.currentLevel);

    set({
      topicPerformance: {
        ...topicPerformance,
        [topicId]: { history: newHistory, currentLevel: newLevel },
      },
    });

    if (userId && !isGuest) {
      saveUserElo(
        userId,
        topicId,
        levelToElo(newLevel),
        newHistory.map(entry => ({ ...entry, date: entry.date ?? now })),
      );
    }

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
      if (state.userId && !state.isGuest) saveUserProfile(state.userId, { xp: newXp, level: newLevel });
      return { xp: newXp, level: newLevel };
    });
  },

  updateStreak: () => {
    set(state => {
      const today = localDateKey();
      const yesterday = previousLocalDateKey();
      const lastPracticedDate = normalizeStoredDateKey(state.lastPracticedDate);
      if (lastPracticedDate === today) return {};
      const newStreak = lastPracticedDate === yesterday ? state.streak + 1 : 1;
      const updates = {
        streak: newStreak,
        longestStreak: Math.max(newStreak, state.longestStreak),
        lastPracticedDate: today,
      };
      if (state.userId && !state.isGuest) {
        saveUserProfile(state.userId, {
          streak: updates.streak,
          longest_streak: updates.longestStreak,
          last_practiced_date: today,
        });
      }
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
    if (badge.userId && !get().isGuest) saveUserBadge(badge);
    useAdminStore.getState().logActivity(`תג הושג: ${type}`, 'user');
    return badge;
  },

  recordSession: (correct, total) => {
    const wasFirstSession = get().totalSessions === 0;
    const previousLevel = get().level;
    const xpGain = correct * 10 + 20;
    set(state => {
      const totalSessions = state.totalSessions + 1;
      const totalCorrect = state.totalCorrect + correct;
      const totalAnswered = state.totalAnswered + total;

      let newXp = state.xp + xpGain;
      let newLevel = state.level;
      while (newXp >= xpForLevel(newLevel)) { newXp -= xpForLevel(newLevel); newLevel++; }

      const today = localDateKey();
      const yesterday = previousLocalDateKey();
      const lastPracticedDate = normalizeStoredDateKey(state.lastPracticedDate);
      const newStreak = lastPracticedDate === today
        ? state.streak
        : lastPracticedDate === yesterday ? state.streak + 1 : 1;
      const longestStreak = Math.max(newStreak, state.longestStreak);

      if (state.userId && !state.isGuest) {
        // Session totals are maintained transactionally by a DB trigger when
        // practice_sessions is written. Persist only non-session aggregates here.
        // XP/level and session totals are awarded atomically by the
        // practice_sessions INSERT trigger. Persist only date-based streak state.
        saveUserProfile(state.userId, {
          streak: newStreak,
          longest_streak: longestStreak,
          last_practiced_date: today,
        });
      }

      return {
        totalSessions, totalCorrect, totalAnswered,
        xp: newXp, level: newLevel,
        streak: newStreak, longestStreak,
        lastPracticedDate: today,
      };
    });

    const after = get();
    if (wasFirstSession) after.earnBadge('first_session');
    if (total > 0 && correct === total) after.earnBadge('perfect_score');
    if (after.streak >= 7) after.earnBadge('streak_7');
    if (after.streak >= 30) after.earnBadge('streak_30');
    if (after.level > previousLevel) after.earnBadge('level_up');

    logger.success('userStore:recordSession', `סשן הושלם — נכון: ${correct}/${total}, XP+${xpGain}`);
    useAdminStore.getState().logActivity(`סשן הושלם — ${correct}/${total} נכון, XP+${xpGain}`, 'session');
  },

  claimDailyChallengeBonus: async (challengeId, guestBonusXp) => {
    const { userId, isGuest } = get();
    if (!challengeId) return false;

    if (isGuest) {
      const key = `@psychotechniplus/dailyChallengeClaim/${localDateKey()}/${challengeId}`;
      const alreadyClaimed = await AsyncStorage.getItem(key).catch(() => null);
      if (alreadyClaimed) return false;

      const bonus = Math.max(0, Math.min(1000, Math.round(Number(guestBonusXp) || 0)));
      await AsyncStorage.setItem(key, '1').catch(() => null);
      const levelBefore = get().level;
      if (bonus > 0) get().addXp(bonus);
      if (get().level > levelBefore) get().earnBadge('level_up');
      return true;
    }

    if (!userId) return false;
    const { data, error } = await supabase.rpc('claim_daily_challenge_bonus', {
      p_challenge_id: challengeId,
    });
    if (error) {
      logger.error('userStore:claimDailyChallengeBonus', 'קבלת בונוס אתגר יומי נכשלה', error.message);
      return false;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row && Number.isFinite(Number(row.xp)) && Number.isFinite(Number(row.level))) {
      const levelBefore = get().level;
      set({ xp: Number(row.xp), level: Number(row.level) });
      if (Number(row.level) > levelBefore) get().earnBadge('level_up');
    }
    return Boolean(row?.awarded);
  },

  setPremium: (val) => {
    const { email, serverPremium } = get();
    const normalizedEmail = email.toLowerCase();
    const forced = normalizedEmail === ADMIN_EMAIL || PREMIUM_REVIEW_EMAILS.has(normalizedEmail);
    // RevenueCat controls purchasePremium; the protected DB flag controls
    // server/admin grants. Neither source is allowed to erase the other.
    set({
      purchasePremium: val,
      isPremium: forced || serverPremium || val,
    });
  },

  reset: async () => {
    const { userId, isGuest } = get();

    if (userId && !isGuest) {
      try {
        const { error } = await supabase.rpc('reset_my_progress');
        if (error) throw error;
      } catch (e: any) {
        logger.error('userStore:reset', 'איפוס נתוני משתמש נכשל', e?.message);
        throw e;
      }
    }

    set(state => ({
      ...state,
      topicPerformance: {},
      streak: 0,
      longestStreak: 0,
      lastPracticedDate: null,
      level: 1,
      xp: 0,
      badges: [],
      totalSessions: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      isSyncing: false,
      isLoaded: true,
    }));
  }
}));
