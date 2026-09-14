import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { BatchRecord, ClassSessionRecord, UserRecord } from '../repositories/types';

async function seedUser(overrides: Partial<UserRecord>): Promise<UserRecord> {
  return {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    firstName: 'A',
    lastName: 'B',
    role: 'TEACHER',
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
  return {
    id: 'session_1',
    batchId: 'batch_1',
    sessionDate: new Date(),
    status: 'SCHEDULED',
    ...overrides,
  };
}

describe('POST /api/batches/:id/sessions', () => {
  it('returns 403 for a Teacher who does not teach the batch', async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const { app } = createTestApp({
      seedUsers: [teacher],
      seedBatches: [seedBatch({ teacherUserId: 'teacher_2' })],
    });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .post('/api/batches/batch_1/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionDate: '2026-09-20' });

    expect(res.status).toBe(403);
  });

  it('creates an ad-hoc session for the assigned Teacher', async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const { app } = createTestApp({ seedUsers: [teacher], seedBatches: [seedBatch()] });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .post('/api/batches/batch_1/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionDate: '2026-09-20' });

    expect(res.status).toBe(201);
    expect(res.body.data.batchId).toBe('batch_1');
  });
});

describe('GET /api/batches/:id/sessions', () => {
  it('returns 404 for a Center Admin outside the batch branch', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', branchId: 'branch_colombo' });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBatches: [seedBatch({ branchId: 'branch_kandy' })],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .get('/api/batches/batch_1/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/sessions/:id/attendance', () => {
  it('bulk upserts attendance for the assigned Teacher within the window', async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const { app } = createTestApp({
      seedUsers: [teacher],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession({ sessionDate: new Date() })],
      seedStudentProfiles: [{ id: 'stu_1', userId: 'student_user_1' }],
    });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .put('/api/sessions/session_1/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ studentProfileId: 'stu_1', status: 'PRESENT' }] });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ studentProfileId: 'stu_1', status: 'PRESENT' });
  });

  it('returns 403 outside the edit window', async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const { app } = createTestApp({
      seedUsers: [teacher],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession({ sessionDate: tenDaysAgo })],
    });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .put('/api/sessions/session_1/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ studentProfileId: 'stu_1', status: 'PRESENT' }] });

    expect(res.status).toBe(403);
  });

  it('returns 403 for a non-Teacher role', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession()],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .put('/api/sessions/session_1/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ studentProfileId: 'stu_1', status: 'PRESENT' }] });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/sessions/:id/attendance/override', () => {
  it('requires a reason', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession()],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/sessions/session_1/attendance/override')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentProfileId: 'stu_1', status: 'PRESENT' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for a Teacher (override is Admin-only)', async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const { app } = createTestApp({
      seedUsers: [teacher],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession()],
    });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .post('/api/sessions/session_1/attendance/override')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentProfileId: 'stu_1', status: 'PRESENT', reason: 'test' });

    expect(res.status).toBe(403);
  });

  it('overrides attendance outside the window for a Center Admin', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession({ sessionDate: tenDaysAgo })],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/sessions/session_1/attendance/override')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentProfileId: 'stu_1', status: 'PRESENT', reason: 'parent dispute, verified' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PRESENT');
  });
});

describe('GET /api/students/:id/attendance', () => {
  it('returns percentage and records for the Student themself', async () => {
    const student = await seedUser({
      id: 'student_user_1',
      email: 'student@example.com',
      role: 'STUDENT',
      branchId: null,
    });
    const { app } = createTestApp({
      seedUsers: [student],
      seedBatches: [seedBatch()],
      seedClassSessions: [seedSession()],
      seedStudentProfiles: [{ id: 'stu_1', userId: 'student_user_1' }],
      seedAttendances: [
        {
          id: 'att_1',
          classSessionId: 'session_1',
          studentProfileId: 'stu_1',
          status: 'PRESENT',
          remarks: null,
          markedAt: new Date(),
        },
      ],
    });
    const token = await loginAs(app, student);

    const res = await request(app)
      .get('/api/students/stu_1/attendance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.percentage).toBe(100);
  });

  it("returns 403 for a Student viewing someone else's attendance", async () => {
    const student = await seedUser({
      id: 'student_user_1',
      email: 'student@example.com',
      role: 'STUDENT',
      branchId: null,
    });
    const { app } = createTestApp({
      seedUsers: [student],
      seedStudentProfiles: [
        { id: 'stu_1', userId: 'student_user_1' },
        { id: 'stu_2', userId: 'student_user_2' },
      ],
    });
    const token = await loginAs(app, student);

    const res = await request(app)
      .get('/api/students/stu_2/attendance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/internal/jobs/materialize-sessions', () => {
  it('returns 401 without the internal job secret header', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/api/internal/jobs/materialize-sessions');

    expect(res.status).toBe(401);
  });

  it('returns 200 with the correct secret header', async () => {
    const { app } = createTestApp({
      seedBatches: [seedBatch()],
    });

    const res = await request(app)
      .post('/api/internal/jobs/materialize-sessions')
      .set('x-internal-job-secret', 'test-internal-job-secret');

    expect(res.status).toBe(200);
    expect(typeof res.body.data.created).toBe('number');
  });
});
