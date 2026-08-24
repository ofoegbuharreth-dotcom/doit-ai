import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useDesktopUpdate } from '@/hooks';
import { compactReleaseSummary, parseDesktopReleaseNotes } from '@/services/release-notes';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui';

export function DesktopReliability() {
  const { isDesktop, state, install } = useDesktopUpdate();
  const [online, setOnline] = useState(true);
  const [dismissedVersion, setDismissedVersion] = useState<string>();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const refresh = () => setOnline(window.navigator.onLine);
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);

  const visible = isDesktop
    && ['available', 'downloading', 'downloaded', 'installing'].includes(state.phase)
    && dismissedVersion !== state.availableVersion;
  const downloading = state.phase === 'downloading';
  const downloaded = state.phase === 'downloaded';
  const installing = state.phase === 'installing';
  const notes = parseDesktopReleaseNotes(state.releaseNotes);
  const summary = compactReleaseSummary(notes.summary);

  return <>
    {!online ? <View accessibilityRole="alert" style={styles.offline}>
      <View style={styles.offlineIcon}><Ionicons name="cloud-offline-outline" color={colors.warning} size={19} /></View>
      <View style={styles.flex}><Text variant="label">You’re offline</Text><Text variant="caption" color="secondary">Your saved plan still works. Cloud changes will sync when your connection returns.</Text></View>
    </View> : null}
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !downloading && !installing && setDismissedVersion(state.availableVersion)}>
      <View style={styles.overlay}>
        <Pressable disabled={downloading || installing} style={StyleSheet.absoluteFill} onPress={() => setDismissedVersion(state.availableVersion)} />
        <Animated.View accessibilityViewIsModal entering={FadeInDown.duration(260).springify().damping(22)} style={styles.dialog}>
          <View style={styles.headingRow}>
            <View style={styles.icon}><Ionicons name={installing ? 'sync' : downloaded ? 'checkmark' : 'arrow-down'} color={colors.onAccent} size={23} /></View>
            <View style={styles.flex}><Text variant="eyebrow" color="accent">DOIT DESKTOP UPDATE</Text><Text variant="title">{installing ? 'Installing and reopening…' : downloaded ? 'Ready to restart.' : downloading ? `Downloading version ${state.availableVersion ?? ''}…` : `Version ${state.availableVersion ?? ''} is available.`}</Text></View>
          </View>
          <Text color="secondary">{installing ? 'No setup wizard is needed. DOIT AI will reopen automatically when the silent update is complete.' : downloaded ? 'Click once and DOIT will close, install the update silently, and reopen itself. Your work is already saved.' : 'DOIT is downloading this update securely in the background. You can keep working.'}</Text>
          <View style={styles.summary}><Text variant="eyebrow" color="accent">WHY UPDATE</Text><Text color="secondary">{summary}</Text></View>
          {notes.highlights.length ? <View style={styles.notes}><Text variant="eyebrow" color="accent">WHAT THIS UPDATE INCLUDES</Text>{notes.highlights.map((highlight) => <View key={highlight} style={styles.note}><View style={styles.noteIcon}><Ionicons name="checkmark" color={colors.accent} size={13} /></View><Text variant="caption" style={styles.flex}>{highlight}</Text></View>)}</View> : null}
          {downloading ? <View style={styles.progressBlock}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${state.percent ?? 0}%` }]} /></View>
            <Text variant="caption" color="secondary">Downloading securely · {state.percent ?? 0}%</Text>
          </View> : null}
          {downloaded ? <Pressable onPress={install} style={styles.primary}>
            <Ionicons name="refresh" color={colors.onAccent} size={19} />
            <Text variant="label" style={styles.primaryText}>Restart DOIT AI</Text>
          </Pressable> : null}
          {!installing ? <Pressable onPress={() => setDismissedVersion(state.availableVersion)} style={styles.later}><Text variant="label" color="secondary">{downloaded ? 'Restart later' : 'Keep working'}</Text></Pressable> : null}
          {!installing ? <Pressable onPress={() => { setDismissedVersion(state.availableVersion); router.push('/version-logs' as never); }} style={styles.logs}><Ionicons name="newspaper-outline" color={colors.textMuted} size={16} /><Text variant="caption" color="muted">View all version logs</Text></Pressable> : null}
        </Animated.View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  offline: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.warning, borderRadius: radius.lg, borderWidth: 1, elevation: 9, flexDirection: 'row', gap: spacing.sm, left: spacing.md, maxWidth: 620, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: 'absolute', right: spacing.md, top: spacing.md, zIndex: 999 },
  offlineIcon: { alignItems: 'center', backgroundColor: colors.warningMuted, borderRadius: radius.pill, height: 38, justifyContent: 'center', width: 38 },
  flex: { flex: 1 },
  overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing.lg, maxWidth: 520, padding: spacing.xl, width: '100%' },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  icon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 50, justifyContent: 'center', width: 50 },
  progressBlock: { gap: spacing.xs },
  progressTrack: { backgroundColor: colors.border, borderRadius: radius.pill, height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.accent, borderRadius: radius.pill, height: '100%' },
  summary: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  notes: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md }, note: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, noteIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, height: 23, justifyContent: 'center', width: 23 },
  primary: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 54, paddingHorizontal: spacing.lg },
  primaryText: { color: colors.onAccent },
  disabled: { opacity: 0.72 },
  later: { alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  logs: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 34 },
});
