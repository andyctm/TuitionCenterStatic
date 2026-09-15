import { describe, expect, it } from 'vitest';
import { createEnrollmentService } from './enrollmentService';
import {
  createFakeBatchRepository,
  createFakeCourseRepository,
  createFakeEnrollmentRepository,
  createFakeGradeLevelRepository,
  createFakeParentStudentRepository,
  createFakeStudentProfileRepository,
  createFakeUserRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type { BatchRecord, EnrollmentRecord, StudentProfileRecord } from '../repositories/types';

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
    capacity: 2,
    term: '2026-T3',
    status: 'ACTIVE',
    ...overrides,
  };
}

function seedProfile(overrides: Partial<StudentProfileRecord> = {}): StudentProfileRecord {
  return { id: 'stu_1', userId: 'student_user_1', ...overrides };
}

function makeDeps(options: {
  batches?: BatchRecord[];
  profiles?: StudentProfileRecord[];
  enrollments?: EnrollmentRecord[];
  parentLinks?: { parentUserId: string; studentProfileId: string }[];
} = {}) {
  const batchRepo = createFakeBatchRepository(options.batches ?? [seedBatch()]);
  const studentProfileRepo = createFakeStudentProfileRepository(
    options.profiles ?? [seedProfile()],
  );
  const parentStudentRepo = createFakeParentStudentRepository(options.parentLinks ?? []);
  const enrollmentRepo = createFakeEnrollmentRepository(options.enrollments ?? [], batchRepo);
  const userRepo = createFakeUserRepository([]);
  const courseRepo = createFakeCourseRepository([]);
  const gradeLevelRepo = createFakeGradeLevelRepository([]);
  return {
    batchRepo,
    studentProfileRepo,
    parentStudentRepo,
    enrollmentRepo,
    userRepo,
    courseRepo,
    gradeLevelRepo,
  };
}

