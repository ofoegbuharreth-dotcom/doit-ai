import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/animations';
import { colors, radius } from '@/theme';

export function ProgressBar({ progress, height = 7 }: { progress: number; height?: number }) {
  const width = useSharedValue(0);
  useEffect(() => { width.value = withTiming(Math.max(0, Math.min(100, progress)), { duration: motion.duration.surface, easing: motion.easing.emphasized }); }, [progress, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <View style={[styles.track, { height }]}><Animated.View style={[styles.fill, style]} /></View>;
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfacePressed, borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { backgroundColor: colors.accent, borderRadius: radius.pill, height: '100%' },
});
