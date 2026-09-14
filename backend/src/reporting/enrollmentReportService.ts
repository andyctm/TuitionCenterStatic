import type { EnrollmentStatus } from '@prisma/client';
import { isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  BatchRepository,
  BranchRepository,
  CourseRepository,
  EnrollmentRepository,
} from '../repositories/types';

export type EnrollmentReportServiceDeps = {
  enrollmentRepo: EnrollmentRepository;
  batchRepo: BatchRepository;
  courseRepo: CourseRepository;
  branchRepo: BranchRepository;
};

export type EnrollmentReportFilter = { status?: EnrollmentStatus };

export type EnrollmentReportRow = {
  enrollmentId: string;
  studentProfileId: string;
  batchId: string;
  courseName: string;
  branchName: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
};

// reporting capability (FR-RPT-2): flattens Enrollment + Batch + Course + Branch into one row per
// enrollment for CSV export, branch-scoped like every other admin-facing list in this codebase.
export function createEnrollmentReportService(deps: EnrollmentReportServiceDeps) {
  const { enrollmentRepo, batchRepo, courseRepo, branchRepo } = deps;

  return {
    async listRows(
      ctx: AuthContext,
      filter: EnrollmentReportFilter = {},
    ): Promise<EnrollmentReportRow[]> {
      const branchIds = isSuperAdmin(ctx) ? undefined : ctx.branchIds;
      const enrollments = await enrollmentRepo.findAll({ ...filter, branchIds });

      const rows: EnrollmentReportRow[] = [];
      for (const enrollment of enrollments) {
        const batch = await batchRepo.findById(enrollment.batchId);
        if (!batch) continue;
        const [course, branch] = await Promise.all([
          courseRepo.findById(batch.courseId),
          branchRepo.findById(batch.branchId),
        ]);
        rows.push({
          enrollmentId: enrollment.id,
          studentProfileId: enrollment.studentProfileId,
          batchId: enrollment.batchId,
          courseName: course?.name ?? 'Unknown course',
          branchName: branch?.name ?? 'Unknown branch',
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
        });
      }
      return rows;
    },
  };
}

export type EnrollmentReportService = ReturnType<typeof createEnrollmentReportService>;
