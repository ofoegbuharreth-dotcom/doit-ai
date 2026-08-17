import type { AgentAIProvider } from '@/types';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { EdgeFunctionAIProvider } from './edge-function-provider';
import { MockAIProvider } from './mock-provider';

const localProvider = new MockAIProvider();
const aiMode = process.env.EXPO_PUBLIC_AI_MODE?.trim().toLowerCase() ?? 'hybrid';

// Only goal generation uses the remote model. Every other AI surface keeps its
// existing local behaviour, and goal generation falls back locally when the
// edge function, quota, or model is unavailable.
export const aiProvider: AgentAIProvider = aiMode === 'mock' || !isSupabaseConfigured
  ? localProvider
  : new EdgeFunctionAIProvider(localProvider);
export * from './validation';
export * from './edge-function-provider';
export * from './clarification-session';
