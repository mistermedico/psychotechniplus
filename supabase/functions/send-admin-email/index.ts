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
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: 'Admin privileges required' }, 403);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) return json({ ok: false, error: 'RESEND_API_KEY is not configured' }, 200);

  const payload = await req.json().catch(() => ({})) as any;
  const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 180) : 'הודעת מערכת';
  const bodyText = typeof payload?.message === 'string' ? payload.message.trim().slice(0, 8000) : JSON.stringify(payload ?? {}).slice(0, 8000);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('ADMIN_EMAIL_FROM') ?? 'PsychoTechni Plus <onboarding@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `פסיכוטכני פלוס - ${title}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>${escapeHtml(title)}</h2><pre style="white-space:pre-wrap">${escapeHtml(bodyText)}</pre></div>`,
    }),
  });

  const result = await response.json().catch(() => ({}));
  return json({ ok: response.ok, result }, response.ok ? 200 : 502);
});
