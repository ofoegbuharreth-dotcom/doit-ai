import type { ViewStyle } from 'react-native';

export const shadows = {
  none: {} satisfies ViewStyle,
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 4,
  } satisfies ViewStyle,
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 8,
  } satisfies ViewStyle,
} as const;
