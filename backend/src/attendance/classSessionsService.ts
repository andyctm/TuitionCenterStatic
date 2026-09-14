import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  BatchRecord,
  BatchRepository,
  ClassSessionRecord,
  ClassSessionRepository,
} from '../repositories/types';

export type ClassSessionsServiceDeps = {
  classSessionRepo: ClassSessionRepository;
  batchRepo: BatchRepository;
};

// Branch scoping only (Super Admin/Teacher are exempted here — Teacher ownership is checked
// separately by each action below, since the correct status code differs by action: 404 for
// reads (IDOR-avoidance, 04-api-specification.md §1.2), 403 for the documented "wrong teacher"
// mutation scenarios (06-sdd.md `attendance` capability, 05-roles-permissions.md worked examples).
function assertBranchScope(ctx: AuthContext, batch: BatchRecord): void {
  if (isSuperAdmin(ctx) || ctx.role === 'TEACHER') return;
  if (!isInBranchScope(ctx, batch.branchId)) {
    throw new AppError('NOT_FOUND', 404, 'Batch not found');
  }
}

export function createClassSessionsService(deps: ClassSessionsServiceDeps) {
  const { classSessionRepo, batchRepo } = deps;

  async function requireBatch(batchId: string): Promise<BatchRecord> {
    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new AppError('NOT_FOUND', 404, 'Batch not found');
    }
    return batch;
  }

  return {
    async list(ctx: AuthContext, batchId: string): Promise<ClassSessionRecord[]> {
      const batch = await requireBatch(batchId);
      assertBranchScope(ctx, batch);
      if (ctx.role === 'TEACHER' && batch.teacherUserId !== ctx.userId) {
        throw new AppError('NOT_FOUND', 404, 'Batch not found');
      }
      return classSessionRepo.findByBatch(batchId);
    },

    async createAdHoc(
      ctx: AuthContext,
      batchId: string,
      input: { sessionDate: Date },
    ): Promise<ClassSessionRecord> {
      const batch = await requireBatch(batchId);
      assertBranchScope(ctx, batch);
      if (ctx.role === 'TEACHER' && batch.teacherUserId !== ctx.userId) {
        throw new AppError('FORBIDDEN', 403, 'You are not the assigned teacher for this batch');
      }

      const existing = await classSessionRepo.findByBatchAndDate(batchId, input.sessionDate);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'A session already exists for this batch and date');
      }

      return classSessionRepo.create({ batchId, sessionDate: input.sessionDate });
    },
  };
}

export type ClassSessionsService = ReturnType<typeof createClassSessionsService>;
