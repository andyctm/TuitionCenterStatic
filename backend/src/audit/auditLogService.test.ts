import { describe, expect, it } from 'vitest';
import { createAuditLogService } from './auditLogService';
import {
  createFakeAttendanceRepository,
  createFakeAuditLogRepository,
  createFakeBatchRepository,
  createFakeClassSessionRepository,
  createFakeUserRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRecord,
  AuditLogRecord,
  BatchRecord,
  ClassSessionRecord,
  UserRecord,
} from '../repositories/types';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'admin_1', role: 'SUPER_ADMIN', branchIds: [], ...overrides };
}

function seedUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: 'hash',
    firstName: 'A',
    lastName: 'B',
    role: 'STUDENT',
    status: 'ACTIVE',
    branchId: 'branch_colombo',
    ...overrides,
  };
}

function seedBatch(overrides: Partial<BatchRecord> = {}): BatchRecord {
  return {
    id: 'batch_1',
    courseId: 'course_1',
    branchId: 'branch_colombo',
    teacherUserId: 'teacher_1',
    room: 'Room A',
    capacity: 20,
    term: '2026-T3',
    status: 'ACTIVE',
    ...overrides,
  };
}

function seedSession(overrides: Partial<ClassSessionRecord> = {}): ClassSessionRecord {
  return { id: 'session_1', batchId: 'batch_1', sessionDate: new Date(), status: 'COMPLETED', ...overrides };
}

function seedAttendance(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'att_1',
    classSessionId: 'session_1',
    studentProfileId: 'stu_1',
    status: 'PRESENT',
    remarks: null,
    markedAt: new Date(),
    ...overrides,
  };
}

function seedLog(overrides: Partial<AuditLogRecord> = {}): AuditLogRecord {
  return {
    id: 'log_1',
    actorUserId: 'admin_9',
    entityType: 'User',
    entityId: 'user_1',
    action: 'STATUS_CHANGE',
    before: { status: 'PENDING' },
    after: { status: 'ACTIVE' },
    ipAddress: null,
    createdAt: new Date('2026-09-14T00:00:00Z'),
    ...overrides,
  };
}

function makeDeps(options: {
  logs?: AuditLogRecord[];
  users?: UserRecord[];
  batches?: BatchRecord[];
  sessions?: ClassSessionRecord[];
  attendances?: AttendanceRecord[];
} = {}) {
  const auditLogRepo = createFakeAuditLogRepository(options.logs ?? [seedLog()]);
  const userRepo = createFakeUserRepository(options.users ?? [seedUser()]);
  const batchRepo = createFakeBatchRepository(options.batches ?? [seedBatch()]);
  const classSessionRepo = createFakeClassSessionRepository(options.sessions ?? [seedSession()]);
  const attendanceRepo = createFakeAttendanceRepository(
    options.attendances ?? [seedAttendance()],
    classSessionRepo,
  );
  return { auditLogRepo, userRepo, batchRepo, classSessionRepo, attendanceRepo };
}

describe('auditLogService.list', () => {
  it('returns every row for a Super Admin, annotated with the resolved branchId', async () => {
    const deps = makeDeps();
    const service = createAuditLogService(deps);

    const logs = await service.list(ctx(), {});

    expect(logs).toEqual([{ ...seedLog(), branchId: 'branch_colombo' }]);
  });

  it('includes a User-entity row when the user belongs to the caller branch', async () => {
    const deps = makeDeps({
      users: [seedUser({ id: 'user_1', branchId: 'branch_colombo' })],
      logs: [seedLog({ entityType: 'User', entityId: 'user_1' })],
    });
    const service = createAuditLogService(deps);

    const logs = await service.list(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }), {});

    expect(logs).toHaveLength(1);
  });

  it('excludes a User-entity row when the user belongs to a different branch', async () => {
    const deps = makeDeps({
      users: [seedUser({ id: 'user_1', branchId: 'branch_kandy' })],
      logs: [seedLog({ entityType: 'User', entityId: 'user_1' })],
    });
    const service = createAuditLogService(deps);

    const logs = await service.list(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }), {});

    expect(logs).toEqual([]);
  });

  it('resolves an Attendance-entity row branch via session -> batch', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ id: 'batch_1', branchId: 'branch_colombo' })],
      sessions: [seedSession({ id: 'session_1', batchId: 'batch_1' })],
      attendances: [seedAttendance({ id: 'att_1', classSessionId: 'session_1' })],
      logs: [seedLog({ entityType: 'Attendance', entityId: 'att_1' })],
    });
    const service = createAuditLogService(deps);

    const inScope = await service.list(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      {},
    );
    const outOfScope = await service.list(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_kandy'] }),
      {},
    );

    expect(inScope).toHaveLength(1);
    expect(outOfScope).toEqual([]);
  });

  it('excludes a row with an unrecognized entityType for a non-Super-Admin (safe default deny)', async () => {
    const deps = makeDeps({ logs: [seedLog({ entityType: 'Branch', entityId: 'branch_colombo' })] });
    const service = createAuditLogService(deps);

    const logs = await service.list(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      {},
    );

    expect(logs).toEqual([]);
  });

  it('passes entityType/entityId/actorUserId filters through to the repository', async () => {
    const logA = seedLog({ id: 'log_a', entityId: 'user_1', actorUserId: 'admin_9' });
    const logB = seedLog({ id: 'log_b', entityId: 'user_2', actorUserId: 'admin_8' });
    const deps = makeDeps({
      users: [seedUser({ id: 'user_1' }), seedUser({ id: 'user_2' })],
      logs: [logA, logB],
    });
    const service = createAuditLogService(deps);

    const logs = await service.list(ctx(), { entityId: 'user_2', actorUserId: 'admin_8' });

    expect(logs).toEqual([{ ...logB, branchId: 'branch_colombo' }]);
  });
});
