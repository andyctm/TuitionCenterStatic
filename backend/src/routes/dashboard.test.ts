import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type {
  BatchRecord,
  ClassSessionRecord,
  CourseRecord,
  EnrollmentRecord,
  StudentProfileRecord,
  UserRecord,
} from '../repositories/types';

async function seedUser(overrides: Partial<UserRecord>): Promise<UserRecord> {
  return {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    firstName: 'A',
    lastName: 'B',
    role: 'CENTER_ADMIN',
    status: 'ACTIVE',
    branchId: 'branch_colombo',
    ...overrides,
  };
}

async function loginAs(app: import('express').Express, user: UserRecord) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'correct horse battery staple' });
  return res.body.data.accessToken as string;
}

function seedCourse(overrides: Partial<CourseRecord> = {}): CourseRecord {
  return {
    id: 'course_1',
    subjectId: 'subject_1',
    gradeLevelId: 'grade_1',
    name: 'Grade 6 Maths',
    ...overrides,
  };
}

function seedBatch(overrides: Partial<BatchRecord> = {}): BatchRecord {
  return {
    id: 'batch_1',
    courseId: 'course_1',
    branchId: 'branch_colombo',
    teacherUserId: 'teacher_1',
    room: 'Room A',
    capacity: 1,
    term: '2026-T3',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('GET /api/dashboard/summary', () => {
  it('rejects an unauthenticated request', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('returns branch-scoped admin KPIs for a Center Admin', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', id: 'admin_1' });
    const enrollment: EnrollmentRecord = {
      id: 'enr_1',
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      status: 'ACTIVE',
      enrolledAt: new Date('2026-01-01T00:00:00Z'),
    };
    const { app } = createTestApp({
      seedUsers: [admin],
      seedCourses: [seedCourse()],
      seedBatches: [seedBatch()],
      seedEnrollments: [enrollment],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      role: 'ADMIN',
      activeStudentsCount: 1,
      activeBatchesCount: 1,
      batchesAtCapacityCount: 1,
      unassignedTeachers: [],
    });
  });

  it("returns today's sessions for a Teacher", async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const session: ClassSessionRecord = {
      id: 'session_1',
      batchId: 'batch_1',
      sessionDate: new Date(),
      status: 'SCHEDULED',
    };
    const { app } = createTestApp({
      seedUsers: [teacher],
      seedCourses: [seedCourse()],
      seedBatches: [seedBatch({ teacherUserId: 'teacher_1' })],
      seedClassSessions: [session],
    });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('TEACHER');
    expect(res.body.data.todaysSessions).toHaveLength(1);
  });

  it('returns an empty child list for a Parent with no linked students', async () => {
    const parent = await seedUser({ role: 'PARENT', id: 'parent_1', branchId: null });
    const { app } = createTestApp({ seedUsers: [parent] });
    const token = await loginAs(app, parent);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ role: 'PARENT', children: [] });
  });

  it('returns nextClass null and zero percentage for a Student with no history', async () => {
    const student = await seedUser({ role: 'STUDENT', id: 'student_1', branchId: null });
    const profile: StudentProfileRecord = { id: 'stu_1', userId: 'student_1' };
    const { app } = createTestApp({ seedUsers: [student], seedStudentProfiles: [profile] });
    const token = await loginAs(app, student);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      role: 'STUDENT',
      nextClass: null,
      recentAttendance: [],
      attendancePercentage: 0,
    });
  });
});
