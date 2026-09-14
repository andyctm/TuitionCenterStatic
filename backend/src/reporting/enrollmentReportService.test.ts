import { describe, expect, it } from 'vitest';
import { createEnrollmentReportService } from './enrollmentReportService';
import {
  createFakeBatchRepository,
  createFakeBranchRepository,
  createFakeCourseRepository,
  createFakeEnrollmentRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type { BatchRecord, BranchRecord, CourseRecord, EnrollmentRecord } from '../repositories/types';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'admin_1', role: 'SUPER_ADMIN', branchIds: [], ...overrides };
}

function seedBranch(overrides: Partial<BranchRecord> = {}): BranchRecord {
  return { id: 'branch_colombo', name: 'Colombo', timezone: 'Asia/Colombo', isActive: true, ...overrides };
}

function seedCourse(overrides: Partial<CourseRecord> = {}): CourseRecord {
  return { id: 'course_1', subjectId: 'subject_1', gradeLevelId: 'grade_1', name: 'Grade 6 Maths', ...overrides };
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

function seedEnrollment(overrides: Partial<EnrollmentRecord> = {}): EnrollmentRecord {
  return {
    id: 'enr_1',
    batchId: 'batch_1',
    studentProfileId: 'stu_1',
    status: 'ACTIVE',
    enrolledAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeDeps(options: {
  branches?: BranchRecord[];
  courses?: CourseRecord[];
  batches?: BatchRecord[];
  enrollments?: EnrollmentRecord[];
} = {}) {
  const branchRepo = createFakeBranchRepository(options.branches ?? [seedBranch()]);
  const courseRepo = createFakeCourseRepository(options.courses ?? [seedCourse()]);
  const batchRepo = createFakeBatchRepository(options.batches ?? [seedBatch()]);
  const enrollmentRepo = createFakeEnrollmentRepository(options.enrollments ?? [seedEnrollment()], batchRepo);
  return { branchRepo, courseRepo, batchRepo, enrollmentRepo };
}

describe('enrollmentReportService.listRows', () => {
  it('enriches each enrollment with course name and branch name', async () => {
    const deps = makeDeps();
    const service = createEnrollmentReportService(deps);

    const rows = await service.listRows(ctx());

    expect(rows).toEqual([
      {
        enrollmentId: 'enr_1',
        studentProfileId: 'stu_1',
        batchId: 'batch_1',
        courseName: 'Grade 6 Maths',
        branchName: 'Colombo',
        status: 'ACTIVE',
        enrolledAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
  });

  it('scopes rows to the caller branch for a non-Super-Admin', async () => {
    const deps = makeDeps({
      branches: [seedBranch({ id: 'branch_colombo' }), seedBranch({ id: 'branch_kandy', name: 'Kandy' })],
      batches: [
        seedBatch({ id: 'batch_colombo', branchId: 'branch_colombo' }),
        seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy' }),
      ],
      enrollments: [
        seedEnrollment({ id: 'e1', batchId: 'batch_colombo' }),
        seedEnrollment({ id: 'e2', batchId: 'batch_kandy' }),
      ],
    });
    const service = createEnrollmentReportService(deps);

    const rows = await service.listRows(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ batchId: 'batch_colombo' });
  });

  it('filters by status when requested', async () => {
    const deps = makeDeps({
      enrollments: [
        seedEnrollment({ id: 'e1', status: 'ACTIVE' }),
        seedEnrollment({ id: 'e2', status: 'WITHDRAWN' }),
      ],
    });
    const service = createEnrollmentReportService(deps);

    const rows = await service.listRows(ctx(), { status: 'WITHDRAWN' });

    expect(rows).toEqual([expect.objectContaining({ enrollmentId: 'e2', status: 'WITHDRAWN' })]);
  });
});
