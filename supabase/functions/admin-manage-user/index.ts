import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ADMIN_EMAIL = 'mrmedico111@gmail.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller || caller.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: 'Admin privileges required' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  if (!userId || !action) return json({ error: 'Missing userId or action' }, 400);
  if (userId === caller.id) return json({ error: 'This action is blocked for the active admin account' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function audit(actionName: string, details: Record<string, unknown> = {}) {
    const { error } = await admin.from('admin_user_audit').insert({
      user_id: userId,
      admin_user_id: caller.id,
      admin_email: caller.email ?? ADMIN_EMAIL,
      action: actionName,
      details,
    });
    if (error) console.error('audit failed', error.message);
  }

  try {
    const { data: lookup, error: lookupError } = await admin.auth.admin.getUserById(userId);
    if (lookupError || !lookup.user) return json({ error: 'User not found' }, 404);
    const target = lookup.user;

    if (
      action === 'suspend_24h' ||
      action === 'suspend_7d' ||
      action === 'suspend_30d' ||
      action === 'suspend_indefinite' ||
      action === 'suspend_custom' ||
      action === 'unsuspend'
    ) {
      let banDuration = 'none';
      if (action === 'suspend_24h') banDuration = '24h';
      if (action === 'suspend_7d') banDuration = '168h';
      if (action === 'suspend_30d') banDuration = '720h';
      if (action === 'suspend_indefinite') banDuration = '876000h';
      if (action === 'suspend_custom') {
        const hours = Math.max(1, Math.min(876000, Math.round(Number(body?.hours) || 0)));
        if (!Number.isFinite(hours) || hours < 1) return json({ error: 'Invalid suspension duration' }, 400);
        banDuration = `${hours}h`;
      }

      const { data, error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
      if (error) throw error;
      await audit(action, { ban_duration: banDuration, banned_until: data.user?.banned_until ?? null });
      return json({ ok: true, action, bannedUntil: data.user?.banned_until ?? null });
    }

    if (action === 'confirm_email') {
      if (target.email_confirmed_at) return json({ ok: true, alreadyConfirmed: true, emailConfirmedAt: target.email_confirmed_at });
      const { data, error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) throw error;
      await audit('confirm_email', { email: data.user?.email ?? target.email ?? null });
      return json({ ok: true, emailConfirmedAt: data.user?.email_confirmed_at ?? new Date().toISOString() });
    }

    if (action === 'resend_verification') {
      const email = normalizeEmail(target.email);
      if (!email) return json({ error: 'User has no email address' }, 400);
      if (target.email_confirmed_at) return json({ error: 'Email is already confirmed' }, 400);

      const publicClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await publicClient.auth.resend({ type: 'signup', email });
      if (error) throw error;
      await audit('resend_verification', { email });
      return json({ ok: true });
    }

    if (action === 'change_email') {
      const newEmail = normalizeEmail(body?.email);
      if (!validEmail(newEmail)) return json({ error: 'Invalid email address' }, 400);
      if (newEmail === normalizeEmail(target.email)) return json({ ok: true, email: newEmail, unchanged: true });

      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });
      if (error) throw error;
      await audit('change_email', { from: target.email ?? null, to: newEmail });
      return json({ ok: true, email: data.user?.email ?? newEmail, emailConfirmedAt: data.user?.email_confirmed_at ?? null });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error: any) {
    return json({ error: error?.message ?? 'Admin user action failed' }, 500);
  }
});