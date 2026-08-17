import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '@/animations';

type Props = Omit<PressableProps, 'style'> & PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  haptic?: 'none' | 'selection' | 'light';
}>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ children, disabled, haptic = 'selection', onPress, onPressIn, onPressOut, pressedScale = motion.scale.controlPressed, style, ...props }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={(event) => {
        if (haptic === 'selection') Haptics.selectionAsync().catch(() => undefined);
        if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(event);
      }}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, motion.spring.responsive);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, motion.spring.surface);
        onPressOut?.(event);
      }}
      style={[style, disabled && { opacity: 0.45 }, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
