import { Easing, ReduceMotion } from 'react-native-reanimated';

export const motion = {
  duration: { press: 130, fast: 170, standard: 300, surface: 420, route: 500, reveal: 560 },
  easing: {
    standard: Easing.bezier(0.2, 0.8, 0.2, 1),
    emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  },
  spring: {
    responsive: { damping: 18, stiffness: 260, mass: 0.7, reduceMotion: ReduceMotion.System },
    gentle: { damping: 22, stiffness: 170, mass: 0.9, reduceMotion: ReduceMotion.System },
    surface: { damping: 24, stiffness: 190, mass: 0.86, reduceMotion: ReduceMotion.System },
  },
  scale: { controlPressed: 0.965, cardPressed: 0.985, recessed: 0.955 },
  translate: { subtle: 8, surface: 16 },
  stagger: 70,
} as const;
