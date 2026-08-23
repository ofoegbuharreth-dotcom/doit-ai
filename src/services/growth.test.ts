import { describe, expect, it } from 'vitest';

import { isShareCancellation } from './share';

describe('referral sharing', () => {
  it('treats closing the native share sheet as a normal cancellation', () => {
    expect(isShareCancellation({ name: 'AbortError' })).toBe(true);
    expect(isShareCancellation({ message: 'Share canceled' })).toBe(true);
    expect(isShareCancellation(new Error('Network unavailable'))).toBe(false);
  });
});
