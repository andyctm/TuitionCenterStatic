import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { BatchRecord, BranchRecord, CourseRecord, UserRecord } from '../repositories/types';

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

const branches: BranchRecord[] = [
  { id: 'branch_colombo', name: 'Colombo', timezone: 'Asia/Colombo', isActive: true },
  { id: 'branch_kandy', name: 'Kandy', timezone: 'Asia/Colombo', isActive: true },
];

const courses: CourseRecord[] = [
  { id: 'course_1', subjectId: 'subj_1', gradeLevelId: 'grade_1', name: 'Primary 3 Math' },
];

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

describe('POST /api/batches', () => {
  it('returns 403 for a Teacher', async () => {
    const teacher = await seedUser({ role: 'TEACHER' });
    const { app } = createTestApp({ seedUsers: [teacher], seedBranches: branches, seedCourses: courses });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .post('/api/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: 'course_1', branchId: 'branch_colombo', room: 'Room A', capacity: 20, term: '2026-T3' });

    expect(res.status).toBe(403);
  });

  it('returns 201 for a Center Admin with a valid course/branch', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const { app } = createTestApp({ seedUsers: [admin], seedBranches: branches, seedCourses: courses });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: 'course_1', branchId: 'branch_colombo', room: 'Room A', capacity: 20, term: '2026-T3' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});

describe('GET /api/batches/:id', () => {
  it('returns 404 for a batch outside the caller branch scope', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', branchId: 'branch_colombo' });
    const kandyBatch = seedBatch({ id: 'batch_kandy', branchId: 'branch_kandy' });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [kandyBatch],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .get('/api/batches/batch_kandy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/batches/:id/archive', () => {
  it('archives a batch for an Admin caller', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const batch = seedBatch();
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [batch],
    });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/batches/batch_1/archive')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ARCHIVED');
  });
});

describe('POST /api/batches/:id/schedules', () => {
  it('returns 409 CONFLICT for a teacher double-booking', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const batchA = seedBatch({ id: 'batch_a', teacherUserId: 'teacher_1', room: 'Room A' });
    const batchB = seedBatch({ id: 'batch_b', teacherUserId: 'teacher_1', room: 'Room B' });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [batchA, batchB],
    });
    const token = await loginAs(app, admin);

    const first = await request(app)
      .post('/api/batches/batch_a/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 3, startTime: '17:45', endTime: '19:15' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/batches/batch_b/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 3, startTime: '18:00', endTime: '19:00' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('deletes a schedule for an Admin caller', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const batch = seedBatch();
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [batch],
    });
    const token = await loginAs(app, admin);

    const created = await request(app)
      .post('/api/batches/batch_1/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '16:00', endTime: '17:00' });
    const scheduleId = created.body.data.id as string;

    const res = await request(app)
      .delete(`/api/batches/batch_1/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});

describe('GET /api/batches/:id/schedules', () => {
  it('returns the schedules created for a batch', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const batch = seedBatch();
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [batch],
    });
    const token = await loginAs(app, admin);

    await request(app)
      .post('/api/batches/batch_1/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '16:00', endTime: '17:00' });

    const res = await request(app)
      .get('/api/batches/batch_1/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ dayOfWeek: 1, startTime: '16:00', endTime: '17:00' });
  });
});
