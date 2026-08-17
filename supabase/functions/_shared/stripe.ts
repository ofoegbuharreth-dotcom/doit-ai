// @ts-nocheck -- Shared by Supabase Edge Functions running in Deno.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function stripeRequest(path: string, params?: Record<string, string | number | boolean | undefined>, method: 'GET' | 'POST' = 'POST') {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) throw new Error('Stripe is not configured on the server.');
  const body = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) body.append(key, String(value));
  });
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && body.size ? `?${body.toString()}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Stripe-Version': '2026-06-24.dahlia',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? body : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? `Stripe returned ${response.status}.`);
  return result;
}

export function allowedAppUrl(request: Request) {
  const fallback = (Deno.env.get('APP_URL') ?? 'https://doit-ai.pages.dev').replace(/\/$/, '');
  const origin = request.headers.get('Origin')?.replace(/\/$/, '');
  if (!origin) return fallback;
  try {
    const url = new URL(origin);
    const allowed = url.hostname === 'doit-ai.pages.dev'
      || url.hostname.endsWith('.doit-ai.pages.dev')
      || url.hostname === 'localhost'
      || url.hostname === '127.0.0.1';
    return allowed ? origin : fallback;
  } catch {
    return fallback;
  }
}

export function pricePeriod(price: any): 'monthly' | 'annual' | 'other' {
  if (price?.recurring?.interval === 'month' && Number(price?.recurring?.interval_count ?? 1) === 1) return 'monthly';
  if (price?.recurring?.interval === 'year' && Number(price?.recurring?.interval_count ?? 1) === 1) return 'annual';
  return 'other';
}

export function formatPrice(price: any) {
  const amount = Number(price?.unit_amount ?? 0) / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(price?.currency ?? 'gbp').toUpperCase() }).format(amount);
}
