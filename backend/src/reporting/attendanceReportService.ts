import type { AttendanceStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRepository,
  BatchRecord,
  BatchRepository,
  BranchRepository,
  ClassSessionRepository,
  CourseRepository,
} from '../repositories/types';

export type AttendanceReportServiceDeps = {
  batchRepo: BatchRepository;
  courseRepo: CourseRepository;
  branchRepo: BranchRepository;
  classSessionRepo: ClassSessionRepository;
  attendanceRepo: AttendanceRepository;
};

export type AttendanceReportFilter = { batchId?: string };

export type AttendanceReportRow = {
  attendanceId: string;
  sessionId: string;
  sessionDate: Date;
  batchId: string;
  courseName: string;
  branchName: string;
  studentProfileId: string;
  status: AttendanceStatus;
  remarks: string | null;
};

// reporting capability (FR-RPT-2): flattens Attendance + ClassSession + Batch + Course + Branch
// into one row per marked attendance record for CSV export, branch-scoped like the enrollment
// report. Reuses the existing per-batch/per-session repository methods (no new repository query
// capability needed) since this system's scale makes the N+M lookups cheap.
export function createAttendanceReportService(deps: AttendanceReportServiceDeps) {
  const { batchRepo, courseRepo, branchRepo, classSessionRepo, attendanceRepo } = deps;

  async function resolveBatches(
    ctx: AuthContext,
    filter: AttendanceReportFilter,
  ): Promise<BatchRecord[]> {
    if (filter.batchId) {
      const batch = await batchRepo.findById(filter.batchId);
      if (!batch || !isInBranchScope(ctx, batch.branchId)) {
        throw new AppError('NOT_FOUND', 404, 'Batch not found');
      }
      return [batch];
    }
    const branchIds = isSuperAdmin(ctx) ? undefined : ctx.branchIds;
    return batchRepo.findAll({ branchIds });
  }

  return {
    async listRows(
      ctx: AuthContext,
      filter: AttendanceReportFilter = {},
    ): Promise<AttendanceReportRow[]> {
      const batches = await resolveBatches(ctx, filter);

      const rows: AttendanceReportRow[] = [];
      for (const batch of batches) {
        const [course, branch, sessions] = await Promise.all([
          courseRepo.findById(batch.courseId),
          branchRepo.findById(batch.branchId),
          classSessionRepo.findByBatch(batch.id),
        ]);
        for (const session of sessions) {
          const attendances = await attendanceRepo.findBySession(session.id);
          for (const attendance of attendances) {
            rows.push({
              attendanceId: attendance.id,
              sessionId: session.id,
              sessionDate: session.sessionDate,
              batchId: batch.id,
              courseName: course?.name ?? 'Unknown course',
              branchName: branch?.name ?? 'Unknown branch',
              studentProfileId: attendance.studentProfileId,
              status: attendance.status,
              remarks: attendance.remarks,
            });
          }
        }
      }
      return rows;
    },
  };
}

export type AttendanceReportService = ReturnType<typeof createAttendanceReportService>;
