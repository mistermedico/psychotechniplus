import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PREMIUM_ENTITLEMENTS = ['psychotechniplus Pro', 'premium'];
const SUBSCRIPTION_PRODUCTS = [
  'com.psychotechniplus.premium.weekly',
  'com.psychotechniplus.premium.monthly',
];
const LIFETIME_PRODUCT = 'com.psychotechniplus.premium.lifetime';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isFuture(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

function hasPremium(customerInfo: any): boolean {
  const subscriber = customerInfo?.subscriber ?? {};
  const entitlements = subscriber?.entitlements ?? {};

  for (const key of PREMIUM_ENTITLEMENTS) {
    const entitlement = entitlements?.[key];
    if (!entitlement) continue;
    if (!entitlement.expires_date || isFuture(entitlement.expires_date) || isFuture(entitlement.grace_period_expires_date)) {
      return true;
    }
  }

  const subscriptions = subscriber?.subscriptions ?? {};
  for (const productId of SUBSCRIPTION_PRODUCTS) {
    const subscription = subscriptions?.[productId];
    if (!subscription) continue;
    if (isFuture(subscription.expires_date) || isFuture(subscription.grace_period_expires_date)) return true;
  }

  const nonSubscriptions = subscriber?.non_subscriptions ?? {};
  return Array.isArray(nonSubscriptions?.[LIFETIME_PRODUCT]) && nonSubscriptions[LIFETIME_PRODUCT].length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return json({ error: 'Server configuration error' }, 500);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey || (!apiKey.startsWith('appl_') && !apiKey.startsWith('goog_'))) {
    return json({ error: 'RevenueCat public API key is not configured' }, 400);
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return json({ error: 'RevenueCat lookup failed', status: response.status, detail: detail.slice(0, 240) }, 502);
  }

  const customerInfo = await response.json();
  return json({
    ok: true,
    userId: user.id,
    isPremium: hasPremium(customerInfo),
  });
});
