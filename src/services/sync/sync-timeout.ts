export const WORKSPACE_SYNC_TIMEOUT_MS = 6_000;

export function withWorkspaceSyncTimeout<T>(operation: Promise<T>, timeoutMs = WORKSPACE_SYNC_TIMEOUT_MS, onTimeout?: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      onTimeout?.();
      reject(new Error('Workspace sync timed out. Please try again.'));
    }, timeoutMs);
  });
  return Promise.race([operation, deadline]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
