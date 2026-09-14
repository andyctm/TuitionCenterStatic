import { Router } from 'express';
import type { AttendanceService } from '../attendance/attendanceService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { bulkAttendanceSchema, overrideAttendanceSchema } from '../validation/attendanceSchemas';

function requireParam(value: unknown, message: string): string {
  if (typeof value !== 'string') {
    throw new AppError('NOT_FOUND', 404, message);
  }
  return value;
}

export function createAttendanceRouter(
  attendanceService: AttendanceService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);

  router.get(
    '/:id/attendance',
    authed,
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Session not found');
      const roster = await attendanceService.getRoster(getAuthContext(req), id);
      res.status(200).json({ data: roster });
    }),
  );

  router.put(
    '/:id/attendance',
    authed,
    requireRole('TEACHER'),
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Session not found');
      const { records } = parseBody(bulkAttendanceSchema, req.body);
      const result = await attendanceService.bulkUpsert(getAuthContext(req), id, records);
      res.status(200).json({ data: result });
    }),
  );

  router.post(
    '/:id/attendance/override',
    authed,
    requireRole('SUPER_ADMIN', 'CENTER_ADMIN'),
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params.id, 'Session not found');
      const input = parseBody(overrideAttendanceSchema, req.body);
      const result = await attendanceService.override(getAuthContext(req), id, input);
      res.status(200).json({ data: result });
    }),
  );

  return router;
}
