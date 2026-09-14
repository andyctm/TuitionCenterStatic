import { Router } from 'express';
import type { AttendanceService } from '../attendance/attendanceService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';

export function createStudentsRouter(
  attendanceService: AttendanceService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);

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
