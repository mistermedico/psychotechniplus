import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EventType = 'first_open' | 'signup' | 'purchase';

type Payload = {
  eventType?: EventType;
  title?: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  details?: Record<string, unknown>;
};

type AdminEvent = {
  id: string;
  eventType: EventType;
  title: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  platform: string | null;
  appVersion: string | null;
  details: Record<string, unknown>;
  occurredAt: string;
};

const ADMIN_EVENTS_KEY = 'admin_events';
const MAX_EVENTS = 2000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function titleFor(type: EventType) {
  if (type === 'first_open') return 'פתיחה ראשונה / התקנה';
  if (type === 'signup') return 'הרשמה חדשה';
  return 'רכישה חדשה';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'Supabase service role is not configured' }, 500);
  }

  const payload = await req.json().catch(() => null) as Payload | null;
  if (!payload?.eventType || !['first_open', 'signup', 'purchase'].includes(payload.eventType)) {
    return json({ ok: false, error: 'Missing or invalid eventType' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: currentRow, error: loadError } = await supabase
    .from('admin_state')
    .select('value')
    .eq('key', ADMIN_EVENTS_KEY)
    .maybeSingle();

  if (loadError) return json({ ok: false, error: loadError.message }, 500);

  const currentEvents = Array.isArray(currentRow?.value) ? currentRow.value as AdminEvent[] : [];
  const event: AdminEvent = {
    id: crypto.randomUUID(),
    eventType: payload.eventType,
    title: payload.title?.trim() || titleFor(payload.eventType),
    userId: payload.userId ?? null,
    email: payload.email ?? null,
    name: payload.name ?? null,
    platform: payload.platform ?? null,
    appVersion: payload.appVersion ?? null,
    details: payload.details ?? {},
    occurredAt: new Date().toISOString(),
  };

  const nextEvents = [event, ...currentEvents].slice(0, MAX_EVENTS);
  const { error: saveError } = await supabase
    .from('admin_state')
    .upsert({ key: ADMIN_EVENTS_KEY, value: nextEvents, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (saveError) return json({ ok: false, error: saveError.message }, 500);
  return json({ ok: true, event });
});
