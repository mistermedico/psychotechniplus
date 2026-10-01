import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserBadge, BadgeType } from '../data/types';
import { supabase } from '../lib/supabase';
import {
  loadUserProfile, saveUserProfile,
  loadUserBadges, saveUserBadge, loadUserElos, saveUserElo,
} from '../lib/db';
import { logger } from '../utils/logger';
import { useAdminStore } from './adminStore';
import { logOutPurchases } from '../lib/purchases';
import { PerformanceLevel, computeAdaptiveLevel, LEVEL_LABELS } from '../utils/adaptive';
import { serverDateKey, previousServerDateKey, normalizeStoredDateKey, effectiveStreak } from '../utils/date';

const GUEST_USER_ID_KEY = '@psychotechniplus/guestUserId';
const GUEST_STATE_KEY = '@psychotechniplus/guestState';
const GUEST_NAME = 'אורח';
const DEFAULT_TARGET_ID = 'target_psychometric';
let userRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let userRealtimeReloadTimer: ReturnType<typeof setTimeout> | null = null;
const USER_REALTIME_DEBOUNCE_MS = 500;

// Set while the store itself is signing out / switching identities, so the
// global onAuthStateChange listener doesn't react to our own auth transitions.
let authTransitionDepth = 0;
export function isUserAuthTransitionInProgress(): boolean {
  return authTransitionDepth > 0;
}
async function withAuthTransition<T>(fn: () => Promise<T>): Promise<T> {
  authTransitionDepth += 1;
  try {
    return await fn();
  } finally {
    authTransitionDepth -= 1;
  }
}

let inflightInitialize: { userId: string; promise: Promise<void> } | null = null;

function isGuestAuthUser(user: { is_anonymous?: boolean; user_metadata?: Record<string, any> } | null | undefined): boolean {
  return !!user && (user.is_anonymous === true || !!user.user_metadata?.guest);
}

// practice_sessions etc. reference user_profiles(id), so guests need a profile row.
async function ensureGuestProfile(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from('user_profiles').upsert(
      {
        id: userId,
        name: GUEST_NAME,
        has_completed_onboarding: true,
        selected_target_id: DEFAULT_TARGET_ID,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) logger.warn('userStore:ensureGuestProfile', 'יצירת פרופיל אורח נכשלה', error.message);
  } catch (e: any) {
    logger.warn('userStore:ensureGuestProfile', 'חריגה ביצירת פרופיל אורח', e?.message);
  }
}

