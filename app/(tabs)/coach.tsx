import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { VoiceCaptureButton } from '@/components/voice/VoiceCaptureButton';
import { Card, Screen, Text } from '@/components/ui';
import { createActionPreview, type AgentAction, type AgentActionPreview, buildAgentContext, AgentResponseSchema } from '@/services/agent';
import { aiProvider } from '@/services/ai';
import { extractGoalRequest, interpretConversationTurn, type CoachQuestion } from '@/services/coach';
import { useAppStore } from '@/stores';
import { useSubscription } from '@/hooks';
import { answerMaxCoach, buildMaxPortfolio } from '@/services/max';
import { colors, radius, spacing } from '@/theme';
import type { Goal, Task } from '@/types';

type ChatMessage = { id: string; role: 'user' | 'coach'; text: string };
const starters = ['Make today easier', 'Move today’s actions to tomorrow', 'What should I do next?', 'Add an action'];

export default function CoachScreen() {
  const store = useAppStore();
  const { isMax } = useSubscription();
  const maxPortfolio = useMemo(() => buildMaxPortfolio(store.goals, store.tasks, store.milestones, store.focusSessions, store.taskDependencies, { calendarItems: store.calendarItems, weeklyReviews: store.weeklyReviews }), [store.calendarItems, store.focusSessions, store.goals, store.milestones, store.taskDependencies, store.tasks, store.weeklyReviews]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'coach', text: 'Tell me what changed. I can adjust actions, deadlines, and time blocks with you.' }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<{ request: string; preview: AgentActionPreview } | null>(null);
  const [error, setError] = useState('');
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [question, setQuestion] = useState<CoachQuestion | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages, pending, thinking]);

  const send = async (text = input) => {
    const request = text.trim();
    if (!request || thinking || pending) return;
    setInput(''); setError(''); setThinking(true);
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', text: request }]);
    try {
      const maxAnswer = isMax ? answerMaxCoach(request, maxPortfolio) : undefined;
      if (maxAnswer) {
        setQuestion(null);
        setMessages((current) => [...current, { id: `${Date.now()}-max`, role: 'coach', text: maxAnswer }]);
        return;
      }
      const goalPrompt = extractGoalRequest(request);
      if (goalPrompt) {
        setQuestion(null);
        store.setDraft({ prompt: goalPrompt });
        setMessages((current) => [...current, { id: `${Date.now()}-coach`, role: 'coach', text: `Got it. I’m building a plan for “${goalPrompt}” so you can review it before creating the goal.` }]);
        setThinking(false);
        router.push('/ai-plan');
        return;
      }
      const rememberedTask = store.tasks.find((task) => task.id === lastTaskId);
      const resolvedRequest = rememberedTask && /\b(it|that|this)\b/i.test(request) ? `${request} — action: ${rememberedTask.title}` : request;
      const context = buildAgentContext(resolvedRequest, { goals: store.goals, milestones: store.milestones, tasks: store.tasks, checkIns: store.checkIns, activity: store.activity });
      const conversational = interpretConversationTurn(request, context, question, lastTaskId);
      const response = AgentResponseSchema.parse(conversational?.response ?? await aiProvider.interpretAgentRequest(resolvedRequest, context));
      setQuestion(conversational?.question ?? null);
      const preview = createActionPreview(response);
      const directTaskAction = response.actions.find((action) => 'taskId' in action && Boolean(action.taskId));
      const directTaskId = directTaskAction && 'taskId' in directTaskAction ? directTaskAction.taskId : undefined;
      const adjustedTaskId = (response.actions.find((action) => action.type === 'ADJUST_PLAN') as Extract<typeof response.actions[number], { type: 'ADJUST_PLAN' }> | undefined)?.taskChanges[0]?.taskId;
      const referencedTaskId = conversational?.referencedTaskId ?? directTaskId ?? adjustedTaskId ?? context.overdueTasks[0]?.id ?? context.todayTasks[0]?.id;
      if (referencedTaskId) setLastTaskId(referencedTaskId);
      setMessages((current) => [...current, { id: `${Date.now()}-coach`, role: 'coach', text: response.message }]);
      const actionable = response.actions.filter((action) => action.type !== 'GENERATE_INSIGHT');
      if (preview.requiresConfirmation) setPending({ request, preview });
      else if (actionable.length) {
        const result = await store.applyAgentActions(actionable);
        if (result.error) setError(humanizeCoachError(result.error));
      }
    } catch (caught) { setError(humanizeCoachError(caught instanceof Error ? caught.message : 'DOIT Coach could not understand that.')); }
    finally { setThinking(false); }
  };

  const confirm = async () => {
    if (!pending) return;
    const result = await store.applyAgentActions(pending.preview.response.actions);
    if (result.error) setError(humanizeCoachError(result.error));
    else { setQuestion(null); setMessages((current) => [...current, { id: `${Date.now()}-applied`, role: 'coach', text: 'Done — your plan is updated.' }]); }
    setPending(null);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text variant="eyebrow" color="accent">{isMax ? 'DOIT MAX COACH' : 'DOIT COACH'}</Text><Text variant="title" style={styles.coachTitle}>{isMax ? 'See the whole system.' : 'Change the plan.'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Create a new goal" onPress={() => router.push('/create-goal')} style={styles.goalButton}><Ionicons name="add" color={colors.accent} size={22} /></Pressable>
        </View>
        <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.coachBubble]}><Text variant="caption" style={styles.messageText} color={message.role === 'user' ? 'primary' : 'secondary'}>{message.text}</Text></View>)}
          {thinking ? <View style={[styles.bubble, styles.coachBubble, styles.thinking]}><ActivityIndicator color={colors.accent} size="small" /><Text variant="caption" color="muted">Thinking through your plan…</Text></View> : null}
          {pending ? <Card style={styles.preview}>
            <View style={styles.previewHeading}><Ionicons name="sparkles" color={colors.accent} size={18} /><Text variant="heading">Proposed change</Text></View>
            {pending.preview.response.actions.map((action, index) => <View key={`${action.type}-${index}`} style={styles.change}><View style={styles.dot} /><Text variant="caption" color="secondary" style={styles.changeText}>{describeAction(action, store.tasks, store.goals)}</Text></View>)}
            <Text variant="caption" color="muted">Nothing changes until you approve.</Text>
            <View style={styles.previewActions}><Pressable onPress={() => setPending(null)} style={[styles.smallButton, styles.cancel]}><Text variant="label">Cancel</Text></Pressable><Pressable disabled={store.coachSaving} onPress={confirm} style={[styles.smallButton, styles.apply]}><Text variant="label" style={styles.applyLabel}>{store.coachSaving ? 'Applying…' : 'Apply change'}</Text></Pressable></View>
          </Card> : null}
          {error ? <Text variant="caption" color="danger">{error}</Text> : null}
        </ScrollView>
        {!messages.some((message) => message.role === 'user') ? <ScrollView horizontal style={styles.starterRail} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starters}>{(isMax ? ['I only have 30 minutes today', 'Which goal is behind?', 'Fix this week', ...starters] : starters).map((starter) => <Pressable key={starter} onPress={() => starter === 'Add an action' ? setInput('Add an action to ') : send(starter)} style={styles.starter}><Text variant="caption" color="secondary">{starter}</Text></Pressable>)}</ScrollView> : null}
        <View style={styles.composer}>
          <VoiceCaptureButton compact onTranscript={setInput} />
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => send()} editable={!thinking && !pending} maxFontSizeMultiplier={1.1} placeholder="Tell Coach what changed…" placeholderTextColor={colors.textMuted} selectionColor={colors.accent} style={styles.input} />
          <Pressable disabled={!input.trim() || thinking || Boolean(pending)} onPress={() => send()} style={[styles.send, (!input.trim() || thinking || pending) && styles.sendDisabled]}><Ionicons name="arrow-up" color={colors.onAccent} size={20} /></Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, gap: spacing.sm, paddingBottom: spacing.xs, paddingTop: spacing.sm }, header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, headerCopy: { flex: 1, gap: 1, minWidth: 0 }, coachTitle: { fontSize: 22, lineHeight: 27 }, goalButton: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, flexShrink: 0, height: 38, justifyContent: 'center', width: 38 }, chat: { flex: 1 }, chatContent: { gap: spacing.xs, paddingBottom: spacing.sm, paddingTop: spacing.xs }, bubble: { borderRadius: 14, maxWidth: '88%', paddingHorizontal: 12, paddingVertical: 10 }, messageText: { fontSize: 14, lineHeight: 20 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.surfaceElevated, borderBottomRightRadius: 5, borderColor: colors.border, borderWidth: 1 }, coachBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderColor: colors.border, borderWidth: 1 }, thinking: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, preview: { gap: spacing.sm, marginTop: spacing.xs }, previewHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, change: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, dot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 }, changeText: { flex: 1 }, previewActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }, smallButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 }, cancel: { backgroundColor: colors.surfaceElevated }, apply: { backgroundColor: colors.accent, borderColor: colors.accent }, applyLabel: { color: colors.onAccent }, starterRail: { flexGrow: 0, maxHeight: 40 }, starters: { alignItems: 'center', gap: spacing.xs }, starter: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 36, justifyContent: 'center', paddingHorizontal: spacing.md }, composer: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, flexDirection: 'row', gap: 4, padding: 4 }, input: { color: colors.textPrimary, flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 13, minHeight: 40, minWidth: 0, paddingHorizontal: spacing.xs }, send: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 20, flexShrink: 0, height: 40, justifyContent: 'center', width: 40 }, sendDisabled: { opacity: 0.35 },
});

