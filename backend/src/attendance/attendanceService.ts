import type { AttendanceStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import { calculateAttendancePercentage } from './attendancePercentage';
import { isWithinEditWindow } from './attendanceWindow';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRecord,
  AttendanceRepository,
  AttendanceUpsertInput,
  AuditLogRepository,
  BatchRecord,
  BatchRepository,
  ClassSessionRecord,
  ClassSessionRepository,
  EnrollmentRepository,
  ParentStudentRepository,
  StudentProfileRepository,
} from '../repositories/types';

export type AttendanceServiceDeps = {
  attendanceRepo: AttendanceRepository;
  classSessionRepo: ClassSessionRepository;
  batchRepo: BatchRepository;
  studentProfileRepo: StudentProfileRepository;
  parentStudentRepo: ParentStudentRepository;
  enrollmentRepo: EnrollmentRepository;
  auditLogRepo: AuditLogRepository;
};

export type OverrideInput = {
  studentProfileId: string;
  status: AttendanceStatus;
  remarks?: string;
  reason: string;
};

export function createAttendanceService(deps: AttendanceServiceDeps) {
  const {
    attendanceRepo,
    classSessionRepo,
    batchRepo,
    studentProfileRepo,
    parentStudentRepo,
    enrollmentRepo,
    auditLogRepo,
  } = deps;

  async function requireSessionAndBatch(
    sessionId: string,
  ): Promise<{ session: ClassSessionRecord; batch: BatchRecord }> {
    const session = await classSessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError('NOT_FOUND', 404, 'Session not found');
    }
    const batch = await batchRepo.findById(session.batchId);
    if (!batch) {
      throw new AppError('NOT_FOUND', 404, 'Session not found');
    }
    return { session, batch };
  }

  // Branch-out-of-scope (Center Admin/Accountant) -> 404, IDOR-avoidance convention. Wrong
  // teacher -> 403, per the attendance capability's explicit worked examples/scenarios.
  function assertAdminBranchScope(ctx: AuthContext, batch: BatchRecord): void {
    if (isSuperAdmin(ctx)) return;
    if (!isInBranchScope(ctx, batch.branchId)) {
      throw new AppError('NOT_FOUND', 404, 'Session not found');
    }
  }

  return {
    async getRoster(ctx: AuthContext, sessionId: string): Promise<AttendanceRecord[]> {
      const { batch } = await requireSessionAndBatch(sessionId);
      if (ctx.role === 'TEACHER') {
        if (batch.teacherUserId !== ctx.userId) {
          throw new AppError('FORBIDDEN', 403, 'You are not the assigned teacher for this batch');
        }
      } else {
        assertAdminBranchScope(ctx, batch);
      }
      return attendanceRepo.findBySession(sessionId);
    },

    async bulkUpsert(
      ctx: AuthContext,
      sessionId: string,
      records: AttendanceUpsertInput[],
      now: Date = new Date(),
    ): Promise<AttendanceRecord[]> {
      const { session, batch } = await requireSessionAndBatch(sessionId);
      if (ctx.role !== 'TEACHER' || batch.teacherUserId !== ctx.userId) {
        throw new AppError('FORBIDDEN', 403, 'You are not the assigned teacher for this batch');
      }
      if (!isWithinEditWindow(session.sessionDate, now)) {
        throw new AppError(
          'FORBIDDEN',
          403,
          'This session is outside the 72h edit window — request a Center Admin override',
        );
      }
      return attendanceRepo.upsertMany(sessionId, records);
    },

    async override(
      ctx: AuthContext,
      sessionId: string,
      input: OverrideInput,
      now: Date = new Date(),
    ): Promise<AttendanceRecord> {
      const { batch } = await requireSessionAndBatch(sessionId);
      assertAdminBranchScope(ctx, batch);

      const before =
        (await attendanceRepo.findBySession(sessionId)).find(
          (a) => a.studentProfileId === input.studentProfileId,
        ) ?? null;

      const [after] = await attendanceRepo.upsertMany(sessionId, [
        { studentProfileId: input.studentProfileId, status: input.status, remarks: input.remarks },
      ]);
      if (!after) {
        throw new AppError('INTERNAL_ERROR', 500, 'Failed to write the overridden attendance record');
      }

      await auditLogRepo.create({
        actorUserId: ctx.userId,
        entityType: 'Attendance',
        entityId: after.id,
        action: 'OVERRIDE',
        before,
        after: { ...after, reason: input.reason, overriddenAt: now.toISOString() },
      });

      return after;
    },

    async studentAttendanceHistory(
      ctx: AuthContext,
      studentProfileId: string,
    ): Promise<{ records: Awaited<ReturnType<AttendanceRepository['findByStudent']>>; percentage: number }> {
      const profile = await studentProfileRepo.findById(studentProfileId);
      if (!profile) {
        throw new AppError('NOT_FOUND', 404, 'Student not found');
      }

      if (ctx.role === 'STUDENT') {
        if (profile.userId !== ctx.userId) {
          throw new AppError('FORBIDDEN', 403, 'You can only view your own attendance');
        }
      } else if (ctx.role === 'PARENT') {
        const childIds = await parentStudentRepo.listStudentProfileIdsForParent(ctx.userId);
        if (!childIds.includes(studentProfileId)) {
          throw new AppError('FORBIDDEN', 403, "You can only view your child's attendance");
        }
      } else if (!isSuperAdmin(ctx)) {
        const enrollments = await enrollmentRepo.findAll({ studentProfileIds: [studentProfileId] });
        let inScope = false;
        for (const enrollment of enrollments) {
          const batch = await batchRepo.findById(enrollment.batchId);
          if (!batch) continue;
          if (ctx.role === 'TEACHER' ? batch.teacherUserId === ctx.userId : isInBranchScope(ctx, batch.branchId)) {
            inScope = true;
            break;
          }
        }
        if (!inScope) {
          throw new AppError('NOT_FOUND', 404, 'Student not found');
        }
      }

      const records = await attendanceRepo.findByStudent(studentProfileId);
      return { records, percentage: calculateAttendancePercentage(records) };
    },
  };
}

export type AttendanceService = ReturnType<typeof createAttendanceService>;