function toTopicPerformance(
  saved: Record<string, { elo: number; history: any[] }>,
): Record<string, TopicPerformance> {
  return Object.entries(saved).reduce<Record<string, TopicPerformance>>((acc, [topicId, value]) => {
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
  }, {});
}

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
  clearLocalSession: () => void;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;

  completeOnboarding: (name: string, targetId: string) => Promise<void>;
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
    // The auth listener and the auth screens may both initialize the same new
    // user; share one in-flight load instead of racing two.
    if (overrideUserId && inflightInitialize?.userId === overrideUserId) {
      return inflightInitialize.promise;
    }
    const promise = (async () => {
    get().stopRealtimeSync();
    set({ isSyncing: true });

    let userId = overrideUserId;
    let sessionEmail = '';
    let sessionIsAnonymous = false;
    let sessionIsGuest = false;

    if (!userId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          userId = session.user.id;
          sessionEmail = session.user.email ?? '';
          sessionIsAnonymous = session.user.is_anonymous === true;
          sessionIsGuest = isGuestAuthUser(session.user);
          logger.info('userStore:initialize', sessionIsGuest ? 'משתמש אורח מאומת בשרת' : `משתמש מחובר: ${sessionEmail}`);
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
        if (session?.user?.id === userId) {
          sessionIsAnonymous = session.user.is_anonymous === true;
          sessionIsGuest = isGuestAuthUser(session.user);
        }
      } catch {}
    }

    if (sessionIsGuest && userId) {
      const rawGuestState = await AsyncStorage.getItem(GUEST_STATE_KEY).catch(() => null);
      let guestState: Partial<UserState> = {};
      try { guestState = rawGuestState ? JSON.parse(rawGuestState) : {}; } catch {}
      await AsyncStorage.setItem(GUEST_USER_ID_KEY, userId).catch(() => null);
      await ensureGuestProfile(userId);
      set({
        ...INITIAL_STATE,
        ...guestState,
        streak: effectiveStreak(guestState.streak, guestState.lastPracticedDate),
        userId,
        email: '',
        name: GUEST_NAME,
        selectedTargetId: DEFAULT_TARGET_ID,
        hasCompletedOnboarding: true,
        isAuthenticated: true,
        isGuest: true,
        isLoaded: true,
        isSyncing: false,
        isPremium: false,
        serverPremium: false,
        purchasePremium: false,
      });
      return;
    }


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
      isPremium: false,
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
        // A store entitlement may have been reported while the profile loaded.
        isPremium: !!profile.is_premium || get().purchasePremium,
        streak: effectiveStreak(profile.streak, profile.last_practiced_date),
        longestStreak: profile.longest_streak,
        lastPracticedDate: profile.last_practiced_date,
        level: profile.level,
        xp: profile.xp,
        totalSessions: profile.total_sessions,
        totalCorrect: profile.total_correct,
        totalAnswered: profile.total_answered,
      });
    }

    // null = load failed: keep what we have rather than wiping history/badges.
    if (badges) set({ badges });
    if (savedTopicPerformance) set({ topicPerformance: toTopicPerformance(savedTopicPerformance) });

    set({ isLoaded: true, isSyncing: false });
    get().startRealtimeSync();
    })();

    if (overrideUserId) inflightInitialize = { userId: overrideUserId, promise };
    try {
      await promise;
    } finally {
      if (inflightInitialize?.promise === promise) inflightInitialize = null;
    }
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

      // The user may have switched accounts while this request was in flight.
      if (get().userId !== state.userId) return;

      const sessionEmail = session?.user?.email ?? state.email;

      set(current => ({
        email: sessionEmail,
        ...(profile ? {
          name: profile.name,
          selectedTargetId: DEFAULT_TARGET_ID,
          hasCompletedOnboarding: profile.has_completed_onboarding,
          serverPremium: !!profile.is_premium,
          isPremium: !!profile.is_premium || current.purchasePremium,
          streak: effectiveStreak(profile.streak, profile.last_practiced_date),
          longestStreak: profile.longest_streak,
          lastPracticedDate: profile.last_practiced_date,
          level: profile.level,
          xp: profile.xp,
          totalSessions: profile.total_sessions,
          totalCorrect: profile.total_correct,
          totalAnswered: profile.total_answered,
        } : {}),
        // null = load failed: keep the current badges/history instead of wiping them.
        ...(badges ? { badges } : {}),
        ...(savedTopicPerformance ? { topicPerformance: toTopicPerformance(savedTopicPerformance) } : {}),
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

  continueAsGuest: async () => withAuthTransition(async () => {
    get().stopRealtimeSync();
    useAdminStore.getState().setIsAdmin(false);

    // Reuse an existing guest identity instead of minting a new one each time,
    // so the guest keeps their server-side quota/progress.
    let guestUserId = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUser = session?.user;
      const savedGuestId = await AsyncStorage.getItem(GUEST_USER_ID_KEY).catch(() => null);
      if (sessionUser?.id && (isGuestAuthUser(sessionUser) || (savedGuestId && savedGuestId === sessionUser.id))) {
        guestUserId = sessionUser.id;
      }
    } catch {}

    if (!guestUserId) {
      await logOutPurchases().catch(() => null);
      await supabase.auth.signOut().catch(() => null);

      const anonymousAttempt = await supabase.auth.signInAnonymously().catch(() => ({ data: { user: null }, error: new Error('anonymous unavailable') } as any));
      if (anonymousAttempt.data?.user?.id) {
        guestUserId = anonymousAttempt.data.user.id;
      } else {
        // Some production projects disable Supabase anonymous sign-ins.
        // Fall back to a server-created throwaway Auth user so quota/RLS still use auth.uid().
        const { data: guestData, error: guestError } = await supabase.functions.invoke('guest-session', { body: {} });
        if (guestError || !guestData?.email || !guestData?.password) {
          throw new Error('לא ניתן לפתוח כרגע מצב אורח מאובטח. נסה שוב בעוד רגע.');
        }
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: guestData.email,
          password: guestData.password,
        });
        if (loginError || !loginData.user?.id) {
          throw new Error('לא ניתן לאמת את סשן האורח.');
        }
        guestUserId = loginData.user.id;
      }
    }
    await AsyncStorage.setItem(GUEST_USER_ID_KEY, guestUserId).catch(() => null);
    await ensureGuestProfile(guestUserId);
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
    const rawGuestState = await AsyncStorage.getItem(GUEST_STATE_KEY).catch(() => null);
    if (rawGuestState) {
      try {
        const guestState = JSON.parse(rawGuestState);
        set(current => ({
          ...current,
          ...guestState,
          streak: effectiveStreak(guestState.streak, guestState.lastPracticedDate),
          userId: guestUserId,
          isAuthenticated: true,
          isGuest: true,
          isLoaded: true,
        }));
      } catch {}
    }
    logger.info('userStore:continueAsGuest', 'משתמש נכנס כאורח מאומת ב-Supabase');
  }),

  signOut: async () => withAuthTransition(async () => {
    get().stopRealtimeSync();
    logger.info('userStore:signOut', 'משתמש התנתק');
    await logOutPurchases().catch(() => null);
    await supabase.auth.signOut().catch(() => null);
    const adminStore = useAdminStore.getState();
    adminStore.logActivity('משתמש התנתק', 'user');
    adminStore.setIsAdmin(false);
    adminStore.stopRealtimeSync();
    set({ ...INITIAL_STATE, isLoaded: true });
  }),

  // Local-only reset used when the Supabase session ends outside our own
  // signOut (expired refresh token, sign-out in another tab, etc.).
  clearLocalSession: () => {
    get().stopRealtimeSync();
    const adminStore = useAdminStore.getState();
    adminStore.setIsAdmin(false);
    adminStore.stopRealtimeSync();
    logOutPurchases().catch(() => null);
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
      await withAuthTransition(async () => {
        await logOutPurchases().catch(() => null);
        await supabase.auth.signOut().catch(() => null);
      });
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


  completeOnboarding: async (name, _targetId) => {
    const targetId = DEFAULT_TARGET_ID;
    const { userId, isGuest } = get();
    // Persist first: if the save fails the caller shows an error and can retry,
    // instead of the user silently losing onboarding on the next load.
    if (userId && !isGuest) {
      await saveUserProfile(userId, {
        name, selected_target_id: targetId, has_completed_onboarding: true,
      });
    }
    set({ name, selectedTargetId: targetId, hasCompletedOnboarding: true });
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

    if (isGuest) {
      const state = get();
      AsyncStorage.getItem(GUEST_STATE_KEY).then(raw => {
        let snapshot: any = {};
        try { snapshot = raw ? JSON.parse(raw) : {}; } catch {}
        snapshot.topicPerformance = state.topicPerformance;
        return AsyncStorage.setItem(GUEST_STATE_KEY, JSON.stringify(snapshot));
      }).catch(() => null);
    }

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
      // Authenticated XP/level is server-authoritative (sessions / trusted RPCs).
      // Guests remain local-only.
      return { xp: newXp, level: newLevel };
    });
  },

  updateStreak: () => {
    set(state => {
      const today = serverDateKey();
      const yesterday = previousServerDateKey();
      const lastPracticedDate = normalizeStoredDateKey(state.lastPracticedDate);
      if (lastPracticedDate === today) return {};
      const newStreak = lastPracticedDate === yesterday ? state.streak + 1 : 1;
      const updates = {
        streak: newStreak,
        longestStreak: Math.max(newStreak, state.longestStreak),
        lastPracticedDate: today,
      };
      // Authenticated streaks are awarded transactionally when a session is
      // persisted. Guests keep this local state only.
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

      const today = serverDateKey();
      const yesterday = previousServerDateKey();
      const lastPracticedDate = normalizeStoredDateKey(state.lastPracticedDate);
      const newStreak = lastPracticedDate === today
        ? state.streak
        : lastPracticedDate === yesterday ? state.streak + 1 : 1;
      const longestStreak = Math.max(newStreak, state.longestStreak);

      // Authenticated totals, XP/level and streak are all persisted by the
      // canonical session trigger. Do not write progress fields directly from
      // the client; this keeps server state tamper-resistant.
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

    if (get().isGuest) {
      const finalState = get();
      const guestSnapshot = {
        topicPerformance: finalState.topicPerformance,
        streak: finalState.streak,
        longestStreak: finalState.longestStreak,
        lastPracticedDate: finalState.lastPracticedDate,
        level: finalState.level,
        xp: finalState.xp,
        totalSessions: finalState.totalSessions,
        totalCorrect: finalState.totalCorrect,
        totalAnswered: finalState.totalAnswered,
        badges: finalState.badges,
      };
      AsyncStorage.setItem(GUEST_STATE_KEY, JSON.stringify(guestSnapshot)).catch(() => null);
    }

    logger.success('userStore:recordSession', `סשן הושלם — נכון: ${correct}/${total}, XP+${xpGain}`);
    useAdminStore.getState().logActivity(`סשן הושלם — ${correct}/${total} נכון, XP+${xpGain}`, 'session');
  },

  claimDailyChallengeBonus: async (challengeId, guestBonusXp) => {
    const { userId, isGuest } = get();
    if (!challengeId) return false;

    if (isGuest) {
      const key = `@psychotechniplus/dailyChallengeClaim/${serverDateKey()}/${challengeId}`;
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
    const { serverPremium, userId, isGuest } = get();
    // Store entitlement may affect purchase UI immediately, but protected
    // catalogue access is still enforced by server RLS/profile entitlement.
    set({
      purchasePremium: val,
      isPremium: serverPremium || val,
    });
    // The purchase layer has just asked the server to sync the entitlement
    // (revenuecat-entitlement); reload the profile so serverPremium reflects it.
    if (!userId || isGuest) return;
    loadUserProfile(userId).then(profile => {
      if (!profile || get().userId !== userId) return;
      set(current => ({
        serverPremium: !!profile.is_premium,
        isPremium: !!profile.is_premium || current.purchasePremium,
      }));
    }).catch(() => null);
  },

  reset: async () => {
    const { userId, isGuest } = get();

    if (isGuest) {
      await AsyncStorage.removeItem(GUEST_STATE_KEY).catch(() => null);
    }

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
