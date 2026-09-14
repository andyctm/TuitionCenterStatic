import { z } from 'zod';

export const createEnrollmentSchema = z.object({
  batchId: z.string().min(1),
  studentProfileId: z.string().min(1),
});

export const updateEnrollmentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'WITHDRAWN']),
});

export const enrollmentListQuerySchema = z.object({
  batchId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'WITHDRAWN']).optional(),
});
