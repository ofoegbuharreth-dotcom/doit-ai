import { describe, expect, it } from 'vitest';

import { compactReleaseSummary, parseDesktopReleaseNotes, releaseNotes } from './release-notes';

describe('release notes', () => {
  it('keeps the newest release first', () => { expect(releaseNotes[0]?.version).toBe('1.2.12'); });
  it('turns a GitHub release body into update-dialog copy', () => {
    expect(parseDesktopReleaseNotes('# Update\nA much better release.\n- First change\n- Second change')).toEqual({ summary: 'A much better release.', highlights: ['First change', 'Second change'] });
  });
  it('keeps the update reason short', () => { expect(compactReleaseSummary('A'.repeat(220))).toHaveLength(165); });
  it('removes GitHub HTML instead of showing tags in the popup', () => {
    const html = '<h1>A faster way into DOIT</h1><p>Sign in faster &amp; understand every update.</p><h2>What’s new</h2><ul><li>Google sign-in</li><li>Clear update notes</li></ul>';
    expect(parseDesktopReleaseNotes(html)).toEqual({ summary: 'Sign in faster & understand every update.', highlights: ['Google sign-in', 'Clear update notes'] });
  });
});
