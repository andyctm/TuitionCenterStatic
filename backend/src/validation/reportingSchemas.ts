import { z } from 'zod';

export const enrollmentReportQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'WITHDRAWN']).optional(),
});

export const attendanceReportQuerySchema = z.object({
  batchId: z.string().min(1).optional(),
});
