import type {
  BatchRepository,
  ClassScheduleRepository,
  ClassSessionRepository,
} from '../repositories/types';

export type MaterializeSessionsDeps = {
  batchRepo: BatchRepository;
  classScheduleRepo: ClassScheduleRepository;
  classSessionRepo: ClassSessionRepository;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// attendance capability (FR-ATT-1): materialize upcoming ClassSession rows from each active
// batch's recurring ClassSchedule, idempotently (safe to run on every cron tick).
export async function materializeUpcomingSessions(
  deps: MaterializeSessionsDeps,
  options: { daysAhead?: number; now?: Date } = {},
): Promise<{ created: number }> {
  const daysAhead = options.daysAhead ?? 14;
  const today = startOfUtcDay(options.now ?? new Date());

  const activeBatches = await deps.batchRepo.findAll({ status: 'ACTIVE' });
  let created = 0;

  for (const batch of activeBatches) {
    const schedules = await deps.classScheduleRepo.findByBatch(batch.id);
    if (schedules.length === 0) continue;

    for (let offset = 0; offset < daysAhead; offset += 1) {
      const sessionDate = addUtcDays(today, offset);
      const dayOfWeek = sessionDate.getUTCDay();
      const hasMatchingSchedule = schedules.some((s) => s.dayOfWeek === dayOfWeek);
      if (!hasMatchingSchedule) continue;

      const existing = await deps.classSessionRepo.findByBatchAndDate(batch.id, sessionDate);
      if (existing) continue;

      await deps.classSessionRepo.create({ batchId: batch.id, sessionDate });
      created += 1;
    }
  }

  return { created };
}

export function createSessionMaterializationService(deps: MaterializeSessionsDeps) {
  return {
    run(options?: { daysAhead?: number; now?: Date }) {
      return materializeUpcomingSessions(deps, options);
    },
  };
}

export type SessionMaterializationService = ReturnType<typeof createSessionMaterializationService>;
