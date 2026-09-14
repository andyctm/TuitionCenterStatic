import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { BranchRecord, UserRecord } from '../repositories/types';

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

function seedBranch(overrides: Partial<BranchRecord> = {}): BranchRecord {
  return {
    id: 'branch_colombo',
    name: 'Colombo',
    timezone: 'Asia/Colombo',
    isActive: true,
    ...overrides,
  };
}

describe('GET /api/branches', () => {
  it('scopes results to the caller assigned branch', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', branchId: 'branch_colombo' });
    const colombo = seedBranch();
    const kandy = seedBranch({ id: 'branch_kandy', name: 'Kandy' });
    const { app } = createTestApp({ seedUsers: [admin], seedBranches: [colombo, kandy] });
    const token = await loginAs(app, admin);

    const res = await request(app).get('/api/branches').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((b: BranchRecord) => b.id)).toEqual(['branch_colombo']);
  });
});

describe('GET /api/branches/:id', () => {
  it('returns 404 for a branch outside the caller scope', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', branchId: 'branch_colombo' });
    const kandy = seedBranch({ id: 'branch_kandy', name: 'Kandy' });
    const { app } = createTestApp({ seedUsers: [admin], seedBranches: [kandy] });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .get('/api/branches/branch_kandy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/branches', () => {
  it('returns 403 for a Center Admin', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN' });
    const { app } = createTestApp({ seedUsers: [admin] });
    const token = await loginAs(app, admin);

    const res = await request(app)
      .post('/api/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Galle' });

    expect(res.status).toBe(403);
  });

  it('returns 201 for a Super Admin', async () => {
    const superAdmin = await seedUser({
      id: 'super_1',
      email: 'super@example.com',
      role: 'SUPER_ADMIN',
      branchId: null,
    });
    const { app } = createTestApp({ seedUsers: [superAdmin] });
    const token = await loginAs(app, superAdmin);

    const res = await request(app)
      .post('/api/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Galle' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Galle');
  });
});
