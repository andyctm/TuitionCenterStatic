import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createTestApp } from '../testUtils/testApp';
import type { UserRecord } from '../repositories/types';

async function seedActiveUser(overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
  return {
    id: 'user_1',
    email: 'active@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'STUDENT',
    status: 'ACTIVE',
    branchId: null,
    ...overrides,
  };
}

describe('POST /api/auth/register', () => {
  it('returns 201 with the public user for a valid registration', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/api/auth/register').send({
      email: 'new@example.com',
      password: 'a-strong-password',
      firstName: 'New',
      lastName: 'User',
      role: 'STUDENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('returns 400 VALIDATION_ERROR for an invalid body', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with tokens for correct credentials', async () => {
    const user = await seedActiveUser();
    const { app } = createTestApp({ seedUsers: [user] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct horse battery staple' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('returns 401 for wrong credentials', async () => {
    const user = await seedActiveUser();
    const { app } = createTestApp({ seedUsers: [user] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 429 RATE_LIMITED after 5 failed attempts for the same email+IP', async () => {
    const user = await seedActiveUser();
    const { app } = createTestApp({ seedUsers: [user] });

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a bearer token', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it("returns the caller's public user with a valid bearer token", async () => {
    const user = await seedActiveUser();
    const { app } = createTestApp({ seedUsers: [user] });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct horse battery staple' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });
});

describe('POST /api/auth/refresh and /api/auth/logout', () => {
  it('rotates the refresh token, then logout revokes it', async () => {
    const user = await seedActiveUser();
    const { app } = createTestApp({ seedUsers: [user] });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct horse battery staple' });

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.data.refreshToken });
    expect(refreshRes.status).toBe(200);

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: refreshRes.body.data.refreshToken });
    expect(logoutRes.status).toBe(204);

    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshRes.body.data.refreshToken });
    expect(reuseRes.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password and /api/auth/reset-password', () => {
  it('resets the password end-to-end', async () => {
    const user = await seedActiveUser();
    const { app, sentEmails } = createTestApp({ seedUsers: [user] });

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });
    expect(forgotRes.status).toBe(204);

    const token = sentEmails[0]?.token;
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'brand-new-password' });
    expect(resetRes.status).toBe(204);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'brand-new-password' });
    expect(loginRes.status).toBe(200);
  });
});
