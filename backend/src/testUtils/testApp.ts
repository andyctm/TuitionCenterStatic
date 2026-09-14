import { createApp, type AppDeps } from '../app';
import { createAuthService } from '../auth/authService';
import { createUsersService } from '../users/usersService';
import {
  createFakePasswordResetTokenRepository,
  createFakeRefreshTokenRepository,
  createFakeUserRepository,
} from './fakeRepositories';
import type { UserRecord } from '../repositories/types';

export const TEST_ACCESS_TOKEN_SECRET = 'test-access-secret';
export const TEST_ALLOWED_ORIGINS = ['https://acme.github.io'];

export function createTestApp(
  options: { seedUsers?: UserRecord[]; checkDb?: AppDeps['checkDb'] } = {},
) {
  const userRepo = createFakeUserRepository(options.seedUsers ?? []);
  const refreshTokenRepo = createFakeRefreshTokenRepository();
  const passwordResetTokenRepo = createFakePasswordResetTokenRepository();
  const sentEmails: { email: string; token: string }[] = [];

  const authService = createAuthService({
    userRepo,
    refreshTokenRepo,
    passwordResetTokenRepo,
    accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
    sendPasswordResetEmail: async (email, token) => {
      sentEmails.push({ email, token });
    },
  });
  const usersService = createUsersService({ userRepo });

  const app = createApp({
    allowedOrigins: TEST_ALLOWED_ORIGINS,
    checkDb: options.checkDb ?? (async () => undefined),
    authService,
    usersService,
    accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
  });

  return {
    app,
    userRepo,
    refreshTokenRepo,
    passwordResetTokenRepo,
    sentEmails,
    authService,
    usersService,
  };
}
