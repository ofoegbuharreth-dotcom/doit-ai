import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { AccentProvider, colors, useAccentTheme } from '@/theme';
import { AuthProvider, DeviceSessionsProvider, SubscriptionProvider, useAuth } from '@/hooks';
import { AppStoreProvider } from '@/stores';
import { Sentry, identifyTelemetryUser, trackScreen } from '@/services/observability';
import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';
import { DesktopReliability } from '@/components/system/DesktopReliability';
import { PresenceHeartbeat } from '@/components/system/PresenceHeartbeat';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function TelemetryBridge() {
  const pathname = usePathname();
  const { user } = useAuth();
  useEffect(() => { identifyTelemetryUser(user?.id); }, [user?.id]);
  useEffect(() => { if (pathname) trackScreen(pathname); }, [pathname]);
  return null;
}

function AppProviders() {
  const { colorMode, palette } = useAccentTheme();
  const baseTheme = colorMode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.accent,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.textPrimary,
    },
  };
  return <AuthProvider>
    <DeviceSessionsProvider>
      <TelemetryBridge />
      <PresenceHeartbeat />
      <SubscriptionProvider>
        <AppStoreProvider>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style={colorMode === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'simple_push', gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <DesktopReliability />
          </ThemeProvider>
        </AppStoreProvider>
      </SubscriptionProvider>
    </DeviceSessionsProvider>
  </AuthProvider>;
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular: require('../node_modules/@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
    Manrope_500Medium: require('../node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'),
    Manrope_600SemiBold: require('../node_modules/@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf'),
    Manrope_700Bold: require('../node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf'),
    Manrope_800ExtraBold: require('../node_modules/@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return <AppErrorBoundary><AccentProvider><AppProviders /></AccentProvider></AppErrorBoundary>;
}

export default Sentry.wrap(RootLayout);
