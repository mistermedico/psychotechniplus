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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return json({ error: 'Admin privileges required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!targetUserId) return json({ error: 'Missing userId' }, 400);
    if (targetUserId === user.id) return json({ error: 'Use self account deletion for the current admin' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const [table, column] of [
      ['practice_sessions', 'user_id'],
      ['user_elos', 'user_id'],
      ['user_badges', 'user_id'],
    ] as const) {
      const { error } = await admin.from(table).delete().eq(column, targetUserId);
      if (error) return json({ error: `Failed deleting ${table}: ${error.message}` }, 500);
    }

    const { error: profileError } = await admin.from('user_profiles').delete().eq('id', targetUserId);
    if (profileError) return json({ error: `Failed deleting profile: ${profileError.message}` }, 500);

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ success: true });
  } catch (error: any) {
    return json({ error: error?.message ?? 'Unknown error' }, 500);
  }
});
