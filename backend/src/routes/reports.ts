import { Router } from 'express';
import type { AttendanceReportService } from '../reporting/attendanceReportService';
import type { EnrollmentReportService } from '../reporting/enrollmentReportService';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { writeCsvRow } from '../lib/csv';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { attendanceReportQuerySchema, enrollmentReportQuerySchema } from '../validation/reportingSchemas';

// "Admin" here matches the convention used elsewhere (e.g. routes/users.ts) — Super Admin and
// Center Admin, not Accountant, per 04-api-specification.md §9's "Admin"-only role column.
const ADMIN_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN'] as const;

export function createReportsRouter(
  enrollmentReportService: EnrollmentReportService,
  attendanceReportService: AttendanceReportService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const adminOnly = [requireAuth(accessTokenSecret), requireRole(...ADMIN_ROLES)];

  router.get(
    '/enrollment',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const query = parseBody(enrollmentReportQuerySchema, req.query);
      const rows = await enrollmentReportService.listRows(getAuthContext(req), query);

      res.status(200);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="enrollment-report.csv"');
      writeCsvRow(res, [
        'enrollmentId',
        'studentProfileId',
        'batchId',
        'courseName',
        'branchName',
        'status',
        'enrolledAt',
      ]);
      for (const row of rows) {
        writeCsvRow(res, [
          row.enrollmentId,
          row.studentProfileId,
          row.batchId,
          row.courseName,
          row.branchName,
          row.status,
          row.enrolledAt.toISOString(),
        ]);
      }
      res.end();
    }),
  );

  router.get(
    '/attendance',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const query = parseBody(attendanceReportQuerySchema, req.query);
      const rows = await attendanceReportService.listRows(getAuthContext(req), query);

      res.status(200);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
      writeCsvRow(res, [
        'attendanceId',
        'sessionId',
        'sessionDate',
        'batchId',
        'courseName',
        'branchName',
        'studentProfileId',
        'status',
        'remarks',
      ]);
      for (const row of rows) {
        writeCsvRow(res, [
          row.attendanceId,
          row.sessionId,
          row.sessionDate.toISOString(),
          row.batchId,
          row.courseName,
          row.branchName,
          row.studentProfileId,
          row.status,
          row.remarks ?? '',
        ]);
      }
      res.end();
    }),
  );

  return router;
}
