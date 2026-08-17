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
  recentUsers: { id: string; email: string; display_name?: string; created_at: string; founding_number?: number; referred: boolean; goal_count: number; plan: string; subscription_status: string }[];
  feedback: { id: string; category: string; rating?: number; message: string; source: string; status: 'new' | 'reviewing' | 'planned' | 'resolved'; created_at: string; user_email: string }[];
};

export function isOwnerEmail(email?: string | null) {
  return email?.trim().toLowerCase() === DOIT_OWNER_EMAIL;
}

export async function getOwnerDashboard(): Promise<OwnerDashboard> {
  if (!isSupabaseConfigured) throw new Error('The owner dashboard requires a live DOIT account.');
  const { data, error } = await supabase.rpc('get_owner_dashboard');
  if (error) throw new Error(error.message.includes('Owner access required') ? 'This dashboard is private.' : error.message);
  return data as OwnerDashboard;
}

export async function setOwnerFeedbackStatus(id: string, status: OwnerDashboard['feedback'][number]['status']) {
  const { error } = await supabase.rpc('set_owner_feedback_status', { p_feedback_id: id, p_status: status });
  if (error) throw new Error(error.message);
}