function describeAction(action: AgentAction, tasks: Task[], goals: Goal[]) {
  const taskTitle = 'taskId' in action && action.taskId ? tasks.find((task) => task.id === action.taskId)?.title : undefined;
  switch (action.type) {
    case 'UPDATE_TASK': return action.changes.priority === 'high' ? `Make “${taskTitle ?? 'this action'}” high priority` : `Update “${taskTitle ?? 'this action'}”`;
    case 'RESCHEDULE_TASK': return `Move “${taskTitle ?? 'this action'}” to ${action.newDate}`;
    case 'COMPLETE_TASK': return `Mark “${taskTitle ?? 'this action'}” complete`;
    case 'UPDATE_GOAL': return `Update “${goals.find((goal) => goal.id === action.goalId)?.title ?? 'this goal'}”`;
    case 'ADJUST_PLAN': return `Simplify ${action.taskChanges.length} action${action.taskChanges.length === 1 ? '' : 's'}`;
    case 'CREATE_CALENDAR_BLOCK': return `Time-block “${action.title}”`;
    case 'CREATE_TASK': return `Add “${action.title}” on ${action.scheduledDate}`;
    case 'GENERATE_PLAN': return `Build the plan for ${action.date}`;
    case 'GENERATE_INSIGHT': return 'Review the next best action';
  }
}

function humanizeCoachError(message: string) {
  if (/row-level security|policy|calendar_items|database|postgres/i.test(message)) return 'I opened the calendar, but couldn’t sync that block to DOIT. Your goals and actions are safe — try again in a moment.';
  if (/network|fetch|offline|connection/i.test(message)) return 'I couldn’t reach DOIT right now. Check your connection and try that message again.';
  return message.length > 180 ? 'I couldn’t finish that change. Nothing was lost — try saying it another way.' : message;
}
