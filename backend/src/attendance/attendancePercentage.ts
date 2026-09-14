import type { AttendanceStatus } from '@prisma/client';

// attendance capability (FR-ATT-4): EXCUSED sessions are excluded from the denominator — a
// deliberate rule, documented for product-owner confirmation (see 08-implementation-plan.md M4).
export function calculateAttendancePercentage(records: { status: AttendanceStatus }[]): number {
  const counted = records.filter((r) => r.status !== 'EXCUSED');
  if (counted.length === 0) return 0;

  const attended = counted.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  return Math.round((attended / counted.length) * 100);
}
