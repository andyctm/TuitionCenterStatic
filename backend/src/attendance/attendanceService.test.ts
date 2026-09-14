import { describe, expect, it } from 'vitest';
import { createAttendanceService } from './attendanceService';
import {
  createFakeAttendanceRepository,
  createFakeAuditLogRepository,
  createFakeBatchRepository,
  createFakeClassSessionRepository,
  createFakeEnrollmentRepository,
  createFakeParentStudentRepository,
  createFakeStudentProfileRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type { BatchRecord, ClassSessionRecord, EnrollmentRecord, StudentProfileRecord } from '../repositories/types';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'admin_1', role: 'SUPER_ADMIN', branchIds: [], ...overrides };
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
  return {
    id: 'session_1',
    batchId: 'batch_1',
    sessionDate: new Date('2026-09-14T00:00:00.000Z'),
    status: 'SCHEDULED',
    ...overrides,
  };
}

function makeDeps(options: {
  batches?: BatchRecord[];
  sessions?: ClassSessionRecord[];
  profiles?: StudentProfileRecord[];
  enrollments?: EnrollmentRecord[];
  parentLinks?: { parentUserId: string; studentProfileId: string }[];
} = {}) {
  const batchRepo = createFakeBatchRepository(options.batches ?? [seedBatch()]);
  const classSessionRepo = createFakeClassSessionRepository(options.sessions ?? [seedSession()]);
  const attendanceRepo = createFakeAttendanceRepository([], classSessionRepo);
  const studentProfileRepo = createFakeStudentProfileRepository(
    options.profiles ?? [{ id: 'stu_1', userId: 'student_user_1' }],
  );
  const parentStudentRepo = createFakeParentStudentRepository(options.parentLinks ?? []);
  const enrollmentRepo = createFakeEnrollmentRepository(options.enrollments ?? [], batchRepo);
  const auditLogRepo = createFakeAuditLogRepository();
  return {
    batchRepo,
    classSessionRepo,
    attendanceRepo,
    studentProfileRepo,
    parentStudentRepo,
    enrollmentRepo,
    auditLogRepo,
  };
}

describe('attendanceService.bulkUpsert', () => {
  it('returns 403 for a Teacher who does not teach the batch', async () => {
    const deps = makeDeps({ batches: [seedBatch({ teacherUserId: 'teacher_2' })] });
    const service = createAttendanceService(deps);

    await expect(
      service.bulkUpsert(
        ctx({ role: 'TEACHER', userId: 'teacher_1' }),
        'session_1',
        [{ studentProfileId: 'stu_1', status: 'PRESENT' }],
        new Date('2026-09-14T01:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('returns 403 outside the 72h edit window', async () => {
    const deps = makeDeps();
    const service = createAttendanceService(deps);
    const tenDaysLater = new Date('2026-09-24T00:00:00.000Z');

    await expect(
      service.bulkUpsert(
        ctx({ role: 'TEACHER', userId: 'teacher_1' }),
        'session_1',
        [{ studentProfileId: 'stu_1', status: 'PRESENT' }],
        tenDaysLater,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('upserts attendance for the assigned Teacher within the window', async () => {
    const deps = makeDeps();
    const service = createAttendanceService(deps);

    const result = await service.bulkUpsert(
      ctx({ role: 'TEACHER', userId: 'teacher_1' }),
      'session_1',
      [{ studentProfileId: 'stu_1', status: 'PRESENT' }],
      new Date('2026-09-14T01:00:00.000Z'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ studentProfileId: 'stu_1', status: 'PRESENT' });
  });
});

describe('attendanceService.override', () => {
  it('writes an AuditLog entry capturing the reason', async () => {
    const deps = makeDeps();
    const service = createAttendanceService(deps);

    await service.bulkUpsert(
      ctx({ role: 'TEACHER', userId: 'teacher_1' }),
      'session_1',
      [{ studentProfileId: 'stu_1', status: 'ABSENT' }],
      new Date('2026-09-14T01:00:00.000Z'),
    );

    const tenDaysLater = new Date('2026-09-24T00:00:00.000Z');
    const result = await service.override(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      'session_1',
      { studentProfileId: 'stu_1', status: 'PRESENT', reason: 'parent dispute, verified' },
      tenDaysLater,
    );

    expect(result.status).toBe('PRESENT');
  });

  it('returns 404 for a Center Admin outside the batch branch', async () => {
    const deps = makeDeps({ batches: [seedBatch({ branchId: 'branch_kandy' })] });
    const service = createAttendanceService(deps);

    await expect(
      service.override(
        ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
        'session_1',
        { studentProfileId: 'stu_1', status: 'PRESENT', reason: 'test' },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });
});

describe('attendanceService.studentAttendanceHistory', () => {
  it('lets a Student view their own attendance and computes the percentage', async () => {
    const deps = makeDeps();
    const service = createAttendanceService(deps);
    await service.bulkUpsert(
      ctx({ role: 'TEACHER', userId: 'teacher_1' }),
      'session_1',
      [{ studentProfileId: 'stu_1', status: 'PRESENT' }],
      new Date('2026-09-14T01:00:00.000Z'),
    );

    const result = await service.studentAttendanceHistory(
      ctx({ role: 'STUDENT', userId: 'student_user_1' }),
      'stu_1',
    );

    expect(result.percentage).toBe(100);
    expect(result.records).toHaveLength(1);
  });

  it('returns 403 for a Student viewing a different student', async () => {
    const deps = makeDeps({
      profiles: [
        { id: 'stu_1', userId: 'student_user_1' },
        { id: 'stu_2', userId: 'student_user_2' },
      ],
    });
    const service = createAttendanceService(deps);

    await expect(
      service.studentAttendanceHistory(ctx({ role: 'STUDENT', userId: 'student_user_1' }), 'stu_2'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it("returns 403 for a Parent viewing a non-child's attendance", async () => {
    const deps = makeDeps({ parentLinks: [{ parentUserId: 'parent_1', studentProfileId: 'stu_9' }] });
    const service = createAttendanceService(deps);

    await expect(
      service.studentAttendanceHistory(ctx({ role: 'PARENT', userId: 'parent_1' }), 'stu_1'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('lets a Parent view their own child attendance', async () => {
    const deps = makeDeps({ parentLinks: [{ parentUserId: 'parent_1', studentProfileId: 'stu_1' }] });
    const service = createAttendanceService(deps);

    const result = await service.studentAttendanceHistory(
      ctx({ role: 'PARENT', userId: 'parent_1' }),
      'stu_1',
    );

    expect(result.percentage).toBe(0);
  });

  it("returns 404 for a Teacher who doesn't teach the student's batch", async () => {
    const enrollment: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({ enrollments: [enrollment] });
    const service = createAttendanceService(deps);

    await expect(
      service.studentAttendanceHistory(ctx({ role: 'TEACHER', userId: 'teacher_9' }), 'stu_1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });
});
