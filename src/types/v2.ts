import type { GoalStatus, TaskPriority } from './domain';

export type EnergyLevel = 'low' | 'medium' | 'high';
export type SchedulingFlexibility = 'fixed' | 'flexible' | 'anytime';
export type CalendarItemType = 'task' | 'focus' | 'event' | 'break' | 'deadline';
export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'selected_days' | 'monthly';

export interface CalendarItem {
  id: string; userId: string; title: string; type: CalendarItemType; startTime: string; endTime: string;
  goalId?: string; taskId?: string; isFixed: boolean; createdAt: string; updatedAt: string;
}

export interface RecurrenceRule {
  id: string; userId: string; frequency: RecurrenceFrequency; interval: number; daysOfWeek?: number[];
  dayOfMonth?: number; startsOn: string; endsOn?: string; timezone: string; createdAt: string; updatedAt: string;
}

export interface TaskDependency { id: string; userId: string; taskId: string; dependsOnTaskId: string; createdAt: string }

export interface UserPreferences {
  id: string; userId: string; preferredWorkMinutes: number; preferredStartTime?: string; preferredEndTime?: string;
  availableDays: number[]; energyPattern: Partial<Record<'morning' | 'afternoon' | 'evening', EnergyLevel>>;
  planningStyle: 'light' | 'balanced' | 'ambitious'; createdAt: string; updatedAt: string;
}

export interface InboxItem {
  id: string; userId: string; content: string; classification?: 'task' | 'note' | 'goal_idea' | 'reminder';
  status: 'unprocessed' | 'processed' | 'archived'; createdAt: string; updatedAt: string;
}

export interface FocusSession {
  id: string; userId: string; taskId?: string; startedAt: string; endedAt?: string; pausedSeconds: number;
  actualMinutes?: number; status: 'active' | 'paused' | 'completed' | 'abandoned'; createdAt: string;
}

export interface AgentActionRecord {
  id: string; userId: string; request: string; response: unknown; status: 'pending' | 'applied' | 'cancelled' | 'failed';
  requiresConfirmation: boolean; executedAt?: string; createdAt: string;
}

export interface WeeklyReview {
  id: string; userId: string; weekStart: string; weekEnd: string; tasksCompleted: number; completionRate: number;
  minutesSpent: number; summary: string; wins: string[]; blockers: string[]; nextWeekChanges: string[]; createdAt: string;
}

export interface NotificationPreferences {
  id: string; userId: string; taskReminders: boolean; dailyPlanning: boolean; checkIns: boolean;
  goalWarnings: boolean; weeklyReview: boolean; createdAt: string; updatedAt: string;
}

export interface GoalSnapshot {
  id: string; userId: string; goalId: string; capturedOn: string; currentValue: number; progressPercent: number;
  status: GoalStatus; createdAt: string;
}

export interface TaskV2Fields {
  energyLevel?: EnergyLevel; actualMinutes?: number; deadline?: string; flexibility?: SchedulingFlexibility;
  recurrenceRuleId?: string; dependencyTaskId?: string; tags?: string[]; notes?: string; priority?: TaskPriority;
}
