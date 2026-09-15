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
  UserRepository,
} from '../repositories/types';

export type AttendanceServiceDeps = {
  attendanceRepo: AttendanceRepository;
  classSessionRepo: ClassSessionRepository;
  batchRepo: BatchRepository;
  studentProfileRepo: StudentProfileRepository;
  parentStudentRepo: ParentStudentRepository;
  enrollmentRepo: EnrollmentRepository;
  auditLogRepo: AuditLogRepository;
  userRepo: UserRepository;
};

export type OverrideInput = {
  studentProfileId: string;
  status: AttendanceStatus;
  remarks?: string;
  reason: string;
};

// One row per actively-enrolled student, whether or not they've been marked yet for this
// session — the frontend roster needs the full class list (not just already-marked rows) plus
// display names, neither of which `AttendanceRepository.findBySession` alone can provide.
export type AttendanceRosterEntry = {
  studentProfileId: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus | null;
  remarks: string | null;
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
    userRepo,
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
    async getRoster(ctx: AuthContext, sessionId: string): Promise<AttendanceRosterEntry[]> {
      const { batch } = await requireSessionAndBatch(sessionId);
      if (ctx.role === 'TEACHER') {
        if (batch.teacherUserId !== ctx.userId) {
          throw new AppError('FORBIDDEN', 403, 'You are not the assigned teacher for this batch');
        }
      } else {
        assertAdminBranchScope(ctx, batch);
      }

      const [enrollments, existingAttendance] = await Promise.all([
        enrollmentRepo.findAll({ batchId: batch.id, status: 'ACTIVE' }),
        attendanceRepo.findBySession(sessionId),
      ]);
      const attendanceByStudent = new Map(existingAttendance.map((a) => [a.studentProfileId, a]));

      const entries: AttendanceRosterEntry[] = [];
      for (const enrollment of enrollments) {
        const profile = await studentProfileRepo.findById(enrollment.studentProfileId);
        if (!profile) continue;
        const user = await userRepo.findById(profile.userId);
        if (!user) continue;
        const existing = attendanceByStudent.get(enrollment.studentProfileId) ?? null;
        entries.push({
          studentProfileId: enrollment.studentProfileId,
          firstName: user.firstName,
          lastName: user.lastName,
          status: existing?.status ?? null,
          remarks: existing?.remarks ?? null,
        });
      }

      return entries.sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
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
