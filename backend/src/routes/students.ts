import { Router } from 'express';
import type { AttendanceService } from '../attendance/attendanceService';
import type { StudentsService } from '../students/studentsService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const DIRECTORY_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN', 'ACCOUNTANT'] as const;

export function createStudentsRouter(
  attendanceService: AttendanceService,
  studentsService: StudentsService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);

  router.get(
    '/',
    authed,
    requireRole(...DIRECTORY_ROLES),
    asyncHandler(async (req, res) => {
      const students = await studentsService.list(getAuthContext(req));
      res.status(200).json({ data: students });
    }),
  );

  router.get(
    '/:id/attendance',
    authed,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'Student not found');
      }
      const result = await attendanceService.studentAttendanceHistory(getAuthContext(req), id);
      res.status(200).json({ data: result });
    }),
  );

  return router;
}
