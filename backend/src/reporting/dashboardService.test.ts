import { describe, expect, it } from 'vitest';
import { createDashboardService } from './dashboardService';
import {
  createFakeAttendanceRepository,
  createFakeBatchRepository,
  createFakeClassSessionRepository,
  createFakeCourseRepository,
  createFakeEnrollmentRepository,
  createFakeParentStudentRepository,
  createFakeStudentProfileRepository,
  createFakeUserRepository,
} from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRecord,
  BatchRecord,
  ClassSessionRecord,
  CourseRecord,
  EnrollmentRecord,
  StudentProfileRecord,
  UserRecord,
} from '../repositories/types';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'user_1', role: 'SUPER_ADMIN', branchIds: [], ...overrides };
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
    capacity: 2,
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

function seedSession(overrides: Partial<ClassSessionRecord> = {}): ClassSessionRecord {
  return {
    id: 'session_1',
    batchId: 'batch_1',
    sessionDate: new Date('2026-09-14T00:00:00Z'),
    status: 'SCHEDULED',
    ...overrides,
  };
}

function seedProfile(overrides: Partial<StudentProfileRecord> = {}): StudentProfileRecord {
  return { id: 'stu_1', userId: 'student_user_1', ...overrides };
}

function seedUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'teacher_1',
    email: 'teacher_1@example.com',
    passwordHash: 'hash',
    firstName: 'Teacher',
    lastName: 'One',
    role: 'TEACHER',
    status: 'ACTIVE',
    branchId: 'branch_colombo',
    ...overrides,
  };
}

function makeDeps(options: {
  courses?: CourseRecord[];
  batches?: BatchRecord[];
  enrollments?: EnrollmentRecord[];
  sessions?: ClassSessionRecord[];
  attendances?: AttendanceRecord[];
  profiles?: StudentProfileRecord[];
  parentLinks?: { parentUserId: string; studentProfileId: string }[];
  users?: UserRecord[];
} = {}) {
  const courseRepo = createFakeCourseRepository(options.courses ?? [seedCourse()]);
  const batchRepo = createFakeBatchRepository(options.batches ?? [seedBatch()]);
  const enrollmentRepo = createFakeEnrollmentRepository(options.enrollments ?? [], batchRepo);
  const classSessionRepo = createFakeClassSessionRepository(options.sessions ?? []);
  const attendanceRepo = createFakeAttendanceRepository(options.attendances ?? [], classSessionRepo);
  const studentProfileRepo = createFakeStudentProfileRepository(options.profiles ?? [seedProfile()]);
  const parentStudentRepo = createFakeParentStudentRepository(options.parentLinks ?? []);
  const userRepo = createFakeUserRepository(options.users ?? []);
  return {
    courseRepo,
    batchRepo,
    enrollmentRepo,
    classSessionRepo,
    attendanceRepo,
    studentProfileRepo,
    parentStudentRepo,
    userRepo,
  };
}

const NOW = new Date('2026-09-14T10:00:00Z');

