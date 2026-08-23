import type { WorkspaceMutation } from './workspace-sync';

// Local workspace objects can survive a logout or an older app build. Always
// bind writes to the currently authenticated queue owner before they reach
// Supabase. RLS remains the final authority; this prevents stale embedded
// user IDs from making a valid user's queued change fail forever.
export function bindMutationToUser(mutation: WorkspaceMutation, userId: string): WorkspaceMutation {
  if (mutation.type === 'task_status' || mutation.type === 'task_changes' || mutation.type === 'new_task') {
    return { ...mutation, task: { ...mutation.task, userId } };
  }
  if (mutation.type === 'goal_changes') return { ...mutation, goal: { ...mutation.goal, userId } };
  if (mutation.type === 'check_in') return { ...mutation, checkIn: { ...mutation.checkIn, userId } };
  if (mutation.type === 'activity') return { ...mutation, activity: { ...mutation.activity, userId } };
  if (mutation.type === 'recurrence_rule') {
    return { ...mutation, rule: { ...mutation.rule, userId }, task: { ...mutation.task, userId } };
  }
  if (mutation.type === 'goal_plan') {
    return {
      ...mutation,
      goal: { ...mutation.goal, userId },
      tasks: mutation.tasks.map((task) => ({ ...task, userId })),
    };
  }
  return mutation;
}
