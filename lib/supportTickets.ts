import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SUPPORT_TICKETS_LOCAL_KEY = '@psychotechniplus/support/tickets';
const SUPPORT_GUEST_ID_KEY = '@psychotechniplus/support/guestId';
const SUPPORT_GUEST_SECRET_KEY = '@psychotechniplus/support/guestSecret';

export type SupportTicketStatus = 'open' | 'answered' | 'closed';

export interface SupportTicketMessage {
  id: string;
  author: 'user' | 'admin';
  text: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  isGuest: boolean;
  subject: string;
  status: SupportTicketStatus;
  priority: 'normal' | 'urgent';
  createdAt: string;
  updatedAt: string;
  lastReadByUserAt?: string;
  messages: SupportTicketMessage[];
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTicket(raw: any): SupportTicket | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.userId) return null;
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter((m: any) => m && typeof m.text === 'string' && (m.author === 'user' || m.author === 'admin'))
        .map((m: any) => ({
          id: String(m.id ?? makeId('msg')),
          author: m.author as 'user' | 'admin',
          text: String(m.text),
          createdAt: String(m.createdAt ?? raw.updatedAt ?? new Date().toISOString()),
        }))
    : [];
  if (messages.length === 0) return null;

  return {
    id: String(raw.id),
    userId: String(raw.userId),
    userName: String(raw.userName ?? 'משתמש'),
    userEmail: raw.userEmail ? String(raw.userEmail) : undefined,
    isGuest: Boolean(raw.isGuest),
    subject: String(raw.subject ?? 'פנייה למנהל'),
    status: raw.status === 'closed' || raw.status === 'answered' ? raw.status : 'open',
    priority: raw.priority === 'urgent' ? 'urgent' : 'normal',
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()),
    lastReadByUserAt: raw.lastReadByUserAt ? String(raw.lastReadByUserAt) : undefined,
    messages,
  };
}

function normalizeTickets(raw: unknown): SupportTicket[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeTicket)
    .filter((ticket): ticket is SupportTicket => Boolean(ticket))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function cacheTickets(tickets: SupportTicket[]) {
  await AsyncStorage.setItem(SUPPORT_TICKETS_LOCAL_KEY, JSON.stringify(tickets)).catch(() => null);
}

async function readCachedTickets(): Promise<SupportTicket[]> {
  const raw = await AsyncStorage.getItem(SUPPORT_TICKETS_LOCAL_KEY).catch(() => null);
  if (!raw) return [];
  try {
    return normalizeTickets(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function getGuestCredentials() {
  let guestId = await AsyncStorage.getItem(SUPPORT_GUEST_ID_KEY).catch(() => null);
  if (!guestId) {
    guestId = makeId('guest_support');
    await AsyncStorage.setItem(SUPPORT_GUEST_ID_KEY, guestId).catch(() => null);
  }

  let guestSecret = await AsyncStorage.getItem(SUPPORT_GUEST_SECRET_KEY).catch(() => null);
  if (!guestSecret || guestSecret.length < 20) {
    guestSecret = `support_secret_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(SUPPORT_GUEST_SECRET_KEY, guestSecret).catch(() => null);
  }

  return { guestId, guestSecret };
}

async function hasAuthenticatedUser(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session?.user?.id);
  } catch {
    return false;
  }
}

async function invokeSupport<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('support-tickets', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

async function ownershipPayload() {
  if (await hasAuthenticatedUser()) return {};
  return getGuestCredentials();
}

export async function getSupportUserId(userId: string, isGuest: boolean): Promise<string> {
  if (userId && !isGuest) return userId;
  return (await getGuestCredentials()).guestId;
}

export async function loadSupportTickets(): Promise<SupportTicket[]> {
  try {
    const payload = await ownershipPayload();
    const result = await invokeSupport<{ tickets?: unknown[] }>({ action: 'list', ...payload });
    const normalized = normalizeTickets(result.tickets ?? []);
    await cacheTickets(normalized);
    return normalized;
  } catch {
    return readCachedTickets();
  }
}

export async function createSupportTicket(input: {
  userId: string;
  userName: string;
  userEmail?: string;
  isGuest: boolean;
  subject: string;
  message: string;
  priority?: 'normal' | 'urgent';
}): Promise<SupportTicket> {
  const message = input.message.trim();
  if (!message) throw new Error('אי אפשר לשלוח פנייה ריקה.');

  const payload = input.isGuest ? await getGuestCredentials() : {};
  const result = await invokeSupport<{ ticket?: unknown }>({
    action: 'create',
    ...payload,
    userName: input.userName,
    userEmail: input.userEmail,
    subject: input.subject,
    message,
    priority: input.priority ?? 'normal',
  });
  const ticket = normalizeTicket(result.ticket);
  if (!ticket) throw new Error('השרת לא החזיר פנייה תקינה.');
  return ticket;
}

export async function addSupportTicketMessage(
  ticketId: string,
  _author: 'user' | 'admin',
  text: string,
): Promise<SupportTicket | null> {
  const message = text.trim();
  if (!message) throw new Error('אי אפשר לשמור הודעה ריקה.');
  const payload = await ownershipPayload();
  const result = await invokeSupport<{ ticket?: unknown }>({
    action: 'add_message',
    ticketId,
    message,
    ...payload,
  });
  return normalizeTicket(result.ticket);
}

export async function updateSupportTicket(
  ticketId: string,
  updates: Partial<Pick<SupportTicket, 'status' | 'priority' | 'lastReadByUserAt'>>,
): Promise<SupportTicket | null> {
  const payload = await ownershipPayload();
  const result = await invokeSupport<{ ticket?: unknown }>({
    action: 'update',
    ticketId,
    status: updates.status,
    priority: updates.priority,
    lastReadByUserAt: updates.lastReadByUserAt,
    ...payload,
  });
  return normalizeTicket(result.ticket);
}
