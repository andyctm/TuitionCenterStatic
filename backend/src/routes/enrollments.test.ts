import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type {
  BatchRecord,
  BranchRecord,
  CourseRecord,
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

const studentProfiles: StudentProfileRecord[] = [{ id: 'stu_1', userId: 'student_user_1' }];

describe('POST /api/enrollments', () => {
  it('returns 403 for a Teacher', async () => {
    const teacher = await seedUser({ role: 'TEACHER' });
    const { app } = createTestApp({
      seedUsers: [teacher],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [seedBatch()],
      seedStudentProfiles: studentProfiles,
    });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId: 'batch_1', studentProfileId: 'stu_1' });

    expect(res.status).toBe(403);
  });

  it('returns 201 for an Accountant enrolling into their own branch', async () => {
    const accountant = await seedUser({ role: 'ACCOUNTANT' });
    const { app } = createTestApp({
      seedUsers: [accountant],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [seedBatch()],
      seedStudentProfiles: studentProfiles,
    });
    const token = await loginAs(app, accountant);

    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId: 'batch_1', studentProfileId: 'stu_1' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('returns 409 CONFLICT when the batch is at capacity', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const full = seedBatch({ capacity: 1 });
    const { app } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [full],
      seedStudentProfiles: [...studentProfiles, { id: 'stu_2', userId: 'student_user_2' }],
    });
    const token = await loginAs(app, admin);

    const first = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId: 'batch_1', studentProfileId: 'stu_1' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId: 'batch_1', studentProfileId: 'stu_2' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/enrollments', () => {
  it('restricts a Student to their own enrollments', async () => {
    const studentUser = await seedUser({
      id: 'student_user_1',
      email: 'student@example.com',
      role: 'STUDENT',
      branchId: null,
    });
    const { app, enrollmentRepo } = createTestApp({
      seedUsers: [studentUser],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [seedBatch()],
      seedStudentProfiles: studentProfiles,
    });
    await enrollmentRepo.createIfCapacityAvailable({
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      capacity: 20,
    });
    const token = await loginAs(app, studentUser);

    const res = await request(app)
      .get('/api/enrollments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 403 for a Teacher', async () => {
    const teacher = await seedUser({ role: 'TEACHER' });
    const { app } = createTestApp({ seedUsers: [teacher] });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .get('/api/enrollments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/enrollments/:id', () => {
  it('updates status for an Admin caller', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const { app, enrollmentRepo } = createTestApp({
      seedUsers: [admin],
      seedBranches: branches,
      seedCourses: courses,
      seedBatches: [seedBatch()],
      seedStudentProfiles: studentProfiles,
    });
    const created = await enrollmentRepo.createIfCapacityAvailable({
      batchId: 'batch_1',
      studentProfileId: 'stu_1',
      capacity: 20,
    });
    const enrollmentId = created.outcome === 'CREATED' ? created.enrollment.id : '';
    const token = await loginAs(app, admin);

    const res = await request(app)
      .patch(`/api/enrollments/${enrollmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'WITHDRAWN' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WITHDRAWN');
  });
});
