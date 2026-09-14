import { randomUUID } from 'node:crypto';
import type {
  AttendanceRecord,
  AttendanceRepository,
  AttendanceUpsertInput,
  AuditLogRecord,
  AuditLogRepository,
  BatchListFilter,
  BatchRecord,
  BatchRepository,
  BranchRecord,
  BranchRepository,
  ClassScheduleRecord,
  ClassScheduleRepository,
  ClassSessionRecord,
  ClassSessionRepository,
  CourseRecord,
  CourseRepository,
  EnrollmentCreateResult,
  EnrollmentListFilter,
  EnrollmentRecord,
  EnrollmentRepository,
  GradeLevelRecord,
  GradeLevelRepository,
  NewUserInput,
  ParentStudentRepository,
  PasswordResetTokenRecord,
  PasswordResetTokenRepository,
  RefreshTokenRecord,
  RefreshTokenRepository,
  ScheduleConflictCandidate,
  StudentAttendanceRecord,
  StudentProfileRecord,
  StudentProfileRepository,
  SubjectRecord,
  SubjectRepository,
  UserRecord,
  UserRepository,
} from '../repositories/types';


export function createFakeUserRepository(seed: UserRecord[] = []): UserRepository {
  const users = new Map(seed.map((u) => [u.id, u]));

  return {
    async findByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async create(input: NewUserInput) {
      const record: UserRecord = { id: randomUUID(), branchId: null, ...input };
      users.set(record.id, record);
      return record;
    },
    async updateStatus(id, status) {
      const existing = users.get(id);
      if (!existing) throw new Error(`no fake user ${id}`);
      const updated = { ...existing, status };
      users.set(id, updated);
      return updated;
    },
    async updatePasswordHash(id, passwordHash) {
      const existing = users.get(id);
      if (!existing) throw new Error(`no fake user ${id}`);
      users.set(id, { ...existing, passwordHash });
    },
  };
}

export function createFakeRefreshTokenRepository(): RefreshTokenRepository {
  const tokens = new Map<string, RefreshTokenRecord>();

  return {
    async create(input) {
      const record: RefreshTokenRecord = { id: randomUUID(), revokedAt: null, ...input };
      tokens.set(record.id, record);
      return record;
    },
    async findByHash(tokenHash) {
      return [...tokens.values()].find((t) => t.tokenHash === tokenHash) ?? null;
    },
    async revoke(id) {
      const existing = tokens.get(id);
      if (existing) tokens.set(id, { ...existing, revokedAt: new Date() });
    },
    async revokeAllForUser(userId) {
      for (const [id, token] of tokens) {
        if (token.userId === userId && !token.revokedAt) {
          tokens.set(id, { ...token, revokedAt: new Date() });
        }
      }
    },
  };
}

export function createFakePasswordResetTokenRepository(): PasswordResetTokenRepository {
  const tokens = new Map<string, PasswordResetTokenRecord>();

  return {
    async create(input) {
      const record: PasswordResetTokenRecord = { id: randomUUID(), usedAt: null, ...input };
      tokens.set(record.id, record);
      return record;
    },
    async findByHash(tokenHash) {
      return [...tokens.values()].find((t) => t.tokenHash === tokenHash) ?? null;
    },
    async markUsed(id) {
      const existing = tokens.get(id);
      if (existing) tokens.set(id, { ...existing, usedAt: new Date() });
    },
  };
}

export function createFakeBranchRepository(seed: BranchRecord[] = []): BranchRepository {
  const branches = new Map(seed.map((b) => [b.id, b]));

  return {
    async findAll(filter) {
      const all = [...branches.values()];
      if (!filter?.ids) return all;
      return all.filter((b) => filter.ids?.includes(b.id));
    },
    async findById(id) {
      return branches.get(id) ?? null;
    },
    async create(input) {
      const record: BranchRecord = {
        id: randomUUID(),
        timezone: 'Asia/Colombo',
        isActive: true,
        ...input,
      };
      branches.set(record.id, record);
      return record;
    },
    async update(id, input) {
      const existing = branches.get(id);
      if (!existing) throw new Error(`no fake branch ${id}`);
      const updated = { ...existing, ...input };
      branches.set(id, updated);
      return updated;
    },
  };
}

export function createFakeSubjectRepository(seed: SubjectRecord[] = []): SubjectRepository {
  const subjects = new Map(seed.map((s) => [s.id, s]));

  return {
    async findAll() {
      return [...subjects.values()];
    },
    async findByCode(code) {
      return [...subjects.values()].find((s) => s.code === code) ?? null;
    },
    async create(input) {
      const record: SubjectRecord = { id: randomUUID(), ...input };
      subjects.set(record.id, record);
      return record;
    },
  };
}

