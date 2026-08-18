import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

const allowedRoutes = new Set(['home', 'pro', 'auth/callback', 'auth/reset-password']);

export default function DesktopReturnScreen() {
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const [opened, setOpened] = useState(false);
  const deepLink = useMemo(() => {
    const rawRoute = Array.isArray(params.route) ? params.route[0] : params.route;
    const route = rawRoute && allowedRoutes.has(rawRoute) ? rawRoute : 'home';
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, rawValue]) => {
      if (key === 'route' || rawValue === undefined) return;
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      if (value !== undefined) query.set(key, value);
    });
    const suffix = query.toString();
    return `doit://${route}${suffix ? `?${suffix}` : ''}`;
  }, [params]);

  const openApp = async () => {
    try { await Linking.openURL(deepLink); setOpened(true); } catch { setOpened(false); }
  };

  useEffect(() => { const timer = setTimeout(() => { void openApp(); }, 350); return () => clearTimeout(timer); }, [deepLink]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Screen contentContainerStyle={styles.screen}>
    <Card style={styles.card}>
      <View style={styles.icon}><Ionicons name="open-outline" color={colors.accent} size={30} /></View>
      <View style={styles.copy}><Text variant="eyebrow" color="accent">RETURN TO DOIT AI</Text><Text variant="title">{opened ? 'Opening the desktop app…' : 'Continue in DOIT AI.'}</Text><Text color="secondary">Your browser work is complete. Continue securely in the installed desktop app.</Text></View>
      <Button label="Open DOIT AI" icon="open-outline" onPress={openApp} />
      <Text variant="caption" color="muted">If nothing happens, make sure the desktop app is installed, then press the button again.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({ screen: { alignItems: 'center', justifyContent: 'center' }, card: { gap: spacing.lg, maxWidth: 620, width: '100%' }, icon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.lg, borderWidth: 1, height: 64, justifyContent: 'center', width: 64 }, copy: { gap: spacing.sm } });
