import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1).optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export const createGradeLevelSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int(),
});

export const createCourseSchema = z.object({
  subjectId: z.string().min(1),
  gradeLevelId: z.string().min(1),
  name: z.string().min(1),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
});

export const createBatchSchema = z.object({
  courseId: z.string().min(1),
  branchId: z.string().min(1),
  teacherUserId: z.string().min(1).optional(),
  room: z.string().min(1),
  capacity: z.number().int().positive(),
  term: z.string().min(1),
});

export const updateBatchSchema = z.object({
  teacherUserId: z.string().min(1).nullable().optional(),
  room: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createScheduleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(HHMM_PATTERN, 'must be in HH:mm format'),
    endTime: z.string().regex(HHMM_PATTERN, 'must be in HH:mm format'),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

export const batchListQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  term: z.string().min(1).optional(),
});
