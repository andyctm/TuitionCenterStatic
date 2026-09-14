import { describe, expect, it } from 'vitest';
import { timeRangesOverlap } from './scheduleOverlap';

describe('timeRangesOverlap', () => {
  it('returns false for back-to-back slots that only touch at the boundary', () => {
    expect(timeRangesOverlap('16:00', '17:00', '17:00', '18:00')).toBe(false);
    expect(timeRangesOverlap('17:00', '18:00', '16:00', '17:00')).toBe(false);
  });

  it('returns true when one range starts inside the other', () => {
    expect(timeRangesOverlap('16:00', '17:30', '17:00', '18:00')).toBe(true);
  });

  it('returns true when one range is fully inside the other', () => {
    expect(timeRangesOverlap('16:00', '19:00', '17:00', '18:00')).toBe(true);
    expect(timeRangesOverlap('17:00', '18:00', '16:00', '19:00')).toBe(true);
  });

  it('returns true for identical ranges', () => {
    expect(timeRangesOverlap('16:00', '17:00', '16:00', '17:00')).toBe(true);
  });

  it('returns false for disjoint ranges', () => {
    expect(timeRangesOverlap('09:00', '10:00', '14:00', '15:00')).toBe(false);
  });
});
