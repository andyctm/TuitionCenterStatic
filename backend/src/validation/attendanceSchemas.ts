import { z } from 'zod';

export const createSessionSchema = z.object({
  sessionDate: z.coerce.date(),
});

const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export const bulkAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentProfileId: z.string().min(1),
        status: attendanceStatusEnum,
        remarks: z.string().optional(),
      }),
    )
    .min(1),
});

export const overrideAttendanceSchema = z.object({
  studentProfileId: z.string().min(1),
  status: attendanceStatusEnum,
  remarks: z.string().optional(),
  reason: z.string().min(1),
});
