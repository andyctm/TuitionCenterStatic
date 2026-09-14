import type { Role, UserStatus } from '@prisma/client';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  branchId: string | null;
};

export type NewUserInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  branchId?: string | null;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: NewUserInput): Promise<UserRecord>;
  updateStatus(id: string, status: UserStatus): Promise<UserRecord>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export interface PasswordResetTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord>;
  findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string): Promise<void>;
}
