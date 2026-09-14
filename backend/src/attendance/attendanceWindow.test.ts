import { describe, expect, it } from 'vitest';
import { isWithinEditWindow } from './attendanceWindow';

describe('isWithinEditWindow', () => {
  const sessionDate = new Date('2026-09-01T00:00:00Z');

  it('is inside the window at exactly 72h0m after the session', () => {
    const now = new Date(sessionDate.getTime() + 72 * 60 * 60 * 1000);
    expect(isWithinEditWindow(sessionDate, now)).toBe(true);
  });

  it('is outside the window at 72h1m after the session', () => {
    const now = new Date(sessionDate.getTime() + 72 * 60 * 60 * 1000 + 60 * 1000);
    expect(isWithinEditWindow(sessionDate, now)).toBe(false);
  });

  it('is inside the window immediately after the session', () => {
    const now = new Date(sessionDate.getTime() + 60 * 1000);
    expect(isWithinEditWindow(sessionDate, now)).toBe(true);
  });

  it('is inside the window for a session dated in the future', () => {
    const now = new Date(sessionDate.getTime() - 60 * 60 * 1000);
    expect(isWithinEditWindow(sessionDate, now)).toBe(true);
  });
});
