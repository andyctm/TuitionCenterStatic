import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import { timeRangesOverlap } from './scheduleOverlap';
import type { AuthContext } from '../types/authContext';
import type {
  BatchListFilter,
  BatchRecord,
  BatchRepository,
  BranchRepository,
  ClassScheduleRecord,
  ClassScheduleRepository,
  CourseRepository,
  NewBatchInput,
  NewClassScheduleInput,
  UpdateBatchInput,
} from '../repositories/types';

export type BatchesServiceDeps = {
  batchRepo: BatchRepository;
  courseRepo: CourseRepository;
  branchRepo: BranchRepository;
  classScheduleRepo: ClassScheduleRepository;
};

export type BatchListQuery = Omit<BatchListFilter, 'branchIds' | 'teacherUserId'>;

function assertInScope(ctx: AuthContext, batch: BatchRecord): void {
  if (isSuperAdmin(ctx)) return;
  if (ctx.role === 'TEACHER') {
    if (batch.teacherUserId === ctx.userId) return;
    throw new AppError('NOT_FOUND', 404, 'Batch not found');
  }
  if (!isInBranchScope(ctx, batch.branchId)) {
    throw new AppError('NOT_FOUND', 404, 'Batch not found');
  }
}

export function createBatchesService(deps: BatchesServiceDeps) {
  const { batchRepo, courseRepo, branchRepo, classScheduleRepo } = deps;

  async function requireBatch(id: string): Promise<BatchRecord> {
    const batch = await batchRepo.findById(id);
    if (!batch) {
      throw new AppError('NOT_FOUND', 404, 'Batch not found');
    }
    return batch;
  }

  return {
    async list(ctx: AuthContext, query: BatchListQuery): Promise<BatchRecord[]> {
      const filter: BatchListFilter = { ...query };
      if (ctx.role === 'TEACHER') {
        filter.teacherUserId = ctx.userId;
      } else if (!isSuperAdmin(ctx)) {
        filter.branchIds = ctx.branchIds;
      }
      return batchRepo.findAll(filter);
    },

    async getById(ctx: AuthContext, id: string): Promise<BatchRecord> {
      const batch = await requireBatch(id);
      assertInScope(ctx, batch);
      return batch;
    },

    async create(input: NewBatchInput): Promise<BatchRecord> {
      const course = await courseRepo.findById(input.courseId);
      if (!course) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unknown courseId', [
          { field: 'courseId', issue: 'no course with this id exists' },
        ]);
      }
      const branch = await branchRepo.findById(input.branchId);
      if (!branch) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unknown branchId', [
          { field: 'branchId', issue: 'no branch with this id exists' },
        ]);
      }
      return batchRepo.create(input);
    },

    async update(id: string, input: UpdateBatchInput): Promise<BatchRecord> {
      await requireBatch(id);
      return batchRepo.update(id, input);
    },

    async archive(id: string): Promise<BatchRecord> {
      await requireBatch(id);
      return batchRepo.update(id, { status: 'ARCHIVED' });
    },

    async addSchedule(
      batchId: string,
      input: Omit<NewClassScheduleInput, 'batchId'>,
    ): Promise<ClassScheduleRecord> {
      const batch = await requireBatch(batchId);
      if (batch.status === 'ARCHIVED') {
        throw new AppError('CONFLICT', 409, 'Cannot schedule an archived batch');
      }

      const candidates = await classScheduleRepo.findConflictCandidates(
        batch.branchId,
        input.dayOfWeek,
      );
      const conflict = candidates.some((candidate) => {
        const sameRoom = candidate.room === batch.room;
        const sameTeacher =
          batch.teacherUserId !== null && candidate.teacherUserId === batch.teacherUserId;
        if (!sameRoom && !sameTeacher) return false;
        return timeRangesOverlap(candidate.startTime, candidate.endTime, input.startTime, input.endTime);
      });
      if (conflict) {
        throw new AppError(
          'CONFLICT',
          409,
          'This schedule overlaps an existing booking for the same teacher or room',
        );
      }

      return classScheduleRepo.create({ ...input, batchId });
    },

    async removeSchedule(batchId: string, scheduleId: string): Promise<void> {
      const schedule = await classScheduleRepo.findById(scheduleId);
      if (!schedule || schedule.batchId !== batchId) {
        throw new AppError('NOT_FOUND', 404, 'Schedule not found');
      }
      await classScheduleRepo.delete(scheduleId);
    },
  };
}

export type BatchesService = ReturnType<typeof createBatchesService>;
