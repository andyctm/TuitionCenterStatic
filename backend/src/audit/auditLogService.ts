import { isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRepository,
  AuditLogListFilter,
  AuditLogRecord,
  AuditLogRepository,
  BatchRepository,
  ClassSessionRepository,
  UserRepository,
} from '../repositories/types';

export type AuditLogServiceDeps = {
  auditLogRepo: AuditLogRepository;
  userRepo: UserRepository;
  attendanceRepo: AttendanceRepository;
  classSessionRepo: ClassSessionRepository;
  batchRepo: BatchRepository;
};

// audit-log capability (FR-AUD-2): resolves the branch a given audit row belongs to by walking
// the entity it references (the affected User/Attendance record), NOT the actor who performed the
// action — a Super Admin (no branchId) can change the status of a user who does belong to a
// branch, so scoping/filtering must key off the entity, not the actor.
export type AuditLogListItem = AuditLogRecord & { branchId: string | null };

export function createAuditLogService(deps: AuditLogServiceDeps) {
  const { auditLogRepo, userRepo, attendanceRepo, classSessionRepo, batchRepo } = deps;

  async function resolveBranchId(log: AuditLogRecord): Promise<string | null> {
    if (log.entityType === 'User') {
      const user = await userRepo.findById(log.entityId);
      return user?.branchId ?? null;
    }
    if (log.entityType === 'Attendance') {
      const attendance = await attendanceRepo.findById(log.entityId);
      if (!attendance) return null;
      const session = await classSessionRepo.findById(attendance.classSessionId);
      if (!session) return null;
      const batch = await batchRepo.findById(session.batchId);
      return batch?.branchId ?? null;
    }
    return null;
  }

  return {
    async list(ctx: AuthContext, filter: AuditLogListFilter): Promise<AuditLogListItem[]> {
      const logs = await auditLogRepo.findAll(filter);
      const withBranch = await Promise.all(
        logs.map(async (log) => ({ ...log, branchId: await resolveBranchId(log) })),
      );
      if (isSuperAdmin(ctx)) return withBranch;

      return withBranch.filter((log) => log.branchId !== null && ctx.branchIds.includes(log.branchId));
    },
  };
}

export type AuditLogService = ReturnType<typeof createAuditLogService>;
