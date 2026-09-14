import { describe, expect, it } from 'vitest';
import { createClassSessionsService } from './classSessionsService';
import {
  createFakeBatchRepository,
  createFakeClassSessionRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type { BatchRecord } from '../repositories/types';

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

function makeDeps(batches = [seedBatch()]) {
  const batchRepo = createFakeBatchRepository(batches);
  const classSessionRepo = createFakeClassSessionRepository();
  return { batchRepo, classSessionRepo };
}

describe('classSessionsService.list', () => {
  it('returns 404 for a batch outside the caller branch scope', async () => {
    const deps = makeDeps([seedBatch({ branchId: 'branch_kandy' })]);
    const service = createClassSessionsService(deps);

    await expect(
      service.list(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }), 'batch_1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('returns sessions for an in-scope batch', async () => {
    const deps = makeDeps();
    const service = createClassSessionsService(deps);
    await deps.classSessionRepo.create({ batchId: 'batch_1', sessionDate: new Date('2026-09-14') });

    const result = await service.list(ctx(), 'batch_1');

    expect(result).toHaveLength(1);
  });
});

describe('classSessionsService.createAdHoc', () => {
  it('returns 403 for a Teacher who does not teach the batch', async () => {
    const deps = makeDeps([seedBatch({ teacherUserId: 'teacher_2' })]);
    const service = createClassSessionsService(deps);

    await expect(
      service.createAdHoc(ctx({ role: 'TEACHER', userId: 'teacher_1' }), 'batch_1', {
        sessionDate: new Date('2026-09-14'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('rejects a duplicate session date with 409', async () => {
    const deps = makeDeps();
    const service = createClassSessionsService(deps);
    const sessionDate = new Date('2026-09-14');
    await service.createAdHoc(ctx(), 'batch_1', { sessionDate });

    await expect(service.createAdHoc(ctx(), 'batch_1', { sessionDate })).rejects.toMatchObject({
      code: 'CONFLICT',
      httpStatus: 409,
    });
  });

  it('creates a session for the assigned Teacher', async () => {
    const deps = makeDeps();
    const service = createClassSessionsService(deps);

    const result = await service.createAdHoc(ctx({ role: 'TEACHER', userId: 'teacher_1' }), 'batch_1', {
      sessionDate: new Date('2026-09-14'),
    });

    expect(result.batchId).toBe('batch_1');
  });
});
