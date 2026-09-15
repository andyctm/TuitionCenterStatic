import type { EnrollmentStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  BatchRepository,
  CourseRepository,
  EnrollmentListFilter,
  EnrollmentRecord,
  EnrollmentRepository,
  GradeLevelRepository,
  ParentStudentRepository,
  StudentProfileRepository,
  UserRepository,
} from '../repositories/types';

export type EnrollmentServiceDeps = {
  enrollmentRepo: EnrollmentRepository;
  batchRepo: BatchRepository;
  studentProfileRepo: StudentProfileRepository;
  parentStudentRepo: ParentStudentRepository;
  userRepo: UserRepository;
  courseRepo: CourseRepository;
  gradeLevelRepo: GradeLevelRepository;
};

export type EnrollmentListQuery = Omit<EnrollmentListFilter, 'branchIds' | 'studentProfileIds'>;

// Enrichment for list views (enrollment.html) — the raw EnrollmentRecord only has foreign-key ids.
export type EnrollmentListItem = EnrollmentRecord & {
  studentName: string;
  studentGradeLevel: string;
  branchId: string;
  batchLabel: string;
};

export function createEnrollmentService(deps: EnrollmentServiceDeps) {
  const { enrollmentRepo, batchRepo, studentProfileRepo, parentStudentRepo, userRepo, courseRepo, gradeLevelRepo } =
    deps;

  async function enrich(enrollments: EnrollmentRecord[]): Promise<EnrollmentListItem[]> {
    const gradeLevels = await gradeLevelRepo.findAll();
    const gradeLevelsById = new Map(gradeLevels.map((g) => [g.id, g]));

    const batchIds = [...new Set(enrollments.map((e) => e.batchId))];
    const batches = await Promise.all(batchIds.map((id) => batchRepo.findById(id)));
    const batchesById = new Map(batchIds.map((id, i) => [id, batches[i]]));

    const courseIds = [...new Set(batches.flatMap((b) => (b ? [b.courseId] : [])))];
    const courses = await Promise.all(courseIds.map((id) => courseRepo.findById(id)));
    const coursesById = new Map(courseIds.map((id, i) => [id, courses[i]]));

    const studentProfileIds = [...new Set(enrollments.map((e) => e.studentProfileId))];
    const profiles = await Promise.all(studentProfileIds.map((id) => studentProfileRepo.findById(id)));
    const profilesById = new Map(studentProfileIds.map((id, i) => [id, profiles[i]]));

    const userIds = [...new Set(profiles.flatMap((p) => (p ? [p.userId] : [])))];
    const users = await Promise.all(userIds.map((id) => userRepo.findById(id)));
    const usersById = new Map(userIds.map((id, i) => [id, users[i]]));

    return enrollments.map((enrollment) => {
      const batch = batchesById.get(enrollment.batchId);
      const course = batch ? coursesById.get(batch.courseId) : undefined;
      const gradeLevel = course ? gradeLevelsById.get(course.gradeLevelId) : undefined;
      const profile = profilesById.get(enrollment.studentProfileId);
      const user = profile ? usersById.get(profile.userId) : undefined;
      return {
        ...enrollment,
        studentName: user ? `${user.firstName} ${user.lastName}` : 'Unknown student',
        studentGradeLevel: gradeLevel?.name ?? '\u2014',
        branchId: batch?.branchId ?? '',
        batchLabel: course?.name ?? '\u2014',
      };
    });
  }

  async function requireBatchInScope(ctx: AuthContext, batchId: string) {
    const batch = await batchRepo.findById(batchId);
    if (!batch || !isInBranchScope(ctx, batch.branchId)) {
      throw new AppError('NOT_FOUND', 404, 'Batch not found');
    }
    return batch;
  }

  return {
    async list(ctx: AuthContext, query: EnrollmentListQuery): Promise<EnrollmentListItem[]> {
      if (ctx.role === 'STUDENT') {
        const profile = await studentProfileRepo.findByUserId(ctx.userId);
        if (!profile) return [];
        return enrich(await enrollmentRepo.findAll({ ...query, studentProfileIds: [profile.id] }));
      }
      if (ctx.role === 'PARENT') {
        const studentProfileIds = await parentStudentRepo.listStudentProfileIdsForParent(
          ctx.userId,
        );
        if (studentProfileIds.length === 0) return [];
        return enrich(await enrollmentRepo.findAll({ ...query, studentProfileIds }));
      }

      const filter: EnrollmentListFilter = { ...query };
      if (!isSuperAdmin(ctx)) {
        filter.branchIds = ctx.branchIds;
      }
      return enrich(await enrollmentRepo.findAll(filter));
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
