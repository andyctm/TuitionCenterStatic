import { describe, expect, it } from 'vitest';
import { createBatchesService } from './batchesService';
import {
  createFakeBatchRepository,
  createFakeBranchRepository,
  createFakeClassScheduleRepository,
  createFakeCourseRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type { BatchRecord, BranchRecord, CourseRecord } from '../repositories/types';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'admin_1', role: 'SUPER_ADMIN', branchIds: [], ...overrides };
}

function makeDeps(seedBatches: BatchRecord[] = []) {
  const branchRepo = createFakeBranchRepository([
    { id: 'branch_colombo', name: 'Colombo', timezone: 'Asia/Colombo', isActive: true },
    { id: 'branch_kandy', name: 'Kandy', timezone: 'Asia/Colombo', isActive: true },
  ] satisfies BranchRecord[]);
  const courseRepo = createFakeCourseRepository([
    { id: 'course_1', subjectId: 'subj_1', gradeLevelId: 'grade_1', name: 'Primary 3 Math' },
  ] satisfies CourseRecord[]);
  const batchRepo = createFakeBatchRepository(seedBatches);
  const classScheduleRepo = createFakeClassScheduleRepository([], batchRepo);
  return { branchRepo, courseRepo, batchRepo, classScheduleRepo };
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

describe('batchesService.create', () => {
  it('rejects an unknown courseId with 400', async () => {
    const deps = makeDeps();
    const service = createBatchesService(deps);

    await expect(
      service.create({
        courseId: 'missing',
        branchId: 'branch_colombo',
        room: 'Room A',
        capacity: 20,
        term: '2026-T3',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
  });

  it('rejects an unknown branchId with 400', async () => {
    const deps = makeDeps();
    const service = createBatchesService(deps);

    await expect(
      service.create({
        courseId: 'course_1',
        branchId: 'missing',
        room: 'Room A',
        capacity: 20,
        term: '2026-T3',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
  });

  it('creates a batch for a valid course and branch', async () => {
    const deps = makeDeps();
    const service = createBatchesService(deps);

    const result = await service.create({
      courseId: 'course_1',
      branchId: 'branch_colombo',
      room: 'Room A',
      capacity: 20,
      term: '2026-T3',
    });

    expect(result).toMatchObject({ room: 'Room A', status: 'ACTIVE' });
  });
});

describe('batchesService.list scoping', () => {
  it('returns every batch for a Super Admin', async () => {
    const colombo = seedBatch({ id: 'b1', branchId: 'branch_colombo' });
    const kandy = seedBatch({ id: 'b2', branchId: 'branch_kandy' });
    const deps = makeDeps([colombo, kandy]);
    const service = createBatchesService(deps);

    const result = await service.list(ctx({ role: 'SUPER_ADMIN' }), {});

    expect(result.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('restricts a Center Admin to their assigned branch', async () => {
    const colombo = seedBatch({ id: 'b1', branchId: 'branch_colombo' });
    const kandy = seedBatch({ id: 'b2', branchId: 'branch_kandy' });
    const deps = makeDeps([colombo, kandy]);
    const service = createBatchesService(deps);

    const result = await service.list(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      {},
    );

    expect(result.map((b) => b.id)).toEqual(['b1']);
  });

  it('restricts a Teacher to their own batches only', async () => {
    const own = seedBatch({ id: 'b1', teacherUserId: 'teacher_1' });
    const other = seedBatch({ id: 'b2', teacherUserId: 'teacher_2' });
    const deps = makeDeps([own, other]);
    const service = createBatchesService(deps);

    const result = await service.list(
      ctx({ role: 'TEACHER', userId: 'teacher_1', branchIds: ['branch_colombo'] }),
      {},
    );

    expect(result.map((b) => b.id)).toEqual(['b1']);
  });
});

describe('batchesService.getById scoping', () => {
  it('returns 404 for a Center Admin requesting an out-of-scope batch', async () => {
    const kandy = seedBatch({ id: 'b2', branchId: 'branch_kandy' });
    const deps = makeDeps([kandy]);
    const service = createBatchesService(deps);

    await expect(
      service.getById(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }), 'b2'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('returns 404 for a Teacher requesting a batch they do not teach', async () => {
    const other = seedBatch({ id: 'b1', teacherUserId: 'teacher_2' });
    const deps = makeDeps([other]);
    const service = createBatchesService(deps);

    await expect(
      service.getById(ctx({ role: 'TEACHER', userId: 'teacher_1' }), 'b1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });
});

describe('batchesService.archive', () => {
  it('sets status to ARCHIVED', async () => {
    const deps = makeDeps([seedBatch()]);
    const service = createBatchesService(deps);

    const result = await service.archive('batch_1');

    expect(result.status).toBe('ARCHIVED');
  });

  it('throws 404 for a non-existent batch', async () => {
    const deps = makeDeps();
    const service = createBatchesService(deps);

    await expect(service.archive('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });
});

describe('batchesService.addSchedule', () => {
  it('rejects adding a schedule to an archived batch with 409', async () => {
    const deps = makeDeps([seedBatch({ status: 'ARCHIVED' })]);
    const service = createBatchesService(deps);

    await expect(
      service.addSchedule('batch_1', { dayOfWeek: 1, startTime: '16:00', endTime: '17:00' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('rejects a teacher double-booking even in a different room', async () => {
    const deps = makeDeps([
      seedBatch({ id: 'b1', teacherUserId: 'teacher_1', room: 'Room A' }),
      seedBatch({ id: 'b2', teacherUserId: 'teacher_1', room: 'Room B' }),
    ]);
    const service = createBatchesService(deps);
    await service.addSchedule('b1', { dayOfWeek: 3, startTime: '17:45', endTime: '19:15' });

    await expect(
      service.addSchedule('b2', { dayOfWeek: 3, startTime: '18:00', endTime: '19:00' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('rejects a room double-booking even for different teachers', async () => {
    const deps = makeDeps([
      seedBatch({ id: 'b1', teacherUserId: 'teacher_1', room: 'Room A' }),
      seedBatch({ id: 'b2', teacherUserId: 'teacher_5', room: 'Room A' }),
    ]);
    const service = createBatchesService(deps);
    await service.addSchedule('b1', { dayOfWeek: 1, startTime: '16:00', endTime: '17:30' });

    await expect(
      service.addSchedule('b2', { dayOfWeek: 1, startTime: '17:00', endTime: '18:00' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('allows back-to-back schedules that only touch at the boundary', async () => {
    const deps = makeDeps([
      seedBatch({ id: 'b1', teacherUserId: 'teacher_1', room: 'Room A' }),
      seedBatch({ id: 'b2', teacherUserId: 'teacher_1', room: 'Room A' }),
    ]);
    const service = createBatchesService(deps);
    await service.addSchedule('b1', { dayOfWeek: 1, startTime: '16:00', endTime: '17:00' });

    const result = await service.addSchedule('b2', {
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '18:00',
    });

    expect(result.startTime).toBe('17:00');
  });

  it('allows an overlapping time slot in a different branch', async () => {
    const deps = makeDeps([
      seedBatch({ id: 'b1', branchId: 'branch_colombo', teacherUserId: 'teacher_9', room: 'Room A' }),
      seedBatch({ id: 'b2', branchId: 'branch_kandy', teacherUserId: 'teacher_9', room: 'Room A' }),
    ]);
    const service = createBatchesService(deps);
    await service.addSchedule('b1', { dayOfWeek: 1, startTime: '16:00', endTime: '17:00' });

    const result = await service.addSchedule('b2', {
      dayOfWeek: 1,
      startTime: '16:30',
      endTime: '17:30',
    });

    expect(result.batchId).toBe('b2');
  });
});

describe('batchesService.removeSchedule', () => {
  it('throws 404 when the schedule does not belong to the batch', async () => {
    const deps = makeDeps([seedBatch({ id: 'b1' }), seedBatch({ id: 'b2' })]);
    const service = createBatchesService(deps);
    const schedule = await service.addSchedule('b1', {
      dayOfWeek: 1,
      startTime: '16:00',
      endTime: '17:00',
    });

    await expect(service.removeSchedule('b2', schedule.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('removes an existing schedule', async () => {
    const deps = makeDeps([seedBatch({ id: 'b1' })]);
    const service = createBatchesService(deps);
    const schedule = await service.addSchedule('b1', {
      dayOfWeek: 1,
      startTime: '16:00',
      endTime: '17:00',
    });

    await service.removeSchedule('b1', schedule.id);

    expect(await deps.classScheduleRepo.findById(schedule.id)).toBeNull();
  });
});
