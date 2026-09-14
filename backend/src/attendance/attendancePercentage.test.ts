import { describe, expect, it } from 'vitest';
import { calculateAttendancePercentage } from './attendancePercentage';

describe('calculateAttendancePercentage', () => {
  it('counts PRESENT and LATE as attended out of a denominator excluding EXCUSED', () => {
    const result = calculateAttendancePercentage([
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'LATE' },
      { status: 'ABSENT' },
      { status: 'EXCUSED' },
    ]);

    // attended = 3 (PRESENT x2, LATE x1), denominator = 4 (EXCUSED excluded) -> 75%
    expect(result).toBe(75);
  });

  it('returns 0 when there are no records', () => {
    expect(calculateAttendancePercentage([])).toBe(0);
  });

  it('returns 0 when every record is EXCUSED (empty denominator)', () => {
    expect(calculateAttendancePercentage([{ status: 'EXCUSED' }, { status: 'EXCUSED' }])).toBe(0);
  });

  it('returns 100 when every non-excused record is PRESENT or LATE', () => {
    expect(
      calculateAttendancePercentage([{ status: 'PRESENT' }, { status: 'LATE' }, { status: 'EXCUSED' }]),
    ).toBe(100);
  });
});
