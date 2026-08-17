import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { captureException } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui';

type State = { error?: Error };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { area: 'root_error_boundary', componentStack: info.componentStack?.slice(0, 4000) });
  }

  private retry = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ error: undefined });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <View style={styles.screen}>
      <View style={styles.mark}><Text style={styles.markText}>D✓</Text></View>
      <Text variant="title" style={styles.center}>DOIT hit an unexpected problem.</Text>
      <Text color="secondary" style={styles.copy}>Your account and saved goals are safe. Reload the app to continue. If this keeps happening, contact support and say what you were doing immediately before this screen appeared.</Text>
      <Pressable accessibilityRole="button" onPress={this.retry} style={styles.retry}><Text variant="label" style={styles.retryText}>Reload DOIT</Text></Pressable>
      <Text variant="caption" color="muted">Support: ofoegbuharreth@gmail.com</Text>
    </View>;
  }
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  mark: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.lg, borderWidth: 1, height: 64, justifyContent: 'center', width: 64 },
  markText: { color: colors.accent, fontFamily: 'Manrope_800ExtraBold', fontSize: 25 },
  center: { textAlign: 'center' },
  copy: { lineHeight: 25, maxWidth: 520, textAlign: 'center' },
  retry: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, justifyContent: 'center', minHeight: 52, minWidth: 180, paddingHorizontal: spacing.lg },
  retryText: { color: colors.onAccent },
});
