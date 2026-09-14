import type { EnrollmentStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  BatchRepository,
  EnrollmentListFilter,
  EnrollmentRecord,
  EnrollmentRepository,
  ParentStudentRepository,
  StudentProfileRepository,
} from '../repositories/types';

export type EnrollmentServiceDeps = {
  enrollmentRepo: EnrollmentRepository;
  batchRepo: BatchRepository;
  studentProfileRepo: StudentProfileRepository;
  parentStudentRepo: ParentStudentRepository;
};

export type EnrollmentListQuery = Omit<EnrollmentListFilter, 'branchIds' | 'studentProfileIds'>;

export function createEnrollmentService(deps: EnrollmentServiceDeps) {
  const { enrollmentRepo, batchRepo, studentProfileRepo, parentStudentRepo } = deps;

  async function requireBatchInScope(ctx: AuthContext, batchId: string) {
    const batch = await batchRepo.findById(batchId);
    if (!batch || !isInBranchScope(ctx, batch.branchId)) {
      throw new AppError('NOT_FOUND', 404, 'Batch not found');
    }
    return batch;
  }

  return {
    async list(ctx: AuthContext, query: EnrollmentListQuery): Promise<EnrollmentRecord[]> {
      if (ctx.role === 'STUDENT') {
        const profile = await studentProfileRepo.findByUserId(ctx.userId);
        if (!profile) return [];
        return enrollmentRepo.findAll({ ...query, studentProfileIds: [profile.id] });
      }
      if (ctx.role === 'PARENT') {
        const studentProfileIds = await parentStudentRepo.listStudentProfileIdsForParent(
          ctx.userId,
        );
        if (studentProfileIds.length === 0) return [];
        return enrollmentRepo.findAll({ ...query, studentProfileIds });
      }

      const filter: EnrollmentListFilter = { ...query };
      if (!isSuperAdmin(ctx)) {
        filter.branchIds = ctx.branchIds;
      }
      return enrollmentRepo.findAll(filter);
    },

    async create(
      ctx: AuthContext,
      input: { batchId: string; studentProfileId: string },
    ): Promise<EnrollmentRecord> {
      const studentProfile = await studentProfileRepo.findById(input.studentProfileId);
      if (!studentProfile) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unknown studentProfileId', [
          { field: 'studentProfileId', issue: 'no student profile with this id exists' },
        ]);
      }

      const batch = await batchRepo.findById(input.batchId);
      if (!batch) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unknown batchId', [
          { field: 'batchId', issue: 'no batch with this id exists' },
        ]);
      }
      if (!isInBranchScope(ctx, batch.branchId)) {
        throw new AppError('NOT_FOUND', 404, 'Batch not found');
      }
      if (batch.status === 'ARCHIVED') {
        throw new AppError('CONFLICT', 409, 'Cannot enroll into an archived batch');
      }

      const result = await enrollmentRepo.createIfCapacityAvailable({
        batchId: input.batchId,
        studentProfileId: input.studentProfileId,
        capacity: batch.capacity,
      });

      if (result.outcome === 'AT_CAPACITY') {
        throw new AppError('CONFLICT', 409, 'Batch has reached its enrollment capacity', [
          { field: 'batchId', issue: `capacity ${batch.capacity}/${batch.capacity} reached` },
        ]);
      }
      if (result.outcome === 'DUPLICATE') {
        throw new AppError('CONFLICT', 409, 'Student is already enrolled in this batch');
      }
      return result.enrollment;
    },

    async updateStatus(
      ctx: AuthContext,
      id: string,
      status: EnrollmentStatus,
    ): Promise<EnrollmentRecord> {
      const enrollment = await enrollmentRepo.findById(id);
      if (!enrollment) {
        throw new AppError('NOT_FOUND', 404, 'Enrollment not found');
      }
      await requireBatchInScope(ctx, enrollment.batchId);
      return enrollmentRepo.updateStatus(id, status);
    },
  };
}

export type EnrollmentService = ReturnType<typeof createEnrollmentService>;
