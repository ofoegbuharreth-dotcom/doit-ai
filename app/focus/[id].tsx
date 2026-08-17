import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { clearFocusSession, focusElapsedSeconds, formatFocusTime, loadFocusSession, saveFocusSession, type StoredFocusSession } from '@/services/focus';
import { cancelFocusEndNotification, scheduleFocusEndNotification } from '@/services/notifications';
import { track } from '@/services/observability';
import { finishFocusSessionRecord, isSupabaseConfigured, startFocusSessionRecord } from '@/services/supabase';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

const makeId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
  const value = Math.floor(Math.random() * 16);
  return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
});

export default function FocusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { tasks, goals, completeFocusedTask, replaceTask, replacingTaskId } = useAppStore();
  const task = tasks.find((item) => item.id === id);
  const goal = goals.find((item) => item.id === task?.goalId);
  const [session, setSession] = useState<StoredFocusSession>();
  const sessionRef = useRef<StoredFocusSession | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stuckOpen, setStuckOpen] = useState(false);
  const [blocker, setBlocker] = useState('');
  const [coachReply, setCoachReply] = useState('');

  const setAndSave = useCallback((next: StoredFocusSession) => {
    sessionRef.current = next;
    setSession(next);
    saveFocusSession(next).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!task || task.status === 'completed') return;
    let active = true;
    (async () => {
      const restored = await loadFocusSession(task.id);
      if (!active) return;
      if (restored) {
        sessionRef.current = restored;
        setSession(restored);
        setElapsed(focusElapsedSeconds(restored));
        return;
      }
      const fresh: StoredFocusSession = {
        id: makeId(), taskId: task.id, startedAt: new Date().toISOString(),
        targetSeconds: Math.max(60, task.estimatedMinutes * 60), accumulatedSeconds: 0,
        runningSince: Date.now(), pausedSeconds: 0,
      };
      const notificationId = await scheduleFocusEndNotification(task.title, fresh.targetSeconds).catch(() => undefined);
      const next = { ...fresh, notificationId };
      if (!active) return;
      setAndSave(next);
      track('focus started', { target_minutes: Math.round(fresh.targetSeconds / 60) });
      if (isSupabaseConfigured && user) startFocusSessionRecord({ id: fresh.id, userId: user.id, taskId: task.id, startedAt: fresh.startedAt }).catch(() => undefined);
    })();
    return () => { active = false; };
  }, [setAndSave, task, user]);

  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      const current = sessionRef.current;
      if (!current) return;
      const nextElapsed = focusElapsedSeconds(current);
      setElapsed(nextElapsed);
      if (current.runningSince && nextElapsed >= current.targetSeconds) {
        const finished = { ...current, accumulatedSeconds: nextElapsed, runningSince: null };
        setAndSave(finished);
      }
    };
    refresh();
    const timer = setInterval(refresh, 250);
    const appState = AppState.addEventListener('change', () => {
      const current = sessionRef.current;
      if (current) saveFocusSession(current).catch(() => undefined);
    });
    return () => { clearInterval(timer); appState.remove(); };
  }, [session, setAndSave]);

  const remaining = Math.max(0, (session?.targetSeconds ?? 0) - elapsed);
  const running = Boolean(session?.runningSince);
  const progress = session ? Math.min(1, elapsed / session.targetSeconds) : 0;

  const pause = async () => {
    if (!session || !running) return;
    const now = Date.now();
    const committed = focusElapsedSeconds(session, now);
    const next = { ...session, accumulatedSeconds: committed, runningSince: null, pausedAt: now };
    await cancelFocusEndNotification(session.notificationId).catch(() => undefined);
    setAndSave({ ...next, notificationId: undefined });
  };

  const resume = async () => {
    if (!session || running) return;
    const notificationId = await scheduleFocusEndNotification(task?.title ?? 'Your action', Math.max(1, session.targetSeconds - session.accumulatedSeconds)).catch(() => undefined);
    const now = Date.now();
    const extraPaused = session.pausedAt ? Math.max(0, Math.floor((now - session.pausedAt) / 1000)) : 0;
    setAndSave({ ...session, runningSince: now, pausedAt: undefined, pausedSeconds: session.pausedSeconds + extraPaused, notificationId });
  };

  const addFiveMinutes = async () => {
    if (!session) return;
    await cancelFocusEndNotification(session.notificationId).catch(() => undefined);
    const targetSeconds = session.targetSeconds + 300;
    const notificationId = await scheduleFocusEndNotification(task?.title ?? 'Your action', Math.max(1, targetSeconds - elapsed)).catch(() => undefined);
    const now = Date.now();
    const extraPaused = session.pausedAt ? Math.max(0, Math.floor((now - session.pausedAt) / 1000)) : 0;
    setAndSave({ ...session, targetSeconds, runningSince: now, pausedAt: undefined, pausedSeconds: session.pausedSeconds + extraPaused, accumulatedSeconds: elapsed, notificationId });
  };

  const finish = async () => {
    if (!task || !session || saving) return;
    setSaving(true); setError('');
    const actualMinutes = Math.max(1, Math.ceil(elapsed / 60));
    const result = await completeFocusedTask(task.id, actualMinutes);
    if (result.error) { setError(result.error); setSaving(false); return; }
    await cancelFocusEndNotification(session.notificationId).catch(() => undefined);
    const finalPausedSeconds = session.pausedSeconds + (session.pausedAt ? Math.max(0, Math.floor((Date.now() - session.pausedAt) / 1000)) : 0);
    if (isSupabaseConfigured) await finishFocusSessionRecord(session.id, { endedAt: new Date().toISOString(), pausedSeconds: finalPausedSeconds, actualMinutes, status: 'completed' }).catch(() => undefined);
    await clearFocusSession();
    track('focus completed', { actual_minutes: actualMinutes, target_minutes: Math.round(session.targetSeconds / 60) });
    setDone(true); setSaving(false);
  };

  const askCoach = () => {
    const reason = blocker.trim();
    if (!reason) { setCoachReply('What feels unclear, difficult, or distracting right now? Tell me in your own words.'); return; }
    const lower = reason.toLowerCase();
    if (/don.?t know|unclear|confus|how/.test(lower)) setCoachReply(`Let’s remove the uncertainty. For “${task?.title}”, do only the first visible step described below. Ignore the rest until that is done.`);
    else if (/tired|energy|motivat|can.?t be bothered/.test(lower)) setCoachReply('No guilt. Give this five honest minutes at the easiest possible level. After five, you can stop and it still counts.');
    else if (/big|hard|overwhelm|too much/.test(lower)) setCoachReply('This action is too large for right now. I can replace it with a smaller move that still advances the same goal.');
    else setCoachReply(`I hear you. Put the blocker aside for one tiny attempt: spend five minutes on the easiest part of “${task?.title}”. Then decide whether to continue.`);
  };

  const makeEasier = async () => {
    if (!task) return;
    await pause();
    await replaceTask(task.id, blocker.trim() || 'The action felt too difficult during focus mode');
    if (session) {
      const finalPausedSeconds = session.pausedSeconds + (session.pausedAt ? Math.max(0, Math.floor((Date.now() - session.pausedAt) / 1000)) : 0);
      if (isSupabaseConfigured) await finishFocusSessionRecord(session.id, { endedAt: new Date().toISOString(), pausedSeconds: finalPausedSeconds, actualMinutes: Math.max(0, Math.floor(elapsed / 60)), status: 'abandoned' }).catch(() => undefined);
      await clearFocusSession();
    }
    setStuckOpen(false);
    router.back();
  };

  if (!task) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text variant="heading">Action not found</Text><Button label="Back to Today" onPress={() => router.replace('/(tabs)')} /></View></SafeAreaView>;
  if (task.status === 'completed' && !done) return <SafeAreaView style={styles.safe}><View style={styles.center}><Ionicons name="checkmark-circle" size={56} color={colors.accent} /><Text variant="title">Already complete</Text><Button label="Back to Today" onPress={() => router.replace('/(tabs)')} /></View></SafeAreaView>;

  if (done) return <SafeAreaView style={styles.safe}><View style={styles.complete}><View style={styles.completeIcon}><Ionicons name="checkmark" size={44} color={colors.onAccent} /></View><Text variant="eyebrow" color="accent">FOCUS COMPLETE</Text><Text variant="title" style={styles.completeTitle}>You moved the goal forward.</Text><Text color="secondary" style={styles.centerText}>{Math.max(1, Math.ceil(elapsed / 60))} focused minute{Math.ceil(elapsed / 60) === 1 ? '' : 's'} logged for “{task.title}”.</Text><Button label="See what’s next" icon="arrow-forward" onPress={() => router.replace('/(tabs)')} /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Leave focus mode" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="close" color={colors.textPrimary} size={24} /></Pressable>
        <Text variant="eyebrow" color="accent">DOIT FOCUS</Text>
        <View style={styles.iconSpacer} />
      </View>

      <View style={styles.taskCopy}>
        <Text variant="caption" color="muted">{goal?.title ?? 'TODAY’S ACTION'}</Text>
        <Text variant="title" style={styles.taskTitle}>{task.title}</Text>
        {task.description ? <Text color="secondary" style={styles.description}>{task.description}</Text> : null}
      </View>

      <View style={styles.timerWrap}>
        <View style={[styles.timerRing, !running && styles.timerPaused]}>
          <Text maxFontSizeMultiplier={1} style={styles.timerText}>{formatFocusTime(remaining)}</Text>
          <Text variant="caption" color={running ? 'accent' : 'secondary'}>{remaining === 0 ? 'TIME’S UP' : running ? 'FOCUSING' : 'PAUSED'}</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
        <Text variant="caption" color="muted">{Math.max(1, task.estimatedMinutes)} minute target · {Math.floor(elapsed / 60)} logged</Text>
      </View>

      <View style={styles.controls}>
        {remaining === 0 ? <Button label="Add 5 minutes" icon="add" onPress={addFiveMinutes} /> : <Button label={running ? 'Pause' : 'Resume'} icon={running ? 'pause' : 'play'} onPress={running ? pause : resume} />}
        <Button label={saving ? 'Saving…' : 'Finish action'} disabled={saving} variant="secondary" icon="checkmark" onPress={finish} />
        <Button label="I’m stuck" variant="ghost" icon="chatbubble-ellipses-outline" onPress={async () => { await pause(); setStuckOpen(true); }} />
        {error ? <Text color="danger" variant="caption" style={styles.centerText}>{error}</Text> : null}
      </View>
    </View>

    <Modal visible={stuckOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setStuckOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setStuckOpen(false)} />
        <ScrollView contentContainerStyle={styles.coachContent} keyboardShouldPersistTaps="handled" style={styles.coachCard}>
          <View style={styles.coachHeader}><View style={styles.coachMark}><Ionicons name="chatbubble-ellipses" size={21} color={colors.onAccent} /></View><View style={styles.coachHeading}><Text variant="eyebrow" color="accent">DOIT COACH</Text><Text variant="heading">What’s blocking you?</Text></View></View>
          <Text color="secondary">Tell me normally. I’ll help you make this doable without leaving focus mode.</Text>
          <Input autoFocus multiline label="What’s going on?" placeholder="I don’t know where to start…" value={blocker} onChangeText={(value) => { setBlocker(value); setCoachReply(''); }} />
          <View style={styles.chips}>{['Too big', 'Not sure how', 'No energy'].map((label) => <Pressable key={label} onPress={() => { setBlocker(label); setCoachReply(''); }} style={styles.chip}><Text variant="caption" color="secondary">{label}</Text></Pressable>)}</View>
          {coachReply ? <View style={styles.reply}><Text>{coachReply}</Text>{task.description ? <Text variant="caption" color="accent">First step: {task.description}</Text> : null}</View> : null}
          <Button label={coachReply ? 'Ask again' : 'Ask Coach'} icon="sparkles" onPress={askCoach} />
          <Button label={replacingTaskId ? 'Creating easier action…' : 'Create an easier action'} disabled={Boolean(replacingTaskId)} variant="secondary" icon="git-branch-outline" onPress={makeEasier} />
          <Button label="Return to focus" variant="ghost" onPress={() => setStuckOpen(false)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, shell: { alignSelf: 'center', flex: 1, justifyContent: 'space-between', maxWidth: 560, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, width: '100%' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 60 }, iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, iconSpacer: { width: 44 },
  taskCopy: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm }, taskTitle: { fontSize: 29, lineHeight: 36, textAlign: 'center' }, description: { lineHeight: 24, maxWidth: 440, textAlign: 'center' },
  timerWrap: { alignItems: 'center', gap: spacing.md }, timerRing: { alignItems: 'center', aspectRatio: 1, backgroundColor: colors.accentMuted, borderColor: colors.accent, borderRadius: radius.pill, borderWidth: 3, justifyContent: 'center', maxWidth: 270, width: '68%' }, timerPaused: { backgroundColor: colors.surface, borderColor: colors.border }, timerText: { color: colors.textPrimary, fontFamily: 'Manrope_700Bold', fontSize: 56, letterSpacing: -2, lineHeight: 66 }, track: { backgroundColor: colors.border, borderRadius: radius.pill, height: 6, maxWidth: 330, overflow: 'hidden', width: '82%' }, fill: { backgroundColor: colors.accent, borderRadius: radius.pill, height: '100%' },
  controls: { gap: spacing.sm }, center: { alignItems: 'center', flex: 1, gap: spacing.lg, justifyContent: 'center', padding: spacing.lg }, complete: { alignItems: 'center', alignSelf: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', maxWidth: 500, padding: spacing.xl }, completeIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, height: 84, justifyContent: 'center', marginBottom: spacing.sm, width: 84 }, completeTitle: { fontSize: 32, lineHeight: 39, textAlign: 'center' }, centerText: { textAlign: 'center' },
  overlay: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.lg }, coachCard: { alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, maxHeight: '92%', maxWidth: 520, width: '100%' }, coachContent: { gap: spacing.md, padding: spacing.lg }, coachHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, coachHeading: { flex: 1, gap: spacing.xxs }, coachMark: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, chip: { backgroundColor: colors.surfacePressed, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, reply: { backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
});
