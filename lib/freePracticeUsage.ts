import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { localDateKey } from '../utils/date';

const PRACTICE_USAGE_KEY = '@psychotechniplus/practiceUsage';

export interface FreePracticeUsage {
  date: string;
  count: number;
  lastStartedAt: string | null;
}

export interface FreePracticeClaim {
  allowed: boolean;
  reason?: string;
  usage: FreePracticeUsage;
}

export function emptyFreePracticeUsage(): FreePracticeUsage {
  return { date: localDateKey(), count: 0, lastStartedAt: null };
}

export function getFreePracticeBlock(
  usage: FreePracticeUsage,
  dailyLimit: number,
  cooldownMinutes: number,
): string | null {
  const limit = Math.max(1, dailyLimit);
  const current = usage.date === localDateKey() ? usage : emptyFreePracticeUsage();

  if (current.count >= limit) {
    return `הגעת למגבלת ${limit} סשנים חינמיים להיום. אפשר לשדרג לפרימיום או לחזור מחר.`;
  }

  if (cooldownMinutes > 0 && current.lastStartedAt) {
    const lastStarted = new Date(current.lastStartedAt).getTime();
    if (Number.isFinite(lastStarted)) {
      const nextAllowed = lastStarted + cooldownMinutes * 60 * 1000;
      const remainingMs = nextAllowed - Date.now();
      if (remainingMs > 0) {
        return `יש להמתין עוד ${Math.ceil(remainingMs / 60000)} דקות לפני סשן חינמי נוסף.`;
      }
    }
  }

  return null;
}

export async function loadFreePracticeUsage(
  userId: string,
  isGuest: boolean,
): Promise<FreePracticeUsage> {
  if (!userId) return emptyFreePracticeUsage();

  if (isGuest) {
    const raw = await AsyncStorage.getItem(`${PRACTICE_USAGE_KEY}:${userId}`).catch(() => null);
    if (!raw) return emptyFreePracticeUsage();
    try {
      const parsed = JSON.parse(raw) as Partial<FreePracticeUsage>;
      if (parsed.date !== localDateKey()) return emptyFreePracticeUsage();
      return {
        date: parsed.date,
        count: Math.max(0, Number(parsed.count) || 0),
        lastStartedAt: typeof parsed.lastStartedAt === 'string' ? parsed.lastStartedAt : null,
      };
    } catch {
      return emptyFreePracticeUsage();
    }
  }

  const { data, error } = await supabase.rpc('get_my_free_practice_usage');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    date: row?.usage_date ?? localDateKey(),
    count: Math.max(0, Number(row?.session_count) || 0),
    lastStartedAt: row?.last_started_at ?? null,
  };
}

export async function claimFreePracticeSession(input: {
  userId: string;
  isGuest: boolean;
  dailyLimit: number;
  cooldownMinutes: number;
}): Promise<FreePracticeClaim> {
  const { userId, isGuest } = input;
  const dailyLimit = Math.max(1, input.dailyLimit);
  const cooldownMinutes = Math.max(0, input.cooldownMinutes);

  if (isGuest) {
    const current = await loadFreePracticeUsage(userId, true);
    const reason = getFreePracticeBlock(current, dailyLimit, cooldownMinutes);
    if (reason) return { allowed: false, reason, usage: current };

    const next: FreePracticeUsage = {
      date: localDateKey(),
      count: current.count + 1,
      lastStartedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(`${PRACTICE_USAGE_KEY}:${userId}`, JSON.stringify(next));
    return { allowed: true, usage: next };
  }

  if (!userId) {
    return {
      allowed: false,
      reason: 'לא נמצא חשבון משתמש פעיל.',
      usage: emptyFreePracticeUsage(),
    };
  }

  const { data, error } = await supabase.rpc('claim_free_practice_session', {
    p_daily_limit: dailyLimit,
    p_cooldown_minutes: cooldownMinutes,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    reason: row?.reason ?? undefined,
    usage: {
      date: row?.usage_date ?? localDateKey(),
      count: Math.max(0, Number(row?.session_count) || 0),
      lastStartedAt: row?.last_started_at ?? null,
    },
  };
}
