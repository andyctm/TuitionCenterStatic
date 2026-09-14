import type { Role } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { omitPasswordHash } from '../lib/publicUser';
import type {
  PasswordResetTokenRepository,
  RefreshTokenRepository,
  UserRecord,
  UserRepository,
} from '../repositories/types';
import { signAccessToken } from './accessToken';
import { hashPassword, verifyPassword } from './password';
import { generateOpaqueToken, hashOpaqueToken } from './opaqueToken';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // auth capability: 7 day refresh token TTL.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour.
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Extract<Role, 'STUDENT' | 'PARENT'>;
};

export type AuthServiceDeps = {
  userRepo: UserRepository;
  refreshTokenRepo: RefreshTokenRepository;
  passwordResetTokenRepo: PasswordResetTokenRepository;
  accessTokenSecret: string;
  sendPasswordResetEmail: (email: string, token: string) => Promise<void>;
};

export function createAuthService(deps: AuthServiceDeps) {
  const { userRepo, refreshTokenRepo, passwordResetTokenRepo, accessTokenSecret } = deps;

  async function issueTokenPair(user: UserRecord) {
    const accessToken = signAccessToken(
      { sub: user.id, role: user.role, branchIds: user.branchId ? [user.branchId] : [] },
      accessTokenSecret,
    );
    const refreshToken = generateOpaqueToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hashOpaqueToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return { accessToken, refreshToken };
  }

  return {
    async register(input: RegisterInput): Promise<PublicUser> {
      const existing = await userRepo.findByEmail(input.email);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'An account with this email already exists');
      }

      const user = await userRepo.create({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        status: 'PENDING',
      });

      return omitPasswordHash(user);
    },

    async login(input: { email: string; password: string }) {
      const user = await userRepo.findByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new AppError('UNAUTHENTICATED', 401, GENERIC_LOGIN_ERROR);
      }

      if (user.status === 'PENDING') {
        throw new AppError('FORBIDDEN', 403, 'Your account is awaiting admin approval');
      }
      if (user.status !== 'ACTIVE') {
        throw new AppError('FORBIDDEN', 403, 'Your account is not active');
      }

      const { accessToken, refreshToken } = await issueTokenPair(user);
      return { accessToken, refreshToken, user: omitPasswordHash(user) };
    },

    async refresh(input: { refreshToken: string }) {
      const record = await refreshTokenRepo.findByHash(hashOpaqueToken(input.refreshToken));
      if (!record) {
        throw new AppError('UNAUTHENTICATED', 401, 'Invalid refresh token');
      }

      if (record.revokedAt) {
        // A previously-rotated (or logged-out) token was replayed — treat as possible theft and
        // invalidate the whole chain rather than trusting this session further.
        await refreshTokenRepo.revokeAllForUser(record.userId);
        throw new AppError('UNAUTHENTICATED', 401, 'Refresh token has already been used');
      }

      if (record.expiresAt.getTime() < Date.now()) {
        throw new AppError('UNAUTHENTICATED', 401, 'Refresh token has expired');
      }

      const user = await userRepo.findById(record.userId);
      if (!user) {
        throw new AppError('UNAUTHENTICATED', 401, 'Invalid refresh token');
      }

      await refreshTokenRepo.revoke(record.id);
      return issueTokenPair(user);
    },

    async logout(input: { refreshToken: string }): Promise<void> {
      const record = await refreshTokenRepo.findByHash(hashOpaqueToken(input.refreshToken));
      if (record && !record.revokedAt) {
        await refreshTokenRepo.revoke(record.id);
      }
    },

    async forgotPassword(input: { email: string }): Promise<void> {
      const user = await userRepo.findByEmail(input.email);
      if (!user) {
        // Never reveal whether the email exists.
        return;
      }

      const token = generateOpaqueToken();
      await passwordResetTokenRepo.create({
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      await deps.sendPasswordResetEmail(user.email, token);
    },

    async resetPassword(input: { token: string; newPassword: string }): Promise<void> {
      const record = await passwordResetTokenRepo.findByHash(hashOpaqueToken(input.token));
      if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired reset token');
      }

      await userRepo.updatePasswordHash(record.userId, await hashPassword(input.newPassword));
      await passwordResetTokenRepo.markUsed(record.id);
      await refreshTokenRepo.revokeAllForUser(record.userId);
    },

    async me(userId: string): Promise<PublicUser> {
      const user = await userRepo.findById(userId);
      if (!user) {
        throw new AppError('NOT_FOUND', 404, 'User not found');
      }
      return omitPasswordHash(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
