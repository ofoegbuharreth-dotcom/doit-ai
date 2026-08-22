import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
const TELEMETRY_KEY = 'doit:product-analytics-enabled';

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn) && !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: false,
  attachStacktrace: true,
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
    if (event.request?.url) event.request.url = event.request.url.split('?')[0];
    return event;
  },
});

export const analytics = posthogKey ? new PostHog(posthogKey, {
  host: posthogHost,
  disabled: __DEV__,
  disableGeoip: true,
  captureAppLifecycleEvents: true,
  enableSessionReplay: false,
  flushAt: 10,
  flushInterval: 10_000,
}) : null;

export type AnalyticsEvent =
  | 'account signed up' | 'account signed in' | 'account signed out'
  | 'password reset requested' | 'password reset completed'
  | 'onboarding viewed' | 'onboarding completed'
  | 'activation started' | 'activation goal submitted' | 'activation plan created' | 'activation first action started' | 'activation completed' | 'activation skipped'
  | 'goal created' | 'focus started' | 'focus completed' | 'product feedback submitted'
  | 'paywall viewed' | 'subscription purchased' | 'subscription restored' | 'subscription management opened'
  | 'share_card_opened' | 'share_card_exported' | 'share_card_shared' | 'share_card_downloaded' | 'share_card_copied' | 'share_card_upgrade_clicked';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean | null | undefined>) {
  const cleanProperties = properties
    ? Object.fromEntries(Object.entries(properties).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined))
    : undefined;
  analytics?.capture(event, cleanProperties);
}

export function trackScreen(pathname: string) {
  analytics?.screen(pathname);
}

export function identifyTelemetryUser(userId?: string) {
  if (userId) {
    Sentry.setUser({ id: userId });
    analytics?.identify(userId);
  } else {
    Sentry.setUser(null);
    analytics?.reset();
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryDsn && !__DEV__) console.error('DOIT production error:', error instanceof Error ? error.message : 'Unknown error');
  Sentry.withScope((scope) => {
    if (context) scope.setContext('doit', context);
    Sentry.captureException(error);
  });
}

export async function getTelemetryEnabled() {
  return (await AsyncStorage.getItem(TELEMETRY_KEY)) !== 'false';
}

export async function setTelemetryEnabled(enabled: boolean) {
  await AsyncStorage.setItem(TELEMETRY_KEY, enabled ? 'true' : 'false');
  if (enabled) await analytics?.optIn(); else await analytics?.optOut();
}

getTelemetryEnabled().then((enabled) => {
  if (!enabled) analytics?.optOut();
}).catch(() => undefined);

export { Sentry };
