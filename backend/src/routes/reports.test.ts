import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type {
  AttendanceRecord,
  BatchRecord,
  ClassSessionRecord,
  CourseRecord,
  EnrollmentRecord,
  UserRecord,
} from '../repositories/types';

async function seedUser(overrides: Partial<UserRecord>): Promise<UserRecord> {
  return {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    firstName: 'A',
    lastName: 'B',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    branchId: null,
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
    capacity: 20,
    term: '2026-T3',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('GET /api/reports/enrollment', () => {
  it('rejects a non-admin role with 403', async () => {
    const accountant = await seedUser({ role: 'ACCOUNTANT', id: 'acc_1', branchId: 'branch_colombo' });
    const { app } = createTestApp({ seedUsers: [accountant] });
    const token = await loginAs(app, accountant);

    const res = await request(app)
      .get('/api/reports/enrollment')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('streams a CSV with a header row and one row per enrollment', async () => {
    const admin = await seedUser({ role: 'SUPER_ADMIN' });
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
      .get('/api/reports/enrollment')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('enrollmentId,studentProfileId,batchId,courseName,branchName,status,enrolledAt');
    expect(lines[1]).toContain('enr_1');
    expect(lines[1]).toContain('Grade 6 Maths');
  });
});

describe('GET /api/reports/attendance', () => {
  it('streams a CSV with a header row and one row per attendance record', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', branchId: 'branch_colombo' });
    const session: ClassSessionRecord = {
      id: 'session_1',
      batchId: 'batch_1',
      sessionDate: new Date('2026-09-10T00:00:00Z'),
      status: 'COMPLETED',
    };
    const attendance: AttendanceRecord = {
      id: 'att_1',
      classSessionId: 'session_1',
      studentProfileId: 'stu_1',
      status: 'PRESENT',
      remarks: null,
      markedAt: new Date('2026-09-10T09:00:00Z'),
    };
    const { app } = createTestApp({
      seedUsers: [admin],
      seedCourses: [seedCourse()],
      seedBatches: [seedBatch()],
      seedClassSessions: [session],
      seedAttendances: [attendance],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .get('/api/reports/attendance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe(
      'attendanceId,sessionId,sessionDate,batchId,courseName,branchName,studentProfileId,status,remarks',
    );
    expect(lines[1]).toContain('att_1');
    expect(lines[1]).toContain('PRESENT');
  });

  it('rejects a batchId outside the caller branch scope with 404', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', branchId: 'branch_colombo' });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedCourses: [seedCourse()],
      seedBatches: [seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy' })],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .get('/api/reports/attendance?batchId=batch_kandy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
