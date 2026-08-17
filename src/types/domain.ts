export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'current' | 'completed';
export type TaskStatus = 'pending' | 'completed' | 'skipped' | 'moved';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: GoalStatus;
  targetValue: number;
  currentValue: number;
  unit: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string;
  targetValue: number;
  sortOrder: number;
  status: MilestoneStatus;
  completedAt?: string;
  dueDate?: string;
}

export interface Task {
  id: string;
  goalId?: string;
  userId: string;
  title: string;
  description: string;
  scheduledDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedMinutes: number;
  aiGenerated: boolean;
  createdAt: string;
  completedAt?: string;
  moveCount: number;
  energyLevel?: import('./v2').EnergyLevel;
  actualMinutes?: number;
  deadline?: string;
  flexibility?: import('./v2').SchedulingFlexibility;
  recurrenceRuleId?: string;
  tags?: string[];
  notes?: string;
}

export interface DailyCheckIn {
  id: string;
  userId: string;
  date: string;
  mood: 'great' | 'okay' | 'bad';
  blocker?: string;
  accomplishment?: string;
  createdAt: string;
}

export interface GoalActivity {
  id: string;
  goalId?: string;
  userId: string;
  type: 'goal_created' | 'task_completed' | 'task_skipped' | 'task_moved' | 'milestone_reached' | 'plan_adjusted' | 'check_in' | 'progress_logged';
  title: string;
  detail?: string;
  createdAt: string;
}

export interface GoalProgressEntry {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  note?: string;
  recordedOn: string;
  createdAt: string;
}

export interface GoalDraft {
  prompt: string;
  targetDate?: string;
  currentProgress?: string;
  availableTime?: string;
  constraints?: string;
}
