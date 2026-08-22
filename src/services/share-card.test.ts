import { describe, expect, it } from 'vitest';

import type { Goal, Milestone, Task } from '@/types';
import { currentShareMilestone, nextShareActions, shareCardProgress, shareCardSummary } from './share-card';

const goal: Goal = { id: 'g1', userId: 'private-user', title: 'Ship my portfolio', description: 'Private notes never appear', status: 'active', targetValue: 10, currentValue: 4, unit: 'projects', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
const milestones: Milestone[] = [{ id: 'm1', goalId: 'g1', title: 'Publish first case study', description: '', targetValue: 5, sortOrder: 1, status: 'current' }];
const tasks: Task[] = [{ id: 't1', userId: 'private-user', goalId: 'g1', title: 'Choose the strongest screenshots', description: 'private', scheduledDate: '2026-01-02', status: 'pending', priority: 'high', estimatedMinutes: 20, aiGenerated: false, createdAt: '2026-01-01', moveCount: 0 }];

describe('shareable plan card model', () => {
  it('calculates bounded progress and selects public plan content', () => {
    expect(shareCardProgress(goal)).toBe(40);
    expect(currentShareMilestone(milestones)?.id).toBe('m1');
    expect(nextShareActions(tasks)).toHaveLength(1);
  });

  it('never puts account identifiers or task descriptions in copied text', () => {
    const summary = shareCardSummary(goal, milestones, tasks);
    expect(summary).toContain('Ship my portfolio — 40% complete');
    expect(summary).not.toContain('private-user');
    expect(summary).not.toContain('Private notes');
  });
});
