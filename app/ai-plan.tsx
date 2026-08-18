import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { PlanReviewEditor } from '@/components/planning/PlanReviewEditor';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { aiProvider, buildClarificationContext, isGoalPlanClarification, markActivationPlanReady, uniqueClarificationQuestions } from '@/services';
import { track } from '@/services/observability';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';
import type { GoalPlanClarification, GoalPlanResponse } from '@/types';

const stages = ['Understanding your goal…', 'Choosing the right success measure…', 'Building specific milestones and actions…'];

export default function AIPlanScreen() {
  const { activation } = useLocalSearchParams<{ activation?: string }>();
  const isActivation = activation === '1';
  const { draft, generatedPlan, setGeneratedPlan, startGeneratedGoal } = useAppStore();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');
  const [clarification, setClarification] = useState<GoalPlanClarification | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const pulse = useSharedValue(0.7);

  const generate = async (clarificationContext: Record<string, string> = {}) => {
    if (!draft) return router.replace('/create-goal');
    setError('');
    setClarification(null);
    setGeneratedPlan(null);
    setStage(0);
    try {
      const result = await aiProvider.generateGoalPlan(draft.prompt, {
        targetDate: draft.targetDate ?? '',
        currentProgress: draft.currentProgress ?? '',
        availableTime: draft.availableTime ?? '',
        constraints: draft.constraints ?? '',
        ...clarificationContext,
      });
      if (isGoalPlanClarification(result)) {
        const questions = uniqueClarificationQuestions(result.questions);
        setAnswers(questions.map(() => ''));
        setClarification({ ...result, questions });
        return;
      }
      setStage(2);
      setTimeout(() => setGeneratedPlan(result), 300);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : '';
      setError(detail.includes('not configured') ? 'The AI planner is not configured yet.' : 'DOIT couldn’t build that plan. Nothing was saved—please try again.');
    }
  };

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    const timers = [setTimeout(() => setStage(1), 650), setTimeout(() => setStage(2), 1350)];
    generate();
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: pulse.value }] }));

  if (clarification) {
    const complete = answers.every((answer) => answer.trim().length > 0);
    const submitAnswers = () => generate(buildClarificationContext(clarification, answers));
    return <Screen scrollable contentContainerStyle={styles.screen}>
      <ScreenHeader title="A quick check" />
      <Animated.View entering={FadeInDown.duration(280)} style={styles.clarificationHeading}>
        <View style={styles.questionMark}><Ionicons name="chatbubble-ellipses" color={colors.accent} size={25} /></View>
        <Text variant="title">Let’s make the plan fit.</Text>
        <Text color="secondary">{clarification.message}</Text>
      </Animated.View>
      <Card style={styles.questions}>
        {clarification.questions.map((question, index) => <Input key={question} label={question} value={answers[index] ?? ''} onChangeText={(value) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer))} placeholder="Type your answer" />)}
      </Card>
      <Button label="Build My Plan" icon="sparkles" disabled={!complete} onPress={submitAnswers} />
    </Screen>;
  }

  if (!generatedPlan) return <Screen contentContainerStyle={styles.loading}>
    <ScreenHeader title="Building your plan" />
    <View style={styles.loader}>
      <Animated.View style={[styles.pulse, pulseStyle]}><Ionicons name="sparkles" color={colors.accent} size={38} /></Animated.View>
      <Animated.View key={stage} entering={FadeInUp}><Text variant="heading" style={styles.center}>{error || stages[stage]}</Text></Animated.View>
      <Text color="secondary" style={styles.center}>DOIT is reasoning from your outcome to useful work you can actually do.</Text>
      {error ? <Button label="Try again" onPress={() => generate()} /> : null}
    </View>
  </Screen>;

  const start = async () => {
    const plan = isActivation ? withFiveMinuteStarter(generatedPlan) : generatedPlan;
    const created = startGeneratedGoal(plan);
    if (!created) return;
    if (isActivation) {
      await markActivationPlanReady(created.goalId, created.firstTaskId);
      track('activation plan created', { milestone_count: plan.milestones.length, action_count: plan.todayTasks.length });
      router.replace({ pathname: '/activation-action', params: { goalId: created.goalId, taskId: created.firstTaskId } } as never);
      return;
    }
    router.replace({ pathname: '/goal/[id]', params: { id: created.goalId } });
  };
  return <Screen scrollable contentContainerStyle={styles.screen}>
    <ScreenHeader title={isActivation ? 'Your first plan' : 'Your plan'} />
    {isActivation ? <View style={styles.activationProgress}><View style={styles.activationProgressFill} /></View> : null}
    <Animated.View entering={FadeInDown.duration(400)} style={styles.heading}>
      <Text variant="eyebrow" color="accent">{isActivation ? 'STEP 2 OF 3 · REVIEW' : 'HERE’S THE PLAN'}</Text>
      <Text variant="title">{generatedPlan.goal.title}</Text>
      <Text color="secondary">{generatedPlan.goal.description}</Text>
    </Animated.View>
    <PlanReviewEditor plan={generatedPlan} onChange={setGeneratedPlan} />
    <View style={styles.timeline}>{generatedPlan.milestones.map((item, index) => <Animated.View key={`${item.title}-${index}`} entering={FadeInDown.delay(index * 100)} style={styles.milestone}><View style={[styles.number, index === 0 && styles.numberActive]}><Text variant="caption" color={index === 0 ? 'accent' : 'muted'}>{index + 1}</Text></View><View style={styles.milestoneCopy}><Text variant="label">{item.title}</Text><Text variant="caption" color="muted">{item.description}</Text></View></Animated.View>)}</View>
    <Card style={styles.today}>
      <Text variant="eyebrow" color="accent">START TODAY</Text>
      {generatedPlan.todayTasks.map((task, index) => <Animated.View key={`${task.title}-${index}`} entering={FadeInDown.delay(450 + index * 90)} style={styles.task}><Ionicons name="square-outline" color={colors.textMuted} size={20} /><View style={styles.taskCopy}><Text variant="label">{task.title}</Text><Text variant="caption" color="secondary">{task.description}</Text><Text variant="caption" color="muted">{task.estimatedMinutes} min · {task.priority}</Text></View></Animated.View>)}
    </Card>
    <Card style={styles.insight}><Text variant="eyebrow" color="accent">DOIT INSIGHT</Text><Text>{generatedPlan.insight}</Text></Card>
    <Button label={isActivation ? 'Choose my 5-minute move' : 'Start Goal'} icon="arrow-forward" onPress={start} />
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { gap: spacing.lg, paddingTop: spacing.md },
  loader: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  pulse: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accent, borderRadius: radius.xl, borderWidth: 1, height: 104, justifyContent: 'center', marginBottom: spacing.md, width: 104 },
  center: { textAlign: 'center' },
  screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  heading: { gap: spacing.sm, marginTop: spacing.md },
  clarificationHeading: { gap: spacing.sm, marginTop: spacing.md, maxWidth: 680 },
  questionMark: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.md, borderWidth: 1, height: 52, justifyContent: 'center', width: 52 },
  questions: { gap: spacing.md },
  timeline: { gap: spacing.xs },
  milestone: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 68 },
  number: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  numberActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  milestoneCopy: { flex: 1, gap: spacing.xxs },
  today: { backgroundColor: colors.surfaceElevated, gap: spacing.md },
  task: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  taskCopy: { flex: 1, gap: spacing.xs },
  insight: { gap: spacing.sm },
  activationProgress: { backgroundColor: colors.border, borderRadius: radius.pill, height: 5, overflow: 'hidden' },
  activationProgressFill: { backgroundColor: colors.accent, height: '100%', width: '66%' },
});

function withFiveMinuteStarter(plan: GoalPlanResponse): GoalPlanResponse {
  const first = plan.todayTasks[0];
  if (!first || first.estimatedMinutes <= 5) return plan;
  const starter = {
    ...first,
    title: `Start: ${first.title}`,
    description: `${first.description} Work only until you have one visible starting point, then stop.`,
    estimatedMinutes: 5,
    priority: 'high' as const,
  };
  return { ...plan, todayTasks: [starter, ...plan.todayTasks] };
}
