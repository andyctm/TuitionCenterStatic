import { describe, expect, it } from 'vitest';
import { materializeUpcomingSessions } from './sessionMaterializationService';
import {
  createFakeBatchRepository,
  createFakeClassScheduleRepository,
  createFakeClassSessionRepository,
} from '../testUtils/fakeRepositories';
import type { BatchRecord } from '../repositories/types';

function seedBatch(overrides: Partial<BatchRecord> = {}): BatchRecord {
  return {
    id: 'batch_1',
    courseId: 'course_1',
    branchId: 'branch_1',
    teacherUserId: 'teacher_1',
    room: 'Room A',
    capacity: 20,
    term: '2026-T3',
    status: 'ACTIVE',
    ...overrides,
  };
}

// 2026-09-14 is a Monday (dayOfWeek=1).
const NOW = new Date('2026-09-14T08:00:00.000Z');

describe('materializeUpcomingSessions', () => {
  it('creates a session for each matching weekday within the window', async () => {
    const batchRepo = createFakeBatchRepository([seedBatch()]);
    const classScheduleRepo = createFakeClassScheduleRepository(
      [{ id: 'sched_1', batchId: 'batch_1', dayOfWeek: 1, startTime: '16:00', endTime: '17:00' }],
      batchRepo,
    );
    const classSessionRepo = createFakeClassSessionRepository();

    const result = await materializeUpcomingSessions(
      { batchRepo, classScheduleRepo, classSessionRepo },
      { daysAhead: 14, now: NOW },
    );

    // Mondays in a 14-day window starting on a Monday: today + 7 days later = 2 occurrences.
    expect(result.created).toBe(2);
    const sessions = await classSessionRepo.findByBatch('batch_1');
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.status === 'SCHEDULED')).toBe(true);
  });

  it('is idempotent when run twice back-to-back', async () => {
    const batchRepo = createFakeBatchRepository([seedBatch()]);
    const classScheduleRepo = createFakeClassScheduleRepository(
      [{ id: 'sched_1', batchId: 'batch_1', dayOfWeek: 1, startTime: '16:00', endTime: '17:00' }],
      batchRepo,
    );
    const classSessionRepo = createFakeClassSessionRepository();
    const deps = { batchRepo, classScheduleRepo, classSessionRepo };

    const first = await materializeUpcomingSessions(deps, { daysAhead: 14, now: NOW });
    const second = await materializeUpcomingSessions(deps, { daysAhead: 14, now: NOW });

    expect(first.created).toBe(2);
    expect(second.created).toBe(0);
    const sessions = await classSessionRepo.findByBatch('batch_1');
    expect(sessions).toHaveLength(2);
  });

  it('skips archived batches', async () => {
    const batchRepo = createFakeBatchRepository([seedBatch({ status: 'ARCHIVED' })]);
    const classScheduleRepo = createFakeClassScheduleRepository(
      [{ id: 'sched_1', batchId: 'batch_1', dayOfWeek: 1, startTime: '16:00', endTime: '17:00' }],
      batchRepo,
    );
    const classSessionRepo = createFakeClassSessionRepository();

    const result = await materializeUpcomingSessions(
      { batchRepo, classScheduleRepo, classSessionRepo },
      { daysAhead: 14, now: NOW },
    );

    expect(result.created).toBe(0);
  });

  it('skips batches with no schedules', async () => {
    const batchRepo = createFakeBatchRepository([seedBatch()]);
    const classScheduleRepo = createFakeClassScheduleRepository([], batchRepo);
    const classSessionRepo = createFakeClassSessionRepository();

    const result = await materializeUpcomingSessions(
      { batchRepo, classScheduleRepo, classSessionRepo },
      { daysAhead: 14, now: NOW },
    );

    expect(result.created).toBe(0);
  });
});
