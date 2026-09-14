// "HH:mm" strings compare correctly with string comparison since they're zero-padded and fixed-width.
export function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && startB < endA;
}
