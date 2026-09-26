import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EventType = 'first_open' | 'signup' | 'purchase';
const ADMIN_EVENTS_KEY = 'admin_events';
const MAX_EVENTS = 2000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function titleFor(type: EventType) {
  if (type === 'first_open') return 'פתיחה ראשונה / התקנה';
  if (type === 'signup') return 'הרשמה חדשה';
  return 'רכישה חדשה';
}
function safeDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 12000) return { note: 'details omitted: payload too large' };
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}

function hasValidPublicApiKey(req: Request) {
  const key = req.headers.get('apikey') ?? '';
  if (!key) return false;
  const legacy = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (key === legacy) return true;
  try {
    const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}';
    const parsed = JSON.parse(raw);
    return Object.values(parsed).some(value => value === key);
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!hasValidPublicApiKey(req)) return json({ ok: false, error: 'Invalid API key' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: 'Server configuration error' }, 500);
  }

  const payload = await req.json().catch(() => null) as any;
  const eventType = clean(payload?.eventType, 30) as EventType;
  if (!['first_open', 'signup', 'purchase'].includes(eventType)) {
    return json({ ok: false, error: 'Missing or invalid eventType' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let caller: any = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await userClient.auth.getUser();
      caller = data.user ?? null;
    } catch {
      caller = null;
    }
  }

  let userId: string | null = null;
  let email: string | null = null;
  let name: string | null = null;

  if (eventType === 'purchase') {
    if (!caller) return json({ ok: false, error: 'Authenticated user required for purchase events' }, 401);
    userId = caller.id;
    email = caller.email ?? null;
    name = clean(payload?.name, 120) || clean(caller.user_metadata?.display_name ?? caller.user_metadata?.full_name, 120) || null;
  } else if (eventType === 'signup') {
    const claimedId = clean(payload?.userId, 80);
    if (!claimedId) return json({ ok: false, error: 'Verified signup userId required' }, 400);
    const { data, error } = await admin.auth.admin.getUserById(claimedId);
    if (error || !data.user) return json({ ok: false, error: 'Signup user could not be verified' }, 400);
    userId = data.user.id;
    email = data.user.email ?? null;
    name = clean(payload?.name, 120) || clean(data.user.user_metadata?.display_name ?? data.user.user_metadata?.full_name, 120) || null;
  } else {
    if (caller) {
      userId = caller.id;
      email = caller.email ?? null;
      name = clean(payload?.name, 120) || clean(caller.user_metadata?.display_name ?? caller.user_metadata?.full_name, 120) || null;
    } else {
      const claimedId = clean(payload?.userId, 120);
      userId = claimedId.startsWith('guest_') ? claimedId : null;
      email = null;
      name = null;
    }
  }

  const { data: currentRow, error: loadError } = await admin
    .from('admin_state').select('value').eq('key', ADMIN_EVENTS_KEY).maybeSingle();
  if (loadError) return json({ ok: false, error: loadError.message }, 500);

  const currentEvents = Array.isArray(currentRow?.value) ? currentRow.value : [];
  const event = {
    id: crypto.randomUUID(),
    eventType,
    title: clean(payload?.title, 180) || titleFor(eventType),
    userId,
    email,
    name,
    platform: clean(payload?.platform, 40) || null,
    appVersion: clean(payload?.appVersion, 80) || null,
    details: safeDetails(payload?.details),
    occurredAt: new Date().toISOString(),
  };

  const nextEvents = [event, ...currentEvents].slice(0, MAX_EVENTS);
  const { error: saveError } = await admin
    .from('admin_state')
    .upsert({ key: ADMIN_EVENTS_KEY, value: nextEvents, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (saveError) return json({ ok: false, error: saveError.message }, 500);
  return json({ ok: true, event });
});
