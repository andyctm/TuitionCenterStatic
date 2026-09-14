import { describe, expect, it } from 'vitest';
import { createAttendanceReportService } from './attendanceReportService';
import {
  createFakeAttendanceRepository,
  createFakeBatchRepository,
  createFakeBranchRepository,
  createFakeClassSessionRepository,
  createFakeCourseRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRecord,
  BatchRecord,
  BranchRecord,
  ClassSessionRecord,
  CourseRecord,
} from '../repositories/types';

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

function seedSession(overrides: Partial<ClassSessionRecord> = {}): ClassSessionRecord {
  return { id: 'session_1', batchId: 'batch_1', sessionDate: new Date('2026-09-10T00:00:00Z'), status: 'COMPLETED', ...overrides };
}

function seedAttendance(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'att_1',
    classSessionId: 'session_1',
    studentProfileId: 'stu_1',
    status: 'PRESENT',
    remarks: null,
    markedAt: new Date('2026-09-10T09:00:00Z'),
    ...overrides,
  };
}

function makeDeps(options: {
  branches?: BranchRecord[];
  courses?: CourseRecord[];
  batches?: BatchRecord[];
  sessions?: ClassSessionRecord[];
  attendances?: AttendanceRecord[];
} = {}) {
  const branchRepo = createFakeBranchRepository(options.branches ?? [seedBranch()]);
  const courseRepo = createFakeCourseRepository(options.courses ?? [seedCourse()]);
  const batchRepo = createFakeBatchRepository(options.batches ?? [seedBatch()]);
  const classSessionRepo = createFakeClassSessionRepository(options.sessions ?? [seedSession()]);
  const attendanceRepo = createFakeAttendanceRepository(options.attendances ?? [seedAttendance()], classSessionRepo);
  return { branchRepo, courseRepo, batchRepo, classSessionRepo, attendanceRepo };
}

describe('attendanceReportService.listRows', () => {
  it('flattens every attendance record with its session/batch/course/branch context', async () => {
    const deps = makeDeps();
    const service = createAttendanceReportService(deps);

    const rows = await service.listRows(ctx());

    expect(rows).toEqual([
      {
        attendanceId: 'att_1',
        sessionId: 'session_1',
        sessionDate: new Date('2026-09-10T00:00:00Z'),
        batchId: 'batch_1',
        courseName: 'Grade 6 Maths',
        branchName: 'Colombo',
        studentProfileId: 'stu_1',
        status: 'PRESENT',
        remarks: null,
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
      sessions: [
        seedSession({ id: 'session_colombo', batchId: 'batch_colombo' }),
        seedSession({ id: 'session_kandy', batchId: 'batch_kandy' }),
      ],
      attendances: [
        seedAttendance({ id: 'att_colombo', classSessionId: 'session_colombo' }),
        seedAttendance({ id: 'att_kandy', classSessionId: 'session_kandy' }),
      ],
    });
    const service = createAttendanceReportService(deps);

    const rows = await service.listRows(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }));

    expect(rows).toEqual([expect.objectContaining({ attendanceId: 'att_colombo' })]);
  });

  it('filters to a single batch when batchId is provided and in scope', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ id: 'batch_1' }), seedBatch({ id: 'batch_2' })],
      sessions: [
        seedSession({ id: 's1', batchId: 'batch_1' }),
        seedSession({ id: 's2', batchId: 'batch_2' }),
      ],
      attendances: [
        seedAttendance({ id: 'a1', classSessionId: 's1' }),
        seedAttendance({ id: 'a2', classSessionId: 's2' }),
      ],
    });
    const service = createAttendanceReportService(deps);

    const rows = await service.listRows(ctx(), { batchId: 'batch_2' });

    expect(rows).toEqual([expect.objectContaining({ attendanceId: 'a2', batchId: 'batch_2' })]);
  });

  it('rejects a batchId outside the caller branch scope with 404', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy' })],
    });
    const service = createAttendanceReportService(deps);

    await expect(
      service.listRows(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }), {
        batchId: 'batch_kandy',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });
});
