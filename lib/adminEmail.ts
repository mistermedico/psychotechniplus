import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

const FIRST_OPEN_EVENT_KEY = '@psychotechniplus/adminEvents:firstOpenLogged';

type AdminEventType = 'first_open' | 'signup' | 'purchase';

interface AdminEventPayload {
  eventType: AdminEventType;
  title?: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  details?: Record<string, unknown>;
}

function appVersion() {
  return Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? 'unknown';
}

async function wasLogged(key: string) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(key) === '1';
  return (await AsyncStorage.getItem(key)) === '1';
}

async function markLogged(key: string) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, '1');
    return;
  }
  await AsyncStorage.setItem(key, '1');
}

export async function recordAdminEvent(payload: AdminEventPayload): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('log-admin-event', {
      body: {
        ...payload,
        platform: Platform.OS,
        appVersion: appVersion(),
      },
    });
    if (error) {
      logger.warn('adminEvents', `Failed logging ${payload.eventType}`, error.message);
      return false;
    }
    if (data?.ok === false) {
      logger.warn('adminEvents', `Event was not saved for ${payload.eventType}`, data.error);
      return false;
    }
    return true;
  } catch (error: any) {
    logger.warn('adminEvents', `Failed logging ${payload.eventType}`, error?.message);
    return false;
  }
}

export async function notifyFirstOpenOnce(userId?: string | null, email?: string | null): Promise<void> {
  if (await wasLogged(FIRST_OPEN_EVENT_KEY)) return;
  const ok = await recordAdminEvent({
    eventType: 'first_open',
    title: 'פתיחה ראשונה של האפליקציה',
    userId,
    email,
    details: {
      note: 'זה מייצג התקנה או פתיחה ראשונה במכשיר. App Store לא שולח לאפליקציה אירוע הורדה ישיר.',
    },
  });
  if (ok) await markLogged(FIRST_OPEN_EVENT_KEY);
}

export function notifySignup(userId?: string | null, email?: string | null, name?: string | null): void {
  recordAdminEvent({
    eventType: 'signup',
    title: 'משתמש חדש נרשם',
    userId,
    email,
    name,
  });
}

export function notifyPurchase(payload: {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  packageId?: string;
  productIdentifier?: string;
  price?: number;
  priceString?: string;
  isSubscription?: boolean;
  source?: string;
  customerInfo?: unknown;
}): void {
  recordAdminEvent({
    eventType: 'purchase',
    title: 'רכישה חדשה באפליקציה',
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    details: {
      packageId: payload.packageId,
      productIdentifier: payload.productIdentifier,
      price: payload.price,
      priceString: payload.priceString,
      isSubscription: payload.isSubscription,
      source: payload.source,
      customerInfo: payload.customerInfo,
    },
  });
}
