import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { UserRecord } from '../repositories/types';

async function seedUser(overrides: Partial<UserRecord>): Promise<UserRecord> {
  return {
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    firstName: 'A',
    lastName: 'B',
    role: 'CENTER_ADMIN',
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

describe('GET /api/students', () => {
  it('returns 403 for a Teacher (not an enrollment write role)', async () => {
    const teacher = await seedUser({ role: 'TEACHER' });
    const { app } = createTestApp({ seedUsers: [teacher] });
    const token = await loginAs(app, teacher);

    const res = await request(app).get('/api/students').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('lets an Accountant list students scoped to their own branch', async () => {
    const accountant = await seedUser({ id: 'acct_1', role: 'ACCOUNTANT', branchId: 'branch_1' });
    const colomboStudent = await seedUser({
      id: 'student_1',
      email: 'student1@example.com',
      role: 'STUDENT',
      branchId: 'branch_1',
    });
    const kandyStudent = await seedUser({
      id: 'student_2',
      email: 'student2@example.com',
      role: 'STUDENT',
      branchId: 'branch_2',
    });
    const { app } = createTestApp({
      seedUsers: [accountant, colomboStudent, kandyStudent],
      seedStudentProfiles: [
        { id: 'stu_profile_1', userId: 'student_1' },
        { id: 'stu_profile_2', userId: 'student_2' },
      ],
    });
    const token = await loginAs(app, accountant);

    const res = await request(app).get('/api/students').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ studentProfileId: 'stu_profile_1', branchId: 'branch_1' }),
    ]);
  });
});
