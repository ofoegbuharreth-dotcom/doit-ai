import { describe, expect, it } from 'vitest';

import { focusElapsedSeconds, formatFocusTime, type StoredFocusSession } from './focus';

const session: StoredFocusSession = {
  id: 'session', taskId: 'task', startedAt: '2026-08-11T09:00:00.000Z', targetSeconds: 600,
  accumulatedSeconds: 35, runningSince: 1_000, pausedSeconds: 0,
};

describe('focus timer', () => {
  it('includes time since the latest resume', () => {
    expect(focusElapsedSeconds(session, 6_900)).toBe(40);
  });

  it('does not add time while paused', () => {
    expect(focusElapsedSeconds({ ...session, runningSince: null }, 99_000)).toBe(35);
  });

  it('formats remaining time without negative values', () => {
    expect(formatFocusTime(65)).toBe('01:05');
    expect(formatFocusTime(-2)).toBe('00:00');
  });
});