describe('dashboardService.getSummary — admin roles (SUPER_ADMIN/CENTER_ADMIN/ACCOUNTANT)', () => {
  it('counts active students and at-capacity batches scoped to the caller branch', async () => {
    const deps = makeDeps({
      batches: [
        seedBatch({ id: 'batch_colombo', branchId: 'branch_colombo', capacity: 1 }),
        seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy', capacity: 1 }),
      ],
      enrollments: [
        seedEnrollment({ id: 'e1', batchId: 'batch_colombo', studentProfileId: 'stu_1' }),
        seedEnrollment({ id: 'e2', batchId: 'batch_kandy', studentProfileId: 'stu_2' }),
      ],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      NOW,
    );

    expect(summary).toEqual({
      role: 'ADMIN',
      activeStudentsCount: 1,
      activeBatchesCount: 1,
      batchesAtCapacityCount: 1,
      unassignedTeachers: [],
    });
  });

  it('Super Admin sees counts across every branch', async () => {
    const deps = makeDeps({
      batches: [
        seedBatch({ id: 'batch_colombo', branchId: 'branch_colombo', capacity: 5 }),
        seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy', capacity: 1 }),
      ],
      enrollments: [
        seedEnrollment({ id: 'e1', batchId: 'batch_colombo', studentProfileId: 'stu_1' }),
        seedEnrollment({ id: 'e2', batchId: 'batch_kandy', studentProfileId: 'stu_2' }),
      ],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'SUPER_ADMIN' }), NOW);

    expect(summary).toEqual({
      role: 'ADMIN',
      activeStudentsCount: 2,
      activeBatchesCount: 2,
      batchesAtCapacityCount: 1,
      unassignedTeachers: [],
    });
  });

  it('treats ACCOUNTANT the same as a branch-scoped admin', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ branchId: 'branch_colombo', capacity: 2 })],
      enrollments: [seedEnrollment()],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(
      ctx({ role: 'ACCOUNTANT', branchIds: ['branch_colombo'] }),
      NOW,
    );

    expect(summary).toMatchObject({ role: 'ADMIN', activeStudentsCount: 1 });
  });

  it('does not count a withdrawn enrollment towards active students or capacity', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ branchId: 'branch_colombo', capacity: 1 })],
      enrollments: [seedEnrollment({ status: 'WITHDRAWN' })],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      NOW,
    );

    expect(summary).toMatchObject({ activeStudentsCount: 0, batchesAtCapacityCount: 0 });
  });

  it('flags an ACTIVE teacher with zero assigned batches (of any status) as unassigned', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ branchId: 'branch_colombo', teacherUserId: 'teacher_assigned' })],
      users: [
        seedUser({ id: 'teacher_assigned', firstName: 'Assigned', lastName: 'Teacher' }),
        seedUser({ id: 'teacher_unassigned', firstName: 'Idle', lastName: 'Teacher' }),
      ],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      NOW,
    );

    expect(summary).toMatchObject({
      unassignedTeachers: [{ userId: 'teacher_unassigned', firstName: 'Idle', lastName: 'Teacher' }],
    });
  });

  it('does not flag a teacher whose only batch is ARCHIVED, and ignores INACTIVE teachers entirely', async () => {
    const deps = makeDeps({
      batches: [
        seedBatch({ teacherUserId: 'teacher_archived_only', status: 'ARCHIVED', branchId: 'branch_colombo' }),
      ],
      users: [
        seedUser({ id: 'teacher_archived_only', firstName: 'Archived', lastName: 'Only' }),
        seedUser({ id: 'teacher_inactive', firstName: 'Inactive', lastName: 'Teacher', status: 'SUSPENDED' }),
      ],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      NOW,
    );

    expect(summary).toMatchObject({ unassignedTeachers: [] });
  });

  it("scopes unassignedTeachers to the caller's branch, but Super Admin sees every branch", async () => {
    const deps = makeDeps({
      batches: [seedBatch({ branchId: 'branch_colombo' })],
      users: [
        seedUser({ id: 'teacher_colombo', branchId: 'branch_colombo' }),
        seedUser({ id: 'teacher_kandy', branchId: 'branch_kandy' }),
      ],
    });
    const service = createDashboardService(deps);

    const scoped = await service.getSummary(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
      NOW,
    );
    expect(scoped).toMatchObject({
      unassignedTeachers: [{ userId: 'teacher_colombo' }],
    });

    const superAdminView = await service.getSummary(ctx({ role: 'SUPER_ADMIN' }), NOW);
    expect(superAdminView).toMatchObject({
      unassignedTeachers: expect.arrayContaining([
        { userId: 'teacher_colombo', firstName: 'Teacher', lastName: 'One' },
        { userId: 'teacher_kandy', firstName: 'Teacher', lastName: 'One' },
      ]),
    });
  });
});

describe('dashboardService.getSummary — TEACHER', () => {
  it("lists today's sessions with an attendanceMarked flag and counts older unmarked sessions as pending", async () => {
    const deps = makeDeps({
      batches: [seedBatch({ id: 'batch_1', teacherUserId: 'teacher_1' })],
      sessions: [
        seedSession({ id: 'today_marked', sessionDate: new Date('2026-09-14T00:00:00Z') }),
        seedSession({ id: 'yesterday_unmarked', sessionDate: new Date('2026-09-13T00:00:00Z') }),
        seedSession({ id: 'tomorrow', sessionDate: new Date('2026-09-15T00:00:00Z') }),
      ],
      attendances: [
        {
          id: 'att_1',
          classSessionId: 'today_marked',
          studentProfileId: 'stu_1',
          status: 'PRESENT',
          remarks: null,
          markedAt: NOW,
        },
      ],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'TEACHER', userId: 'teacher_1' }), NOW);

    expect(summary).toEqual({
      role: 'TEACHER',
      todaysSessions: [
        {
          sessionId: 'today_marked',
          batchId: 'batch_1',
          courseName: 'Grade 6 Maths',
          room: 'Room A',
          sessionDate: new Date('2026-09-14T00:00:00Z'),
          attendanceMarked: true,
        },
      ],
      pendingAttendanceCount: 1,
    });
  });

  it("excludes sessions from batches the caller does not teach", async () => {
    const deps = makeDeps({
      batches: [seedBatch({ id: 'batch_other', teacherUserId: 'teacher_2' })],
      sessions: [seedSession({ batchId: 'batch_other', sessionDate: NOW })],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'TEACHER', userId: 'teacher_1' }), NOW);

    expect(summary).toEqual({ role: 'TEACHER', todaysSessions: [], pendingAttendanceCount: 0 });
  });
});