export function createFakeGradeLevelRepository(
  seed: GradeLevelRecord[] = [],
): GradeLevelRepository {
  const gradeLevels = new Map(seed.map((g) => [g.id, g]));

  return {
    async findAll() {
      return [...gradeLevels.values()];
    },
    async findByName(name) {
      return [...gradeLevels.values()].find((g) => g.name === name) ?? null;
    },
    async create(input) {
      const record: GradeLevelRecord = { id: randomUUID(), ...input };
      gradeLevels.set(record.id, record);
      return record;
    },
  };
}

export function createFakeCourseRepository(seed: CourseRecord[] = []): CourseRepository {
  const courses = new Map(seed.map((c) => [c.id, c]));

  return {
    async findAll() {
      return [...courses.values()];
    },
    async findById(id) {
      return courses.get(id) ?? null;
    },
    async findBySubjectAndGrade(subjectId, gradeLevelId) {
      return (
        [...courses.values()].find(
          (c) => c.subjectId === subjectId && c.gradeLevelId === gradeLevelId,
        ) ?? null
      );
    },
    async create(input) {
      const record: CourseRecord = { id: randomUUID(), ...input };
      courses.set(record.id, record);
      return record;
    },
    async update(id, input) {
      const existing = courses.get(id);
      if (!existing) throw new Error(`no fake course ${id}`);
      const updated = { ...existing, ...input };
      courses.set(id, updated);
      return updated;
    },
    async delete(id) {
      courses.delete(id);
    },
  };
}

export function createFakeBatchRepository(seed: BatchRecord[] = []): BatchRepository {
  const batches = new Map(seed.map((b) => [b.id, b]));

  return {
    async findAll(filter: BatchListFilter) {
      return [...batches.values()].filter((b) => {
        if (filter.branchIds && !filter.branchIds.includes(b.branchId)) return false;
        if (filter.teacherUserId && b.teacherUserId !== filter.teacherUserId) return false;
        if (filter.courseId && b.courseId !== filter.courseId) return false;
        if (filter.status && b.status !== filter.status) return false;
        if (filter.term && b.term !== filter.term) return false;
        return true;
      });
    },
    async findById(id) {
      return batches.get(id) ?? null;
    },
    async create(input) {
      const record: BatchRecord = {
        id: randomUUID(),
        teacherUserId: null,
        status: 'ACTIVE',
        ...input,
      };
      batches.set(record.id, record);
      return record;
    },
    async update(id, input) {
      const existing = batches.get(id);
      if (!existing) throw new Error(`no fake batch ${id}`);
      const updated = { ...existing, ...input };
      batches.set(id, updated);
      return updated;
    },
  };
}

export function createFakeClassScheduleRepository(
  seed: ClassScheduleRecord[] = [],
  batchRepo?: BatchRepository,
): ClassScheduleRepository {
  const schedules = new Map(seed.map((s) => [s.id, s]));

  return {
    async findByBatch(batchId) {
      return [...schedules.values()].filter((s) => s.batchId === batchId);
    },
    async findById(id) {
      return schedules.get(id) ?? null;
    },
    async findConflictCandidates(branchId, dayOfWeek): Promise<ScheduleConflictCandidate[]> {
      const candidates: ScheduleConflictCandidate[] = [];
      for (const schedule of schedules.values()) {
        if (schedule.dayOfWeek !== dayOfWeek) continue;
        const batch = await batchRepo?.findById(schedule.batchId);
        if (!batch || batch.branchId !== branchId) continue;
        candidates.push({ ...schedule, room: batch.room, teacherUserId: batch.teacherUserId });
      }
      return candidates;
    },
    async create(input) {
      const record: ClassScheduleRecord = { id: randomUUID(), ...input };
      schedules.set(record.id, record);
      return record;
    },
    async delete(id) {
      schedules.delete(id);
    },
  };
}

export function createFakeStudentProfileRepository(
  seed: StudentProfileRecord[] = [],
): StudentProfileRepository {
  const profiles = new Map(seed.map((p) => [p.id, p]));

  return {
    async findById(id) {
      return profiles.get(id) ?? null;
    },
    async findByUserId(userId) {
      return [...profiles.values()].find((p) => p.userId === userId) ?? null;
    },
    async create(input) {
      const record: StudentProfileRecord = { id: randomUUID(), ...input };
      profiles.set(record.id, record);
      return record;
    },
  };
}

export function createFakeParentStudentRepository(
  links: { parentUserId: string; studentProfileId: string }[] = [],
): ParentStudentRepository {
  return {
    async listStudentProfileIdsForParent(parentUserId) {
      return links.filter((l) => l.parentUserId === parentUserId).map((l) => l.studentProfileId);
    },
  };
}

