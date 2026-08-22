import { describe, expect, it } from 'vitest';

import { parseDesktopReleaseNotes, releaseNotes } from './release-notes';

describe('release notes', () => {
  it('keeps the newest release first', () => { expect(releaseNotes[0]?.version).toBe('1.2.4'); });
  it('turns a GitHub release body into update-dialog copy', () => {
    expect(parseDesktopReleaseNotes('# Update\nA much better release.\n- First change\n- Second change')).toEqual({ summary: 'A much better release.', highlights: ['First change', 'Second change'] });
  });
});
