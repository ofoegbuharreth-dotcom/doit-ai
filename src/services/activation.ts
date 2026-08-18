import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVATION_KEY = 'doit:first-run-activation:v1';

export type ActivationPhase = 'goal_captured' | 'plan_ready' | 'completed';

export interface FirstRunActivation {
  phase: ActivationPhase;
  prompt: string;
  startedAt: string;
  goalId?: string;
  taskId?: string;
  completedAt?: string;
}

export async function getFirstRunActivation(): Promise<FirstRunActivation | null> {
  const value = await AsyncStorage.getItem(ACTIVATION_KEY);
  if (!value) return null;
  try { return JSON.parse(value) as FirstRunActivation; } catch { return null; }
}

export async function startFirstRunActivation(prompt: string) {
  const activation: FirstRunActivation = {
    phase: 'goal_captured',
    prompt: prompt.trim(),
    startedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ACTIVATION_KEY, JSON.stringify(activation));
  return activation;
}

export async function markActivationPlanReady(goalId: string, taskId?: string) {
  const current = await getFirstRunActivation();
  if (!current) return;
  await AsyncStorage.setItem(ACTIVATION_KEY, JSON.stringify({ ...current, phase: 'plan_ready', goalId, taskId }));
}

export async function completeFirstRunActivation() {
  const current = await getFirstRunActivation();
  if (!current) return;
  await AsyncStorage.setItem(ACTIVATION_KEY, JSON.stringify({ ...current, phase: 'completed', completedAt: new Date().toISOString() }));
}

export async function clearFirstRunActivation() {
  await AsyncStorage.removeItem(ACTIVATION_KEY);
}
