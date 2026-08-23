export function isShareCancellation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; message?: unknown };
  return value.name === 'AbortError' || /cancel(?:led|ed)|abort/i.test(String(value.message ?? ''));
}
