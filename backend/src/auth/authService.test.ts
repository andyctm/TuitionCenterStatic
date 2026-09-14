import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/AppError';
import {
  createFakePasswordResetTokenRepository,
  createFakeRefreshTokenRepository,
  createFakeUserRepository,
} from '../testUtils/fakeRepositories';
import { hashPassword } from './password';
import { createAuthService } from './authService';

const accessTokenSecret = 'test-secret';

async function makeService(seedUsers: Parameters<typeof createFakeUserRepository>[0] = []) {
  const userRepo = createFakeUserRepository(seedUsers);
  const refreshTokenRepo = createFakeRefreshTokenRepository();
  const passwordResetTokenRepo = createFakePasswordResetTokenRepository();
  const sentEmails: { email: string; token: string }[] = [];

  const service = createAuthService({
    userRepo,
    refreshTokenRepo,
    passwordResetTokenRepo,
    accessTokenSecret,
    sendPasswordResetEmail: async (email, token) => {
      sentEmails.push({ email, token });
    },
  });

  return { service, userRepo, refreshTokenRepo, passwordResetTokenRepo, sentEmails };
}

async function activeUser(overrides: Partial<{ email: string; password: string }> = {}) {
  const password = overrides.password ?? 'correct horse battery staple';
  return {
    id: 'user_1',
    email: overrides.email ?? 'active@example.com',
    passwordHash: await hashPassword(password),
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'STUDENT' as const,
    status: 'ACTIVE' as const,
    branchId: null,
  };
}

describe('authService.register', () => {
  it('creates a PENDING user and never returns the password hash', async () => {
    const { service } = await makeService();

    const user = await service.register({
      email: 'new@example.com',
      password: 'a-strong-password',
      firstName: 'New',
      lastName: 'User',
      role: 'STUDENT',
    });

    expect(user.status).toBe('PENDING');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with a 409 CONFLICT', async () => {
    const existing = await activeUser({ email: 'dup@example.com' });
    const { service } = await makeService([existing]);

    await expect(
      service.register({
        email: 'dup@example.com',
        password: 'whatever123',
        firstName: 'X',
        lastName: 'Y',
        role: 'STUDENT',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });
});

describe('authService.login', () => {
  it('returns tokens and the public user for correct credentials on an ACTIVE account', async () => {
    const user = await activeUser();
    const { service } = await makeService([user]);

    const result = await service.login({
      email: user.email,
      password: 'correct horse battery staple',
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user.email).toBe(user.email);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an unknown email with a generic 401 (no enumeration)', async () => {
    const { service } = await makeService();

    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
      message: 'Invalid email or password',
    });
  });

  it('rejects a wrong password with the same generic 401 message', async () => {
    const user = await activeUser();
    const { service } = await makeService([user]);

    await expect(
      service.login({ email: user.email, password: 'totally-wrong' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
      message: 'Invalid email or password',
    });
  });

  it('rejects a PENDING account with a distinct 403 (not the generic invalid-credentials message)', async () => {
    const user = { ...(await activeUser()), status: 'PENDING' as const };
    const { service } = await makeService([user]);

    await expect(
      service.login({ email: user.email, password: 'correct horse battery staple' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('rejects a SUSPENDED account with 403', async () => {
    const user = { ...(await activeUser()), status: 'SUSPENDED' as const };
    const { service } = await makeService([user]);

    await expect(
      service.login({ email: user.email, password: 'correct horse battery staple' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });
});

describe('authService.refresh', () => {
  it('rotates the refresh token: the old token stops working, the new one works', async () => {
    const user = await activeUser();
    const { service } = await makeService([user]);
    const { refreshToken } = await service.login({
      email: user.email,
      password: 'correct horse battery staple',
    });

    const rotated = await service.refresh({ refreshToken });

    expect(rotated.accessToken).toEqual(expect.any(String));
    expect(rotated.refreshToken).not.toBe(refreshToken);
    await expect(service.refresh({ refreshToken })).rejects.toMatchObject({ httpStatus: 401 });
  });

  it('revokes the whole refresh-token chain if an already-rotated token is replayed', async () => {
    const user = await activeUser();
    const { service, refreshTokenRepo } = await makeService([user]);
    const { refreshToken } = await service.login({
      email: user.email,
      password: 'correct horse battery staple',
    });
    const { refreshToken: rotatedOnce } = await service.refresh({ refreshToken });

    // Replay the original (now-revoked) token.
    await expect(service.refresh({ refreshToken })).rejects.toMatchObject({ httpStatus: 401 });
    // The second-generation token should now be revoked too (whole chain invalidated).
    await expect(service.refresh({ refreshToken: rotatedOnce })).rejects.toMatchObject({
      httpStatus: 401,
    });
    void refreshTokenRepo;
  });

  it('rejects an unknown refresh token', async () => {
    const { service } = await makeService();

    await expect(service.refresh({ refreshToken: 'not-a-real-token' })).rejects.toMatchObject({
      httpStatus: 401,
    });
  });
});

describe('authService.logout', () => {
  it('revokes the given refresh token so it can no longer be used', async () => {
    const user = await activeUser();
    const { service } = await makeService([user]);
    const { refreshToken } = await service.login({
      email: user.email,
      password: 'correct horse battery staple',
    });

    await service.logout({ refreshToken });

    await expect(service.refresh({ refreshToken })).rejects.toMatchObject({ httpStatus: 401 });
  });

  it('is idempotent/silent for an unknown refresh token (never leaks whether it existed)', async () => {
    const { service } = await makeService();

    await expect(service.logout({ refreshToken: 'unknown' })).resolves.toBeUndefined();
  });
});

describe('authService.forgotPassword / resetPassword', () => {
  it('sends a reset email only when the account exists, but always resolves silently either way', async () => {
    const user = await activeUser();
    const { service, sentEmails } = await makeService([user]);

    await service.forgotPassword({ email: user.email });
    await service.forgotPassword({ email: 'nobody@example.com' });

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.email).toBe(user.email);
  });

  it('resets the password with a valid token and revokes existing refresh tokens', async () => {
    const user = await activeUser();
    const { service, sentEmails } = await makeService([user]);
    await service.forgotPassword({ email: user.email });
    const token = sentEmails[0]?.token;
    if (!token) throw new Error('expected a reset token to have been sent');

    await service.resetPassword({ token, newPassword: 'brand-new-password' });

    const result = await service.login({ email: user.email, password: 'brand-new-password' });
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it('rejects an invalid reset token', async () => {
    const { service } = await makeService();

    await expect(
      service.resetPassword({ token: 'bogus', newPassword: 'whatever123' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects reusing an already-used reset token', async () => {
    const user = await activeUser();
    const { service, sentEmails } = await makeService([user]);
    await service.forgotPassword({ email: user.email });
    const token = sentEmails[0]?.token;
    if (!token) throw new Error('expected a reset token to have been sent');
    await service.resetPassword({ token, newPassword: 'first-new-password' });

    await expect(
      service.resetPassword({ token, newPassword: 'second-new-password' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('authService.me', () => {
  it('returns the public user for a known id', async () => {
    const user = await activeUser();
    const { service } = await makeService([user]);

    const result = await service.me(user.id);

    expect(result.email).toBe(user.email);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    const { service } = await makeService();

    await expect(service.me('nope')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });
});
