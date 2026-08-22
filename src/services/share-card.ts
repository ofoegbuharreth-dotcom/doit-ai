import type { Goal, Milestone, Task } from '@/types';

export type ShareCardFormat = 'square' | 'vertical' | 'landscape';
export type ShareCardTemplate = 'minimal' | 'progress' | 'roadmap' | 'focus' | 'momentum';
export type ShareCardOptions = {
  title: boolean;
  description: boolean;
  progress: boolean;
  milestone: boolean;
  actions: boolean;
  targetDate: boolean;
  branding: boolean;
};

export const SHARE_CARD_FORMATS: Record<ShareCardFormat, { label: string; width: number; height: number }> = {
  square: { label: 'Square post', width: 1080, height: 1080 },
  vertical: { label: 'Story / TikTok', width: 1080, height: 1920 },
  landscape: { label: 'Landscape', width: 1200, height: 630 },
};

export const SHARE_CARD_TEMPLATES: { id: ShareCardTemplate; label: string; max?: boolean }[] = [
  { id: 'minimal', label: 'Minimal' }, { id: 'progress', label: 'Progress' }, { id: 'roadmap', label: 'Roadmap' },
  { id: 'focus', label: 'Focus', max: true }, { id: 'momentum', label: 'Momentum', max: true },
];

export const DEFAULT_SHARE_OPTIONS: ShareCardOptions = { title: true, description: true, progress: true, milestone: true, actions: true, targetDate: true, branding: true };

export function shareCardProgress(goal: Goal) {
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
}

export function currentShareMilestone(milestones: Milestone[]) {
  return [...milestones].sort((a, b) => a.sortOrder - b.sortOrder).find((item) => item.status !== 'completed');
}

export function nextShareActions(tasks: Task[], limit = 3) {
  return tasks.filter((item) => item.status === 'pending' || item.status === 'moved').sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, limit);
}

export function shareCardSummary(goal: Goal, milestones: Milestone[], tasks: Task[]) {
  const progress = shareCardProgress(goal);
  const milestone = currentShareMilestone(milestones);
  const actions = nextShareActions(tasks).map((item) => `• ${item.title}`).join('\n');
  return [`${goal.title} — ${progress}% complete`, milestone ? `Current milestone: ${milestone.title}` : '', actions, 'Built with DOIT AI'].filter(Boolean).join('\n');
}
