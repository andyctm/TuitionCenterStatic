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

describe('POST /api/users', () => {
  it('returns 403 for a non-admin caller', async () => {
    const teacher = await seedUser({ role: 'TEACHER' });
    const { app } = createTestApp({ seedUsers: [teacher] });
    const token = await loginAs(app, teacher);

    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      email: 'new-teacher@example.com',
      password: 'a-strong-password',
      firstName: 'New',
      lastName: 'Teacher',
      role: 'TEACHER',
      branchId: 'branch_1',
    });

    expect(res.status).toBe(403);
  });

  it('returns 201 and an ACTIVE user for a Center Admin caller', async () => {
    const admin = await seedUser({
      id: 'admin_1',
      email: 'admin@example.com',
      role: 'CENTER_ADMIN',
    });
    const { app } = createTestApp({ seedUsers: [admin] });
    const token = await loginAs(app, admin);

    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      email: 'new-teacher@example.com',
      password: 'a-strong-password',
      firstName: 'New',
      lastName: 'Teacher',
      role: 'TEACHER',
      branchId: 'branch_1',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});

describe('PATCH /api/users/:id/status', () => {
  it('lets a Center Admin approve a PENDING self-registration', async () => {
    const admin = await seedUser({
      id: 'admin_1',
      email: 'admin@example.com',
      role: 'CENTER_ADMIN',
    });
    const pending = await seedUser({
      id: 'pending_1',
      email: 'pending@example.com',
      role: 'STUDENT',
      status: 'PENDING',
    });
    const { app } = createTestApp({ seedUsers: [admin, pending] });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .patch(`/api/users/${pending.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});