export function createFakeEnrollmentRepository(
  seed: EnrollmentRecord[] = [],
  batchRepo?: BatchRepository,
): EnrollmentRepository {
  const enrollments = new Map(seed.map((e) => [e.id, e]));

  return {
    async findAll(filter: EnrollmentListFilter) {
      const filtered: EnrollmentRecord[] = [];
      for (const enrollment of enrollments.values()) {
        if (filter.batchId && enrollment.batchId !== filter.batchId) continue;
        if (filter.status && enrollment.status !== filter.status) continue;
        if (
          filter.studentProfileIds &&
          !filter.studentProfileIds.includes(enrollment.studentProfileId)
        ) {
          continue;
        }
        if (filter.branchIds) {
          const batch = await batchRepo?.findById(enrollment.batchId);
          if (!batch || !filter.branchIds.includes(batch.branchId)) continue;
        }
        filtered.push(enrollment);
      }
      return filtered;
    },
    async findById(id) {
      return enrollments.get(id) ?? null;
    },
    // Synchronous body (no internal await) so this runs as one atomic unit even under
    // concurrent Promise.all callers — mirrors the serializable transaction in the Prisma impl.
    async createIfCapacityAvailable(input): Promise<EnrollmentCreateResult> {
      const duplicate = [...enrollments.values()].find(
        (e) =>
          e.batchId === input.batchId &&
          e.studentProfileId === input.studentProfileId &&
          e.status === 'ACTIVE',
      );
      if (duplicate) {
        return { outcome: 'DUPLICATE' };
      }

      const activeCount = [...enrollments.values()].filter(
        (e) => e.batchId === input.batchId && e.status === 'ACTIVE',
      ).length;
      if (activeCount >= input.capacity) {
        return { outcome: 'AT_CAPACITY' };
      }

      const enrollment: EnrollmentRecord = {
        id: randomUUID(),
        batchId: input.batchId,
        studentProfileId: input.studentProfileId,
        status: 'ACTIVE',
        enrolledAt: new Date(),
      };
      enrollments.set(enrollment.id, enrollment);
      return { outcome: 'CREATED', enrollment };
    },
    async updateStatus(id, status) {
      const existing = enrollments.get(id);
      if (!existing) throw new Error(`no fake enrollment ${id}`);
      const updated = { ...existing, status };
      enrollments.set(id, updated);
      return updated;
    },
  };
}

export function createFakeClassSessionRepository(
  seed: ClassSessionRecord[] = [],
): ClassSessionRepository {
  const sessions = new Map(seed.map((s) => [s.id, s]));

  return {
    async findByBatch(batchId) {
      return [...sessions.values()].filter((s) => s.batchId === batchId);
    },
    async findById(id) {
      return sessions.get(id) ?? null;
    },
    async findByBatchAndDate(batchId, sessionDate) {
      return (
        [...sessions.values()].find(
          (s) => s.batchId === batchId && s.sessionDate.getTime() === sessionDate.getTime(),
        ) ?? null
      );
    },
    async create(input) {
      const record: ClassSessionRecord = { id: randomUUID(), status: 'SCHEDULED', ...input };
      sessions.set(record.id, record);
      return record;
    },
  };
}

export function createFakeAttendanceRepository(
  seed: AttendanceRecord[] = [],
  classSessionRepo?: ClassSessionRepository,
): AttendanceRepository {
  const attendances = new Map(seed.map((a) => [a.id, a]));

  return {
    async findBySession(classSessionId) {
      return [...attendances.values()].filter((a) => a.classSessionId === classSessionId);
    },
    async findByStudent(studentProfileId): Promise<StudentAttendanceRecord[]> {
      const records: StudentAttendanceRecord[] = [];
      for (const attendance of attendances.values()) {
        if (attendance.studentProfileId !== studentProfileId) continue;
        const session = await classSessionRepo?.findById(attendance.classSessionId);
        if (!session) continue;
        records.push({ ...attendance, sessionDate: session.sessionDate, batchId: session.batchId });
      }
      return records;
    },
    async upsertMany(classSessionId, records: AttendanceUpsertInput[]) {
      const result: AttendanceRecord[] = [];
      for (const record of records) {
        const existing = [...attendances.values()].find(
          (a) => a.classSessionId === classSessionId && a.studentProfileId === record.studentProfileId,
        );
        const updated: AttendanceRecord = {
          id: existing?.id ?? randomUUID(),
          classSessionId,
          studentProfileId: record.studentProfileId,
          status: record.status,
          remarks: record.remarks ?? null,
          markedAt: new Date(),
        };
        attendances.set(updated.id, updated);
        result.push(updated);
      }
      return result;
    },
  };
}

export function createFakeAuditLogRepository(): AuditLogRepository {
  const logs: AuditLogRecord[] = [];

  return {
    async create(input) {
      const record: AuditLogRecord = {
        id: randomUUID(),
        createdAt: new Date(),
        before: null,
        after: null,
        ipAddress: null,
        ...input,
      };
      logs.push(record);
      return record;
    },
  };
}