describe('dashboardService.getSummary — STUDENT', () => {
  it('returns the earliest upcoming session across active enrollments as nextClass', async () => {
    const deps = makeDeps({
      courses: [seedCourse({ id: 'course_1', name: 'Grade 6 Maths' }), seedCourse({ id: 'course_2', name: 'Grade 6 Science' })],
      batches: [
        seedBatch({ id: 'batch_1', courseId: 'course_1', room: 'Room A' }),
        seedBatch({ id: 'batch_2', courseId: 'course_2', room: 'Room B' }),
      ],
      enrollments: [
        seedEnrollment({ id: 'e1', batchId: 'batch_1', studentProfileId: 'stu_1' }),
        seedEnrollment({ id: 'e2', batchId: 'batch_2', studentProfileId: 'stu_1' }),
      ],
      sessions: [
        seedSession({ id: 's1', batchId: 'batch_1', sessionDate: new Date('2026-09-20T00:00:00Z') }),
        seedSession({ id: 's2', batchId: 'batch_2', sessionDate: new Date('2026-09-16T00:00:00Z') }),
      ],
      profiles: [seedProfile({ id: 'stu_1', userId: 'student_user_1' })],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'STUDENT', userId: 'student_user_1' }), NOW);

    expect(summary).toMatchObject({
      role: 'STUDENT',
      nextClass: {
        batchId: 'batch_2',
        courseName: 'Grade 6 Science',
        room: 'Room B',
        sessionDate: new Date('2026-09-16T00:00:00Z'),
      },
    });
  });

  it('returns recent attendance sorted newest-first, capped at 5, with the computed percentage', async () => {
    const sessions = [
      seedSession({ id: 's1', sessionDate: new Date('2026-09-01T00:00:00Z') }),
      seedSession({ id: 's2', sessionDate: new Date('2026-09-08T00:00:00Z') }),
    ];
    const deps = makeDeps({
      sessions,
      attendances: [
        { id: 'a1', classSessionId: 's1', studentProfileId: 'stu_1', status: 'ABSENT', remarks: null, markedAt: NOW },
        { id: 'a2', classSessionId: 's2', studentProfileId: 'stu_1', status: 'PRESENT', remarks: null, markedAt: NOW },
      ],
      profiles: [seedProfile({ id: 'stu_1', userId: 'student_user_1' })],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'STUDENT', userId: 'student_user_1' }), NOW);

    expect(summary).toMatchObject({
      role: 'STUDENT',
      recentAttendance: [
        { sessionDate: new Date('2026-09-08T00:00:00Z'), status: 'PRESENT' },
        { sessionDate: new Date('2026-09-01T00:00:00Z'), status: 'ABSENT' },
      ],
      attendancePercentage: 50,
    });
  });

  it('degrades gracefully when the caller has no StudentProfile yet', async () => {
    const deps = makeDeps({ profiles: [] });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'STUDENT', userId: 'no_profile' }), NOW);

    expect(summary).toEqual({
      role: 'STUDENT',
      nextClass: null,
      recentAttendance: [],
      attendancePercentage: 0,
    });
  });
});

describe('dashboardService.getSummary — PARENT', () => {
  it('returns one summary entry per linked child', async () => {
    const deps = makeDeps({
      batches: [seedBatch({ id: 'batch_1' })],
      enrollments: [
        seedEnrollment({ id: 'e1', batchId: 'batch_1', studentProfileId: 'stu_1' }),
        seedEnrollment({ id: 'e2', batchId: 'batch_1', studentProfileId: 'stu_2' }),
      ],
      sessions: [seedSession({ id: 's1', batchId: 'batch_1', sessionDate: new Date('2026-09-20T00:00:00Z') })],
      profiles: [seedProfile({ id: 'stu_1' }), seedProfile({ id: 'stu_2', userId: 'student_user_2' })],
      parentLinks: [
        { parentUserId: 'parent_1', studentProfileId: 'stu_1' },
        { parentUserId: 'parent_1', studentProfileId: 'stu_2' },
      ],
    });
    const service = createDashboardService(deps);

    const summary = await service.getSummary(ctx({ role: 'PARENT', userId: 'parent_1' }), NOW);

    expect(summary).toMatchObject({
      role: 'PARENT',
      children: [
        { studentProfileId: 'stu_1', nextClass: { batchId: 'batch_1' } },
        { studentProfileId: 'stu_2', nextClass: { batchId: 'batch_1' } },
      ],
    });
  });
});
