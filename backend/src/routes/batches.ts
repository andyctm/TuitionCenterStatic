import { Router } from 'express';
import type { BatchesService } from '../academic/batchesService';
import type { ClassSessionsService } from '../attendance/classSessionsService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import {
  batchListQuerySchema,
  createBatchSchema,
  createScheduleSchema,
  updateBatchSchema,
} from '../validation/academicSchemas';
import { createSessionSchema } from '../validation/attendanceSchemas';

const WRITE_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN'] as const;
const SESSION_WRITE_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN', 'TEACHER'] as const;

function requireParam(value: unknown, message: string): string {
  if (typeof value !== 'string') {
    throw new AppError('NOT_FOUND', 404, message);
  }
  return value;
}

export function createBatchesRouter(
  batchesService: BatchesService,
  classSessionsService: ClassSessionsService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);
  const writeAccess = [authed, requireRole(...WRITE_ROLES)];

  router.get(
    '/',
    authed,
    asyncHandler(async (req, res) => {
      const query = parseBody(batchListQuerySchema, req.query);
      const batches = await batchesService.list(getAuthContext(req), query);
      res.status(200).json({ data: batches });
    }),
  );

  router.post(
    '/',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const input = parseBody(createBatchSchema, req.body);
      const batch = await batchesService.create(input);
      res.status(201).json({ data: batch });
    }),
  );

  router.get(
    '/:id',
    authed,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const batch = await batchesService.getById(getAuthContext(req), id);
      res.status(200).json({ data: batch });
    }),
  );

  router.patch(
    '/:id',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const input = parseBody(updateBatchSchema, req.body);
      const batch = await batchesService.update(id, input);
      res.status(200).json({ data: batch });
    }),
  );

  router.post(
    '/:id/archive',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const batch = await batchesService.archive(id);
      res.status(200).json({ data: batch });
    }),
  );

  router.post(
    '/:id/schedules',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const input = parseBody(createScheduleSchema, req.body);
      const schedule = await batchesService.addSchedule(id, input);
      res.status(201).json({ data: schedule });
    }),
  );

  router.get(
    '/:id/schedules',
    authed,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const schedules = await batchesService.listSchedules(id);
      res.status(200).json({ data: schedules });
    }),
  );

  router.delete(
    '/:id/schedules/:scheduleId',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const scheduleId = requireParam(req.params.scheduleId, 'Schedule not found');
      await batchesService.removeSchedule(id, scheduleId);
      res.status(204).send();
    }),
  );

  router.get(
    '/:id/sessions',
    authed,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const sessions = await classSessionsService.list(getAuthContext(req), id);
      res.status(200).json({ data: sessions });
    }),
  );

  router.post(
    '/:id/sessions',
    authed,
    requireRole(...SESSION_WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Batch not found');
      const input = parseBody(createSessionSchema, req.body);
      const session = await classSessionsService.createAdHoc(getAuthContext(req), id, input);
      res.status(201).json({ data: session });
    }),
  );

  return router;
}
