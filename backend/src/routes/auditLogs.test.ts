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

describe('GET /api/audit-logs', () => {
  it('rejects an unauthenticated request', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin role with 403', async () => {
    const teacher = await seedUser({ role: 'TEACHER', id: 'teacher_1' });
    const { app } = createTestApp({ seedUsers: [teacher] });
    const token = await loginAs(app, teacher);

    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('records exactly one AuditLog row for a user status change, visible to the admin who made it', async () => {
    const admin = await seedUser({ role: 'CENTER_ADMIN', id: 'admin_1', branchId: 'branch_colombo' });
    const pending = await seedUser({
      role: 'STUDENT',
      id: 'pending_1',
      status: 'PENDING',
      branchId: 'branch_colombo',
    });
    const { app } = createTestApp({ seedUsers: [admin, pending] });
    const token = await loginAs(app, admin);

    await request(app)
      .patch(`/api/users/${pending.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });

    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        actorUserId: 'admin_1',
        entityType: 'User',
        entityId: 'pending_1',
        action: 'STATUS_CHANGE',
      }),
    ]);
  });

  it("does not show a Center Admin from another branch the first admin's user status change", async () => {
    const colomboAdmin = await seedUser({
      role: 'CENTER_ADMIN',
      id: 'admin_colombo',
      branchId: 'branch_colombo',
    });
    const kandyAdmin = await seedUser({
      role: 'CENTER_ADMIN',
      id: 'admin_kandy',
      email: 'kandy-admin@example.com',
      branchId: 'branch_kandy',
    });
    const pending = await seedUser({
      role: 'STUDENT',
      id: 'pending_1',
      status: 'PENDING',
      branchId: 'branch_colombo',
    });
    const { app } = createTestApp({ seedUsers: [colomboAdmin, kandyAdmin, pending] });
    const colomboToken = await loginAs(app, colomboAdmin);
    const kandyToken = await loginAs(app, kandyAdmin);

    await request(app)
      .patch(`/api/users/${pending.id}/status`)
      .set('Authorization', `Bearer ${colomboToken}`)
      .send({ status: 'ACTIVE' });

    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${kandyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('filters by entityId, excluding logs for other entities', async () => {
    const admin = await seedUser({ role: 'SUPER_ADMIN', id: 'admin_1', branchId: null });
    const first = await seedUser({ id: 'target_1', role: 'STUDENT', status: 'PENDING' });
    const second = await seedUser({
      id: 'target_2',
      role: 'STUDENT',
      status: 'PENDING',
      email: 'target2@example.com',
    });
    const { app } = createTestApp({ seedUsers: [admin, first, second] });
    const token = await loginAs(app, admin);

    await request(app)
      .patch(`/api/users/${first.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });
    await request(app)
      .patch(`/api/users/${second.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });

    const res = await request(app)
      .get('/api/audit-logs')
      .query({ entityId: 'target_2' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ entityId: 'target_2' })]);
  });
});
