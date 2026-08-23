import { isSupabaseConfigured, supabase } from './supabase';

export const DOIT_OWNER_EMAIL = 'ofoegbuharreth@gmail.com';

export type OwnerMetrics = {
  totalUsers: number; signupsToday: number; signups7d: number; signups30d: number;
  activatedUsers: number; activationRate: number; returningUsers7d: number; returnRate7d: number;
  paidSubscribers: number; proSubscribers: number; maxSubscribers: number; activeTrials: number;
  paidConversionRate: number; referredUsers: number; foundingMembers: number;
  feedbackCount: number; newFeedbackCount: number; averageRating: number;
};

export type OwnerDashboard = {
  generatedAt: string;
  metrics: OwnerMetrics;
  dailySignups: { date: string; count: number }[];
  recentUsers: { id: string; email: string; display_name?: string; created_at: string; founding_number?: number; referred: boolean; goal_count: number; plan: string; subscription_status: string; online: boolean; last_seen_at?: string; app_kind?: string }[];
  feedback: { id: string; category: string; rating?: number; message: string; source: string; status: 'new' | 'reviewing' | 'planned' | 'resolved'; created_at: string; user_email: string }[];
};

export type OwnerHealthStatus = 'healthy' | 'degraded' | 'down';
export type OwnerHealth = {
  generatedAt: string;
  overall: OwnerHealthStatus;
  checks: { id: 'auth' | 'database' | 'ai' | 'stripe' | 'email'; status: OwnerHealthStatus; summary: string; latencyMs: number; checkedAt: string }[];
};

export function isOwnerEmail(email?: string | null) {
  return email?.trim().toLowerCase() === DOIT_OWNER_EMAIL;
}

export async function getOwnerDashboard(): Promise<OwnerDashboard> {
  if (!isSupabaseConfigured) throw new Error('The owner dashboard requires a live DOIT account.');
  const [dashboardResult, presenceResult] = await Promise.all([
    supabase.rpc('get_owner_dashboard'),
    supabase.rpc('get_owner_presence'),
  ]);
  if (dashboardResult.error) throw new Error(dashboardResult.error.message.includes('Owner access required') ? 'This dashboard is private.' : dashboardResult.error.message);
  if (presenceResult.error) throw new Error(presenceResult.error.message.includes('Owner access required') ? 'This dashboard is private.' : presenceResult.error.message);
  const dashboard = dashboardResult.data as OwnerDashboard;
  const presence = new Map((presenceResult.data as { userId: string; online: boolean; lastSeenAt?: string; appKind?: string }[] ?? []).map((item) => [item.userId, item]));
  return {
    ...dashboard,
    recentUsers: dashboard.recentUsers.map((item) => {
      const state = presence.get(item.id);
      return { ...item, online: Boolean(state?.online), last_seen_at: state?.lastSeenAt, app_kind: state?.appKind };
    }),
  };
}

export async function getOwnerHealth(): Promise<OwnerHealth> {
  if (!isSupabaseConfigured) throw new Error('Owner health requires a live DOIT account.');
  const { data, error } = await supabase.functions.invoke<OwnerHealth & { error?: string }>('owner-health', { body: {} });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.checks) throw new Error('Owner health returned an invalid response.');
  return data;
}

export async function setOwnerFeedbackStatus(id: string, status: OwnerDashboard['feedback'][number]['status']) {
  const { error } = await supabase.rpc('set_owner_feedback_status', { p_feedback_id: id, p_status: status });
  if (error) throw new Error(error.message);
}
