import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { UserRecord } from '../repositories/types';

describe('self-registration -> admin approval -> login', () => {
  it('blocks login while PENDING, then succeeds once a Center Admin approves the account', async () => {
    const admin: UserRecord = {
      id: 'admin_1',
      email: 'admin@example.com',
      passwordHash: await hashPassword('admin-password-1'),
      firstName: 'Ada',
      lastName: 'Admin',
      role: 'CENTER_ADMIN',
      status: 'ACTIVE',
      branchId: 'branch_1',
    };
    const { app } = createTestApp({ seedUsers: [admin] });

    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'parent@example.com',
      password: 'parent-password-1',
      firstName: 'Pat',
      lastName: 'Parent',
      role: 'PARENT',
    });
    expect(registerRes.status).toBe(201);
    const newUserId = registerRes.body.data.id as string;

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'parent@example.com', password: 'parent-password-1' });
    expect(blockedLogin.status).toBe(403);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'admin-password-1' });
    const adminToken = adminLogin.body.data.accessToken as string;

    const approveRes = await request(app)
      .patch(`/api/users/${newUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });
    expect(approveRes.status).toBe(200);

    const successfulLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'parent@example.com', password: 'parent-password-1' });
    expect(successfulLogin.status).toBe(200);
    expect(successfulLogin.body.data.accessToken).toEqual(expect.any(String));
  });
});
