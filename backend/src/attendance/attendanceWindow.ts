const EDIT_WINDOW_MS = 72 * 60 * 60 * 1000; // attendance capability: 72h edit window, inclusive.

export function isWithinEditWindow(sessionDate: Date, now: Date): boolean {
  return now.getTime() - sessionDate.getTime() <= EDIT_WINDOW_MS;
}
