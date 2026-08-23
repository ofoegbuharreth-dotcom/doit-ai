export function workspaceSyncErrorMessage(error: unknown, fallback = 'This change could not be saved.') {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export function isSafelyStaleQueuedMutation(error: unknown, mutation: { type: string }) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code !== '23503') return false;
  return ['activity', 'task_status', 'task_changes', 'delete_goal', 'recurrence_remove'].includes(mutation.type);
}
