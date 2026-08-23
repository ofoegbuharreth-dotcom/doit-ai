// @ts-nocheck -- Supabase Edge Function running in Deno.
import { createClient } from 'npm:@supabase/supabase-js@2';

const OWNER_EMAIL = 'ofoegbuharreth@gmail.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
type HealthStatus = 'healthy' | 'degraded' | 'down';
type HealthCheck = { id: string; status: HealthStatus; summary: string; latencyMs: number; checkedAt: string };

async function timedCheck(id: string, run: () => Promise<{ status?: HealthStatus; summary: string }>): Promise<HealthCheck> {
  const started = performance.now();
  try {
    const result = await run();
    return { id, status: result.status ?? 'healthy', summary: result.summary, latencyMs: Math.round(performance.now() - started), checkedAt: new Date().toISOString() };
  } catch (error) {
    return { id, status: 'down', summary: error instanceof Error ? error.message : 'Service check failed.', latencyMs: Math.round(performance.now() - started), checkedAt: new Date().toISOString() };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization) return json({ error: 'Owner health is not configured.' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication required.' }, 401);
  if (user.email?.trim().toLowerCase() !== OWNER_EMAIL) return json({ error: 'Owner access required.' }, 403);

  const admin = createClient(supabaseUrl, serviceKey);
  const checks = await Promise.all([
    timedCheck('auth', async () => ({ summary: `Supabase Auth verified the owner session.` })),
    timedCheck('database', async () => {
      const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true });
      if (error) throw new Error(`Database check failed: ${error.message}`);
      return { summary: `Database reachable · ${count ?? 0} profiles.` };
    }),
    timedCheck('ai', async () => {
      const key = Deno.env.get('OPENAI_API_KEY');
      if (!key) return { status: 'down', summary: 'OpenAI key is missing.' };
      const response = await fetchWithTimeout('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      if (response.status === 429) return { status: 'degraded', summary: 'OpenAI is reachable, but credits or rate limits need attention.' };
      if (!response.ok) throw new Error(`OpenAI returned ${response.status}.`);
      return { summary: 'OpenAI API reachable and authenticated.' };
    }),
    timedCheck('stripe', async () => {
      const key = Deno.env.get('STRIPE_SECRET_KEY');
      if (!key) return { status: 'down', summary: 'Stripe secret key is missing.' };
      const response = await fetchWithTimeout('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2026-06-24.dahlia' } });
      if (!response.ok) throw new Error(`Stripe returned ${response.status}.`);
      const payload = await response.json();
      const expectedLive = Deno.env.get('STRIPE_LIVE_MODE') === 'true';
      if (expectedLive && payload?.livemode !== true) return { status: 'down', summary: 'Stripe responded in test mode while DOIT expects live mode.' };
      return { summary: `Stripe API reachable · ${payload?.livemode ? 'live' : 'test'} mode.` };
    }),
    timedCheck('email', async () => {
      const key = Deno.env.get('RESEND_API_KEY');
      if (!key) return { status: 'down', summary: 'Resend API key is missing.' };
      const response = await fetchWithTimeout('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
      if (response.status === 403) return { status: 'degraded', summary: 'Resend is configured, but this key cannot perform a domain health check.' };
      if (!response.ok) throw new Error(`Resend returned ${response.status}.`);
      const payload = await response.json();
      const domainCount = Array.isArray(payload?.data) ? payload.data.length : 0;
      return { summary: `Resend reachable · ${domainCount} verified/configured domain${domainCount === 1 ? '' : 's'}.` };
    }),
  ]);

  const overall: HealthStatus = checks.some((check) => check.status === 'down') ? 'down' : checks.some((check) => check.status === 'degraded') ? 'degraded' : 'healthy';
  return json({ generatedAt: new Date().toISOString(), overall, checks });
});

