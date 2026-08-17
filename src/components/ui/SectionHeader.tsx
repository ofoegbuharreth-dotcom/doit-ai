import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Text } from './Text';

export function SectionHeader({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <View style={styles.wrapper}>{eyebrow ? <Text variant="eyebrow" color="accent">{eyebrow}</Text> : null}<View style={styles.row}><Text variant="heading">{title}</Text>{detail ? <Text variant="caption" color="muted">{detail}</Text> : null}</View></View>;
}
const styles = StyleSheet.create({ wrapper: { gap: spacing.xs }, row: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' } });
