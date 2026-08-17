import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { WebLanding } from '@/components/web/WebLanding';
import { useAuth } from '@/hooks';
import { doitLogo } from '@/constants/logo';
import { colors, radius, spacing } from '@/theme';
import { captureReferralCode } from '@/services';

export default function Index() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const { user, loading } = useAuth(); const [seen, setSeen] = useState<boolean | null>(null); const opacity = useSharedValue(0.45);
  useEffect(() => { AsyncStorage.getItem('doit:onboarding-seen').then((value) => setSeen(value === 'true')).catch(() => setSeen(false)); opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [opacity]);
  useEffect(() => { if (params.ref) void captureReferralCode(params.ref); }, [params.ref]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (loading || seen === null) return <View style={styles.screen}><Animated.Image source={doitLogo} resizeMode="contain" style={[styles.mark, style]} /><Text variant="eyebrow" color="accent">DOIT AI</Text></View>;
  if (user) return <Redirect href="/(tabs)/home" />;
  const isDesktopApp = Platform.OS === 'web' && typeof window !== 'undefined' && window.doitDesktop?.isDesktop;
  if (Platform.OS === 'web' && !isDesktopApp) return <WebLanding />;
  return <Redirect href={seen ? '/(auth)/login' : '/(auth)/welcome'} />;
}

const styles = StyleSheet.create({ screen: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center' }, mark: { borderRadius: radius.lg, height: 84, width: 84 } });
