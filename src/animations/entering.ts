import { FadeInDown, FadeInRight, FadeOutLeft, FadeOutUp } from 'react-native-reanimated';

import { motion } from './config';

export const staggeredFadeIn = (index = 0) =>
  FadeInDown.delay(index * motion.stagger)
    .duration(motion.duration.reveal)
    .easing(motion.easing.emphasized);

export const surfaceEnter = (index = 0) =>
  FadeInDown.delay(index * motion.stagger)
    .duration(motion.duration.surface)
    .easing(motion.easing.emphasized);

export const detailEnter = FadeInRight.duration(motion.duration.route).easing(motion.easing.emphasized);
export const detailExit = FadeOutLeft.duration(motion.duration.standard).easing(motion.easing.standard);
export const surfaceExit = FadeOutUp.duration(motion.duration.standard).easing(motion.easing.standard);
