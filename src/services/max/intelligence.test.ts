import { describe, expect, it } from 'vitest';
import type { CalendarItem, Goal, Task, TaskDependency, WeeklyReview } from '@/types';
import { answerMaxCoach, buildMaxPortfolio, selectMaxWork } from '.';

const now = new Date('2026-08-22T12:00:00Z');
const goal = (id: string, targetDate?: string): Goal => ({ id, userId: 'u', title: `Goal ${id}`, description: '', status: 'active', targetValue: 100, currentValue: 20, unit: 'units', targetDate, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z' });
const task = (id: string, goalId: string, date: string, minutes = 30, priority: Task['priority'] = 'medium'): Task => ({ id, goalId, userId: 'u', title: `Task ${id}`, description: '', scheduledDate: date, status: 'pending', priority, estimatedMinutes: minutes, aiGenerated: false, createdAt: '2026-08-01T00:00:00Z', moveCount: 0 });

describe('MAX portfolio intelligence', () => {
  it('prioritises overdue deadline work across goals and respects time', () => {
    const portfolio = buildMaxPortfolio([goal('a', '2026-08-24'), goal('b', '2026-10-01')], [task('urgent', 'a', '2026-08-20', 25, 'high'), task('later', 'b', '2026-08-22', 50)], [], [], [], now);
    expect(portfolio.priorities[0]?.task.id).toBe('urgent');
    expect(selectMaxWork(portfolio, 30).map((item) => item.task.id)).toEqual(['urgent']);
    expect(answerMaxCoach('I only have 30 minutes today, what should I do?', portfolio)).toMatch(/Task urgent.*25 min.*overdue/i);
  });

  it('does not recommend a task before its dependency is completed', () => {
    const tasks = [task('design', 'a', '2026-08-22'), task('launch', 'a', '2026-08-22', 20, 'high')];
    const dependencies: TaskDependency[] = [{ id: 'd', userId: 'u', taskId: 'launch', dependsOnTaskId: 'design', createdAt: now.toISOString() }];
    const portfolio = buildMaxPortfolio([goal('a')], tasks, [], [], dependencies, now);
    expect(portfolio.priorities.find((item) => item.task.id === 'launch')?.blocked).toBe(true);
    expect(selectMaxWork(portfolio, 30)[0]?.task.id).toBe('design');
  });

  it('creates reviewable non-destructive rebuild suggestions', () => {
    const portfolio = buildMaxPortfolio([goal('a')], [task('late', 'a', '2026-08-18')], [], [], [], now);
    expect(portfolio.suggestions[0]).toMatchObject({ taskId: 'late', changes: { newDate: '2026-08-22', priority: 'high' } });
    expect(portfolio.suggestions[0]?.impact).toMatch(/nothing|moves/i);
  });

  it('uses fixed calendar load and recent weekly-review evidence', () => {
    const calendar: CalendarItem[] = [{ id: 'c', userId: 'u', title: 'Exam', type: 'event', startTime: '2026-08-22T09:00:00Z', endTime: '2026-08-22T12:00:00Z', isFixed: true, createdAt: now.toISOString(), updatedAt: now.toISOString() }];
    const reviews: WeeklyReview[] = [{ id: 'w', userId: 'u', weekStart: '2026-08-17', weekEnd: '2026-08-23', tasksCompleted: 2, completionRate: 40, minutesSpent: 60, summary: '', wins: [], blockers: ['late shifts'], nextWeekChanges: [], createdAt: now.toISOString() }];
    const portfolio = buildMaxPortfolio([goal('a', '2026-08-24')], [task('recover', 'a', '2026-08-23')], [], [], [], { now, calendarItems: calendar, weeklyReviews: reviews });
    expect(portfolio.overloadedDays[0]).toMatchObject({ date: '2026-08-22', minutes: 180 });
    expect(answerMaxCoach("I'm falling behind. Fix this week.", portfolio)).toMatch(/late shifts/i);
  });
});
