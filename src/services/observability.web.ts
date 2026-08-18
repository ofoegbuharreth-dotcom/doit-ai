import AsyncStorage from '@react-native-async-storage/async-storage';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const posthogHost = (process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');
const TELEMETRY_KEY = 'doit:product-analytics-enabled';

let telemetryEnabled = true;
let telemetryUserId: string | undefined;

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replaceAll('-', '');
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, '0').slice(0, 32);
}

function sentryEndpoint() {
  if (!sentryDsn) return undefined;
  try {
    const dsn = new URL(sentryDsn);
    const projectId = dsn.pathname.split('/').filter(Boolean).at(-1);
    if (!projectId || !dsn.username) return undefined;
    return `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(dsn.username)}`;
  } catch { return undefined; }
}

function sendSentryEvent(error: unknown, context?: Record<string, unknown>) {
  const endpoint = sentryEndpoint();
  const normalised = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown application error');
  if (!endpoint || __DEV__) {
    if (!__DEV__) console.error('DOIT production error:', normalised.message);
    return;
  }
  const eventId = randomId();
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: 'production',
    release: 'doit-ai-web@1.2.0',
    user: telemetryUserId ? { id: telemetryUserId } : undefined,
    exception: { values: [{ type: normalised.name || 'Error', value: normalised.message }] },
    extra: { stack: normalised.stack?.slice(0, 12000), ...context },
    request: typeof location !== 'undefined' ? { url: `${location.origin}${location.pathname}` } : undefined,
  };
  const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}`;
  fetch(endpoint, { method: 'POST', body: envelope, keepalive: true }).catch(() => undefined);
}

function posthogCapture(event: string, properties?: Record<string, unknown>) {
  if (!posthogKey || !telemetryEnabled || __DEV__) return;
  const body = JSON.stringify({
    api_key: posthogKey,
    event,
    properties: { distinct_id: telemetryUserId ?? 'anonymous', $lib: 'doit-ai-web', ...properties },
    timestamp: new Date().toISOString(),
  });
  fetch(`${posthogHost}/capture/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

export const analytics = posthogKey ? {
  capture: (event: string, properties?: Record<string, unknown>) => posthogCapture(event, properties),
  screen: (path: string) => posthogCapture('$pageview', { $current_url: typeof location !== 'undefined' ? `${location.origin}${path}` : path }),
  identify: (userId: string) => { telemetryUserId = userId; posthogCapture('$identify', { $anon_distinct_id: 'anonymous', $set: {} }); },
  reset: () => { telemetryUserId = undefined; },
  optIn: async () => { telemetryEnabled = true; },
  optOut: async () => { telemetryEnabled = false; },
} : null;

export const Sentry = {
  wrap<T>(component: T) { return component; },
  setUser(user: { id: string } | null) { telemetryUserId = user?.id; },
};

export type AnalyticsEvent =
  | 'account signed up' | 'account signed in' | 'account signed out'
  | 'password reset requested' | 'password reset completed'
  | 'onboarding viewed' | 'onboarding completed'
  | 'activation started' | 'activation goal submitted' | 'activation plan created' | 'activation first action started' | 'activation completed' | 'activation skipped'
  | 'goal created' | 'focus started' | 'focus completed' | 'product feedback submitted'
  | 'paywall viewed' | 'subscription purchased' | 'subscription restored' | 'subscription management opened';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean | null | undefined>) {
  const cleanProperties = properties
    ? Object.fromEntries(Object.entries(properties).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined))
    : undefined;
  analytics?.capture(event, cleanProperties);
}

export function trackScreen(pathname: string) { analytics?.screen(pathname); }

export function identifyTelemetryUser(userId?: string) {
  telemetryUserId = userId;
  if (userId) analytics?.identify(userId); else analytics?.reset();
}

export function captureException(error: unknown, context?: Record<string, unknown>) { sendSentryEvent(error, context); }

export async function getTelemetryEnabled() { return (await AsyncStorage.getItem(TELEMETRY_KEY)) !== 'false'; }

export async function setTelemetryEnabled(enabled: boolean) {
  telemetryEnabled = enabled;
  await AsyncStorage.setItem(TELEMETRY_KEY, enabled ? 'true' : 'false');
  if (enabled) await analytics?.optIn(); else await analytics?.optOut();
}

getTelemetryEnabled().then((enabled) => {
  telemetryEnabled = enabled;
  if (!enabled) analytics?.optOut();
}).catch(() => undefined);

if (typeof window !== 'undefined' && !__DEV__) {
  window.addEventListener('error', (event) => sendSentryEvent(event.error ?? new Error(event.message), { area: 'window_error' }));
  window.addEventListener('unhandledrejection', (event) => sendSentryEvent(event.reason, { area: 'unhandled_promise' }));
}
