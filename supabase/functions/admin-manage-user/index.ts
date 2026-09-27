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

  try {
    const { data: lookup, error: lookupError } = await admin.auth.admin.getUserById(userId);
    if (lookupError || !lookup.user) return json({ error: 'User not found' }, 404);

    if (action === 'suspend_24h' || action === 'suspend_7d' || action === 'suspend_indefinite' || action === 'unsuspend') {
      const banDuration =
        action === 'suspend_24h' ? '24h' :
        action === 'suspend_7d' ? '168h' :
        action === 'suspend_indefinite' ? '876000h' :
        'none';

      const { data, error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
      if (error) throw error;
      return json({
        ok: true,
        action,
        bannedUntil: data.user?.banned_until ?? null,
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error: any) {
    return json({ error: error?.message ?? 'Admin user action failed' }, 500);
  }
});
