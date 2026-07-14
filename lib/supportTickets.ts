import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAdminState, saveAdminState } from './db';

const SUPPORT_TICKETS_KEY = 'support_tickets';
const SUPPORT_TICKETS_LOCAL_KEY = '@psychotechniplus/support/tickets';
const SUPPORT_GUEST_ID_KEY = '@psychotechniplus/support/guestId';

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

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTicket(raw: any): SupportTicket | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.userId) return null;
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter((m: any) => m && typeof m.text === 'string' && (m.author === 'user' || m.author === 'admin'))
        .map((m: any) => ({
          id: String(m.id ?? makeId('msg')),
          author: m.author,
          text: String(m.text),
          createdAt: String(m.createdAt ?? raw.updatedAt ?? nowIso()),
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
    createdAt: String(raw.createdAt ?? nowIso()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? nowIso()),
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

export async function getSupportUserId(userId: string, isGuest: boolean): Promise<string> {
  if (userId && !isGuest) return userId;
  const existing = await AsyncStorage.getItem(SUPPORT_GUEST_ID_KEY).catch(() => null);
  if (existing) return existing;
  const next = makeId('guest_support');
  await AsyncStorage.setItem(SUPPORT_GUEST_ID_KEY, next).catch(() => null);
  return next;
}

export async function loadSupportTickets(): Promise<SupportTicket[]> {
  const remote = await loadAdminState<SupportTicket[]>(SUPPORT_TICKETS_KEY);
  if (remote) {
    const normalized = normalizeTickets(remote);
    await AsyncStorage.setItem(SUPPORT_TICKETS_LOCAL_KEY, JSON.stringify(normalized)).catch(() => null);
    return normalized;
  }

  const raw = await AsyncStorage.getItem(SUPPORT_TICKETS_LOCAL_KEY).catch(() => null);
  if (!raw) return [];
  try {
    return normalizeTickets(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function persistSupportTickets(tickets: SupportTicket[]) {
  const normalized = normalizeTickets(tickets);
  await AsyncStorage.setItem(SUPPORT_TICKETS_LOCAL_KEY, JSON.stringify(normalized)).catch(() => null);
  await saveAdminState(SUPPORT_TICKETS_KEY, normalized);
  return normalized;
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
  const messageText = input.message.trim();
  if (!messageText) {
    throw new Error('אי אפשר לשלוח פנייה ריקה.');
  }
  const tickets = await loadSupportTickets();
  const timestamp = nowIso();
  const ticket: SupportTicket = {
    id: makeId('ticket'),
    userId: input.userId,
    userName: input.userName.trim() || (input.isGuest ? 'אורח' : 'משתמש'),
    userEmail: input.userEmail?.trim() || undefined,
    isGuest: input.isGuest,
    subject: input.subject.trim() || 'פנייה למנהל',
    priority: input.priority ?? 'normal',
    status: 'open',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastReadByUserAt: timestamp,
    messages: [{
      id: makeId('msg'),
      author: 'user',
      text: messageText,
      createdAt: timestamp,
    }],
  };
  await persistSupportTickets([ticket, ...tickets]);
  return ticket;
}

export async function addSupportTicketMessage(ticketId: string, author: 'user' | 'admin', text: string): Promise<SupportTicket | null> {
  const messageText = text.trim();
  if (!messageText) {
    throw new Error('אי אפשר לשמור הודעה ריקה.');
  }
  const tickets = await loadSupportTickets();
  const timestamp = nowIso();
  let updatedTicket: SupportTicket | null = null;
  const next = tickets.map(ticket => {
    if (ticket.id !== ticketId) return ticket;
    updatedTicket = {
      ...ticket,
      status: author === 'admin' ? 'answered' : 'open',
      updatedAt: timestamp,
      messages: [...ticket.messages, {
        id: makeId('msg'),
        author,
        text: messageText,
        createdAt: timestamp,
      }],
    };
    return updatedTicket;
  });
  await persistSupportTickets(next);
  return updatedTicket;
}

export async function updateSupportTicket(ticketId: string, updates: Partial<Pick<SupportTicket, 'status' | 'priority' | 'lastReadByUserAt'>>): Promise<SupportTicket | null> {
  const tickets = await loadSupportTickets();
  const timestamp = nowIso();
  let updatedTicket: SupportTicket | null = null;
  const next = tickets.map(ticket => {
    if (ticket.id !== ticketId) return ticket;
    updatedTicket = {
      ...ticket,
      ...updates,
      updatedAt: updates.lastReadByUserAt && Object.keys(updates).length === 1 ? ticket.updatedAt : timestamp,
    };
    return updatedTicket;
  });
  await persistSupportTickets(next);
  return updatedTicket;
}
