import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ADMIN_EMAIL = 'mrmedico111@gmail.com';

type TicketRow = {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  guest_secret_hash: string | null;
  user_name: string;
  user_email: string | null;
  is_guest: boolean;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  priority: 'normal' | 'urgent';
  created_at: string;
  updated_at: string;
  last_read_by_user_at: string | null;
  messages: Array<{ id: string; author: 'user' | 'admin'; text: string; createdAt: string }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toTicket(row: TicketRow) {
  return {
    id: row.id,
    userId: row.user_id ?? row.guest_id ?? '',
    userName: row.user_name,
    userEmail: row.user_email ?? undefined,
    isGuest: row.is_guest,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastReadByUserAt: row.last_read_by_user_at ?? undefined,
    messages: Array.isArray(row.messages) ? row.messages : [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user: { id: string; email?: string | null } | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    try {
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await client.auth.getUser();
      user = data.user ? { id: data.user.id, email: data.user.email } : null;
    } catch {
      user = null;
    }
  }

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const body = await req.json().catch(() => ({}));
  const action = cleanText(body?.action, 40);
  const guestId = cleanText(body?.guestId, 160);
  const guestSecret = cleanText(body?.guestSecret, 256);
  const guestHash = guestSecret ? await sha256(guestSecret) : '';

  async function getTicket(ticketId: string) {
    const { data, error } = await admin.from('support_tickets_secure').select('*').eq('id', ticketId).maybeSingle();
    if (error) throw error;
    return data as TicketRow | null;
  }

  function owns(row: TicketRow) {
    if (isAdmin) return true;
    if (user?.id && !row.is_guest && row.user_id === user.id) return true;
    return Boolean(
      row.is_guest && guestId && guestHash &&
      row.guest_id === guestId && row.guest_secret_hash === guestHash
    );
  }

  try {
    if (action === 'list') {
      let query = admin.from('support_tickets_secure').select('*').order('updated_at', { ascending: false }).limit(500);
      if (!isAdmin) {
        if (user?.id) {
          query = query.eq('user_id', user.id).eq('is_guest', false);
        } else {
          if (!guestId || !guestHash) return json({ tickets: [] });
          query = query.eq('guest_id', guestId).eq('guest_secret_hash', guestHash).eq('is_guest', true);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return json({ tickets: (data ?? []).map(row => toTicket(row as TicketRow)) });
    }

    if (action === 'create') {
      const subject = cleanText(body?.subject, 160) || 'פנייה למנהל';
      const message = cleanText(body?.message, 5000);
      const userName = cleanText(body?.userName, 120) || (user ? 'משתמש' : 'אורח');
      const userEmail = cleanText(body?.userEmail, 254) || null;
      const priority = body?.priority === 'urgent' ? 'urgent' : 'normal';
      if (!message) return json({ error: 'Message is required' }, 400);

      if (!user && (!guestId || guestSecret.length < 20)) {
        return json({ error: 'Guest identity is missing' }, 400);
      }

      if (!user) {
        const { count, error: countError } = await admin
          .from('support_tickets_secure')
          .select('id', { count: 'exact', head: true })
          .eq('guest_id', guestId)
          .eq('guest_secret_hash', guestHash);
        if (countError) throw countError;
        if ((count ?? 0) >= 30) return json({ error: 'Too many open support records for this guest' }, 429);
      }

      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        user_id: user?.id ?? null,
        guest_id: user ? null : guestId,
        guest_secret_hash: user ? null : guestHash,
        user_name: userName,
        user_email: user?.email ?? userEmail,
        is_guest: !user,
        subject,
        status: 'open',
        priority,
        created_at: now,
        updated_at: now,
        last_read_by_user_at: now,
        messages: [{ id: crypto.randomUUID(), author: 'user', text: message, createdAt: now }],
      };

      const { data, error } = await admin.from('support_tickets_secure').insert(row).select('*').single();
      if (error) throw error;
      return json({ ticket: toTicket(data as TicketRow) }, 201);
    }

    if (action === 'add_message') {
      const ticketId = cleanText(body?.ticketId, 160);
      const message = cleanText(body?.message, 5000);
      if (!ticketId || !message) return json({ error: 'ticketId and message are required' }, 400);
      const row = await getTicket(ticketId);
      if (!row) return json({ error: 'Ticket not found' }, 404);
      if (!owns(row)) return json({ error: 'Forbidden' }, 403);

      const messages = Array.isArray(row.messages) ? row.messages.slice(-99) : [];
      const now = new Date().toISOString();
      messages.push({
        id: crypto.randomUUID(),
        author: isAdmin ? 'admin' : 'user',
        text: message,
        createdAt: now,
      });

      const { data, error } = await admin
        .from('support_tickets_secure')
        .update({
          messages,
          status: isAdmin ? 'answered' : 'open',
          updated_at: now,
        })
        .eq('id', ticketId)
        .select('*')
        .single();
      if (error) throw error;
      return json({ ticket: toTicket(data as TicketRow) });
    }

    if (action === 'update') {
      const ticketId = cleanText(body?.ticketId, 160);
      if (!ticketId) return json({ error: 'ticketId is required' }, 400);
      const row = await getTicket(ticketId);
      if (!row) return json({ error: 'Ticket not found' }, 404);
      if (!owns(row)) return json({ error: 'Forbidden' }, 403);

      const updates: Record<string, unknown> = {};
      if (isAdmin) {
        if (['open', 'answered', 'closed'].includes(body?.status)) updates.status = body.status;
        if (['normal', 'urgent'].includes(body?.priority)) updates.priority = body.priority;
      }
      if (body?.lastReadByUserAt && !isAdmin) {
        const date = new Date(String(body.lastReadByUserAt));
        if (!Number.isNaN(date.getTime())) updates.last_read_by_user_at = date.toISOString();
      }
      if (Object.keys(updates).length === 0) return json({ ticket: toTicket(row) });
      if (!('last_read_by_user_at' in updates && Object.keys(updates).length === 1)) {
        updates.updated_at = new Date().toISOString();
      }

      const { data, error } = await admin
        .from('support_tickets_secure')
        .update(updates)
        .eq('id', ticketId)
        .select('*')
        .single();
      if (error) throw error;
      return json({ ticket: toTicket(data as TicketRow) });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error: any) {
    return json({ error: error?.message ?? 'Support request failed' }, 500);
  }
});
