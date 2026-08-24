import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs, router } from 'expo-router';
import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';

import { motion } from '@/animations';
import { Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { colors, radius, shadows, spacing } from '@/theme';

const icons = { home: 'home', goals: 'flag', coach: 'chatbubble-ellipses', activity: 'stats-chart', profile: 'person' } as const;
const labels = { home: 'Home', goals: 'Goals', coach: 'Coach', activity: 'Insights', profile: 'Profile' } as const;

function TabIcon({ name, color, focused, routeName, compact, mobileWeb }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean; routeName: keyof typeof labels; compact: boolean; mobileWeb: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => { scale.value = withSpring(focused ? 1.08 : 1, motion.spring.responsive); }, [focused, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.iconWrap, compact && styles.compactIconWrap, Platform.OS === 'web' && styles.webIconWrap, mobileWeb && styles.mobileWebIconWrap, focused && styles.active, animatedStyle]}>
    <Ionicons name={name} color={color} size={mobileWeb ? 22 : Platform.OS === 'web' ? 23 : compact ? 19 : 21} />
    {Platform.OS === 'web' && !mobileWeb ? <Text style={[styles.webLabel, { color }]}>{labels[routeName]}</Text> : null}
  </Animated.View>;
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { width, height } = useWindowDimensions();
  const compact = width < 380 || height < 560;
  const phone = width < 600;
  const mobileWeb = Platform.OS === 'web' && phone;
  const tablet = width >= 600 && width < 1024;
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Tabs initialRouteName="home" screenOptions={({ route }) => ({
    headerShown: false, tabBarShowLabel: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: [styles.bar, compact && styles.compactBar, tablet && styles.tabletBar, Platform.OS === 'web' && styles.webBar, mobileWeb && styles.mobileWebBar],
    tabBarItemStyle: [styles.item, tablet && styles.tabletItem, Platform.OS === 'web' && styles.webItem, mobileWeb && styles.mobileWebItem],
    sceneStyle: Platform.OS === 'web' ? [styles.webScene, mobileWeb && styles.mobileWebScene] : undefined,
    tabBarHideOnKeyboard: true,
    tabBarIcon: ({ color, focused }) => {
      const routeName = route.name as keyof typeof labels;
      return <TabIcon name={icons[routeName] ?? 'ellipse'} color={color} focused={focused} routeName={routeName} compact={compact} mobileWeb={mobileWeb} />;
    },
  })}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Screen name="index" options={{ href: null }} />
    <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
    <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
    <Tabs.Screen name="activity" options={{ title: 'Insights' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  </Tabs>;
}

export function NewGoalButton() {
  const { width, height } = useWindowDimensions();
  const compact = width < 370;
  const mobileWeb = Platform.OS === 'web' && (width < 680 || height > width * 1.2);
  const small = compact || mobileWeb;
  return <Pressable accessibilityRole="button" accessibilityLabel="Create new goal" onPress={() => router.push('/create-goal')} style={[styles.fab, compact && styles.compactFab, mobileWeb && styles.mobileWebFab]}><Ionicons name="add" color={colors.onAccent} size={small ? 23 : 26} /></Pressable>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopColor: colors.borderSubtle, borderTopWidth: 1, height: 72, paddingBottom: spacing.xs, paddingTop: spacing.xs, ...shadows.floating },
  compactBar: { height: 60, paddingBottom: spacing.xxs, paddingTop: spacing.xxs },
  tabletBar: { alignSelf: 'center', borderColor: colors.border, borderRadius: radius.pill, borderTopWidth: 1, borderWidth: 1, bottom: 12, height: 68, maxWidth: 720, width: '88%' },
  webBar: { alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderTopWidth: 1, borderWidth: 1, bottom: 18, height: 68, maxWidth: 760, paddingBottom: 6, paddingHorizontal: 12, paddingTop: 6, width: '88%' },
  mobileWebBar: { bottom: 8, height: 58, left: '3%', maxWidth: 564, paddingBottom: 4, paddingHorizontal: 4, paddingTop: 4, right: '3%', width: '94%' },
  item: { minHeight: 48 }, webItem: { borderRadius: radius.lg, marginHorizontal: 4, minHeight: 42 },
  tabletItem: { marginHorizontal: 2 }, mobileWebItem: { flex: 1, marginHorizontal: 0, minHeight: 42 },
  iconWrap: { alignItems: 'center', borderRadius: radius.md, height: 42, justifyContent: 'center', width: 54 },
  compactIconWrap: { height: 38, width: 45 },
  webIconWrap: { borderColor: colors.transparent, borderRadius: radius.pill, flexDirection: 'row', gap: 7, height: 42, paddingHorizontal: 14, width: 112 },
  mobileWebIconWrap: { flexDirection: 'column', gap: 0, height: 40, maxWidth: 52, paddingHorizontal: 0, width: '100%' },
  active: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderWidth: 1 },
  webLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 17 },
  webScene: { paddingBottom: 35 },
  mobileWebScene: { paddingBottom: 72 },
  fab: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, bottom: 92, height: 58, justifyContent: 'center', position: 'absolute', right: spacing.lg, width: 58, ...shadows.floating },
  compactFab: { bottom: 78, height: 50, right: spacing.md, width: 50 },
  mobileWebFab: { bottom: 80, height: 50, right: spacing.md, width: 50 },
});
