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
// the entity it references, since AuditLog itself has no branchId column in the approved schema
// (03-database-design.md) — only User and Attendance entities are audited today (see FR-AUD-1),
// so any other entityType is a safe-default-deny for non-Super-Admins rather than a crash.
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
    async list(ctx: AuthContext, filter: AuditLogListFilter): Promise<AuditLogRecord[]> {
      const logs = await auditLogRepo.findAll(filter);
      if (isSuperAdmin(ctx)) return logs;

      const scoped: AuditLogRecord[] = [];
      for (const log of logs) {
        const branchId = await resolveBranchId(log);
        if (branchId && ctx.branchIds.includes(branchId)) {
          scoped.push(log);
        }
      }
      return scoped;
    },
  };
}

export type AuditLogService = ReturnType<typeof createAuditLogService>;
