import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { CourseRecord, GradeLevelRecord, SubjectRecord, UserRecord } from '../repositories/types';

async function seedUser(overrides: Partial<UserRecord>): Promise<UserRecord> {
  return {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    firstName: 'A',
    lastName: 'B',
    role: 'TEACHER',
    status: 'ACTIVE',
    branchId: 'branch_1',
    ...overrides,
  };
}

async function loginAs(app: import('express').Express, user: UserRecord) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'correct horse battery staple' });
  return res.body.data.accessToken as string;
}

describe('POST /api/subjects', () => {
  it('returns 403 for a Teacher', async () => {
    const teacher = await seedUser({ role: 'TEACHER' });
    const { app } = createTestApp({ seedUsers: [teacher] });
    const token = await loginAs(app, teacher);

    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Science', code: 'SCI' });

    expect(res.status).toBe(403);
  });

  it('returns 201 for a Center Admin', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const { app } = createTestApp({ seedUsers: [admin] });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Science', code: 'SCI' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/subjects', () => {
  it('is readable by any authenticated role', async () => {
    const student = await seedUser({ role: 'STUDENT' });
    const subject: SubjectRecord = { id: 's1', name: 'Math', code: 'MATH' };
    const { app } = createTestApp({ seedUsers: [student], seedSubjects: [subject] });
    const token = await loginAs(app, student);

    const res = await request(app).get('/api/subjects').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/grade-levels', () => {
  it('returns 201 for a Super Admin', async () => {
    const admin = await seedUser({ role: 'SUPER_ADMIN' });
    const { app } = createTestApp({ seedUsers: [admin] });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/grade-levels')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Primary 3', sortOrder: 3 });

    expect(res.status).toBe(201);
  });
});

describe('/api/courses', () => {
  it('creates, updates and deletes a course for an Admin caller', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const subject: SubjectRecord = { id: 'subj_1', name: 'Math', code: 'MATH' };
    const gradeLevel: GradeLevelRecord = { id: 'grade_1', name: 'Primary 3', sortOrder: 3 };
    const { app } = createTestApp({
      seedUsers: [admin],
      seedSubjects: [subject],
      seedGradeLevels: [gradeLevel],
    });
    const token = await loginAs(app, admin);

    const createRes = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectId: 'subj_1', gradeLevelId: 'grade_1', name: 'Primary 3 Math' });
    expect(createRes.status).toBe(201);
    const courseId = createRes.body.data.id as string;

    const patchRes = await request(app)
      .patch(`/api/courses/${courseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Primary 3 Mathematics' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Primary 3 Mathematics');

    const deleteRes = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });

  it('returns 400 VALIDATION_ERROR for an unknown subjectId', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const gradeLevel: GradeLevelRecord = { id: 'grade_1', name: 'Primary 3', sortOrder: 3 };
    const { app } = createTestApp({ seedUsers: [admin], seedGradeLevels: [gradeLevel] });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectId: 'missing', gradeLevelId: 'grade_1', name: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is readable by any authenticated role', async () => {
    const student = await seedUser({ role: 'STUDENT' });
    const course: CourseRecord = {
      id: 'course_1',
      subjectId: 'subj_1',
      gradeLevelId: 'grade_1',
      name: 'Primary 3 Math',
    };
    const { app } = createTestApp({ seedUsers: [student], seedCourses: [course] });
    const token = await loginAs(app, student);

    const res = await request(app).get('/api/courses').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