describe('enrollmentService.create', () => {
  it('rejects an unknown batchId with 400', async () => {
    const deps = makeDeps();
    const service = createEnrollmentService(deps);

    await expect(
      service.create(ctx(), { batchId: 'missing', studentProfileId: 'stu_1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
  });

  it('rejects an unknown studentProfileId with 400', async () => {
    const deps = makeDeps();
    const service = createEnrollmentService(deps);

    await expect(
      service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'missing' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
  });

  it('returns 404 for a batch outside the caller branch scope', async () => {
    const deps = makeDeps({ batches: [seedBatch({ branchId: 'branch_kandy' })] });
    const service = createEnrollmentService(deps);

    await expect(
      service.create(ctx({ role: 'ACCOUNTANT', branchIds: ['branch_colombo'] }), {
        batchId: 'batch_1',
        studentProfileId: 'stu_1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('rejects enrollment into an archived batch with 409', async () => {
    const deps = makeDeps({ batches: [seedBatch({ status: 'ARCHIVED' })] });
    const service = createEnrollmentService(deps);

    await expect(
      service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'stu_1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('rejects a duplicate active enrollment with 409', async () => {
    const existing: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({ enrollments: [existing] });
    const service = createEnrollmentService(deps);

    await expect(
      service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'stu_1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('rejects enrollment once the batch is at capacity', async () => {
    const capacity1 = seedBatch({ capacity: 1 });
    const otherStudent = seedProfile({ id: 'stu_2', userId: 'student_user_2' });
    const existing: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_2',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({
      batches: [capacity1],
      profiles: [seedProfile(), otherStudent],
      enrollments: [existing],
    });
    const service = createEnrollmentService(deps);

    await expect(
      service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'stu_1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('succeeds when a seat is available', async () => {
    const deps = makeDeps();
    const service = createEnrollmentService(deps);

    const result = await service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'stu_1' });

    expect(result).toMatchObject({ batchId: 'batch_1', studentProfileId: 'stu_1', status: 'ACTIVE' });
  });

  it('resolves exactly one winner when two requests race for the last seat', async () => {
    const capacity1 = seedBatch({ capacity: 1 });
    const otherStudent = seedProfile({ id: 'stu_2', userId: 'student_user_2' });
    const deps = makeDeps({ batches: [capacity1], profiles: [seedProfile(), otherStudent] });
    const service = createEnrollmentService(deps);

    const results = await Promise.allSettled([
      service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'stu_1' }),
      service.create(ctx(), { batchId: 'batch_1', studentProfileId: 'stu_2' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'CONFLICT',
      httpStatus: 409,
    });
  });
});

describe('enrollmentService.list scoping', () => {
  it('returns every enrollment for a Super Admin', async () => {
    const existing: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({ enrollments: [existing] });
    const service = createEnrollmentService(deps);

    const result = await service.list(ctx({ role: 'SUPER_ADMIN' }), {});

    expect(result).toHaveLength(1);
  });

  it('restricts a Center Admin to their assigned branch', async () => {
    const colombo = seedBatch({ id: 'batch_colombo', branchId: 'branch_colombo' });
    const kandy = seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy' });
    const inColombo: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_colombo',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const inKandy: EnrollmentRecord = {
      id: 'enr_2',
      batchId: 'batch_kandy',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({ batches: [colombo, kandy], enrollments: [inColombo, inKandy] });
    const service = createEnrollmentService(deps);

    const result = await service.list(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      {},
    );

    expect(result.map((e) => e.id)).toEqual(['enr_1']);
  });

  it('restricts a Student to their own enrollments only', async () => {
    const own: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const other: EnrollmentRecord = {
      id: 'enr_2',
      batchId: 'batch_1',
      studentProfileId: 'stu_2',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({
      profiles: [seedProfile(), seedProfile({ id: 'stu_2', userId: 'student_user_2' })],
      enrollments: [own, other],
    });
    const service = createEnrollmentService(deps);

    const result = await service.list(
      ctx({ role: 'STUDENT', userId: 'student_user_1', branchIds: [] }),
      {},
    );

    expect(result.map((e) => e.id)).toEqual(['enr_1']);
  });

  it("restricts a Parent to their children's enrollments only", async () => {
    const child: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const stranger: EnrollmentRecord = {
      id: 'enr_2',
      batchId: 'batch_1',
      studentProfileId: 'stu_2',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({
      profiles: [seedProfile(), seedProfile({ id: 'stu_2', userId: 'student_user_2' })],
      enrollments: [child, stranger],
      parentLinks: [{ parentUserId: 'parent_1', studentProfileId: 'stu_1' }],
    });
    const service = createEnrollmentService(deps);

    const result = await service.list(ctx({ role: 'PARENT', userId: 'parent_1', branchIds: [] }), {});

    expect(result.map((e) => e.id)).toEqual(['enr_1']);
  });
});

describe('enrollmentService.updateStatus', () => {
  it('throws 404 for a non-existent enrollment', async () => {
    const deps = makeDeps();
    const service = createEnrollmentService(deps);

    await expect(
      service.updateStatus(ctx(), 'missing', 'WITHDRAWN'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('returns 404 when the enrollment batch is outside the caller branch scope', async () => {
    const kandyBatch = seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy' });
    const existing: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_kandy',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({ batches: [kandyBatch], enrollments: [existing] });
    const service = createEnrollmentService(deps);

    await expect(
      service.updateStatus(
        ctx({ role: 'ACCOUNTANT', branchIds: ['branch_colombo'] }),
        'enr_1',
        'WITHDRAWN',
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('updates the status for an in-scope enrollment', async () => {
    const existing: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
    };
    const deps = makeDeps({ enrollments: [existing] });
    const service = createEnrollmentService(deps);

    const result = await service.updateStatus(ctx(), 'enr_1', 'WITHDRAWN');

    expect(result.status).toBe('WITHDRAWN');
  });
});
