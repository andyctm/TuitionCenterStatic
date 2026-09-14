import { randomUUID } from 'node:crypto';
import type {
  NewUserInput,
  PasswordResetTokenRecord,
  PasswordResetTokenRepository,
  RefreshTokenRecord,
  RefreshTokenRepository,
  UserRecord,
  UserRepository,
} from '../repositories/types';

export function createFakeUserRepository(seed: UserRecord[] = []): UserRepository {
  const users = new Map(seed.map((u) => [u.id, u]));

  return {
    async findByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async create(input: NewUserInput) {
      const record: UserRecord = { id: randomUUID(), branchId: null, ...input };
      users.set(record.id, record);
      return record;
    },
    async updateStatus(id, status) {
      const existing = users.get(id);
      if (!existing) throw new Error(`no fake user ${id}`);
      const updated = { ...existing, status };
      users.set(id, updated);
      return updated;
    },
    async updatePasswordHash(id, passwordHash) {
      const existing = users.get(id);
      if (!existing) throw new Error(`no fake user ${id}`);
      users.set(id, { ...existing, passwordHash });
    },
  };
}

export function createFakeRefreshTokenRepository(): RefreshTokenRepository {
  const tokens = new Map<string, RefreshTokenRecord>();

  return {
    async create(input) {
      const record: RefreshTokenRecord = { id: randomUUID(), revokedAt: null, ...input };
      tokens.set(record.id, record);
      return record;
    },
    async findByHash(tokenHash) {
      return [...tokens.values()].find((t) => t.tokenHash === tokenHash) ?? null;
    },
    async revoke(id) {
      const existing = tokens.get(id);
      if (existing) tokens.set(id, { ...existing, revokedAt: new Date() });
    },
    async revokeAllForUser(userId) {
      for (const [id, token] of tokens) {
        if (token.userId === userId && !token.revokedAt) {
          tokens.set(id, { ...token, revokedAt: new Date() });
        }
      }
    },
  };
}

export function createFakePasswordResetTokenRepository(): PasswordResetTokenRepository {
  const tokens = new Map<string, PasswordResetTokenRecord>();

  return {
    async create(input) {
      const record: PasswordResetTokenRecord = { id: randomUUID(), usedAt: null, ...input };
      tokens.set(record.id, record);
      return record;
    },
    async findByHash(tokenHash) {
      return [...tokens.values()].find((t) => t.tokenHash === tokenHash) ?? null;
    },
    async markUsed(id) {
      const existing = tokens.get(id);
      if (existing) tokens.set(id, { ...existing, usedAt: new Date() });
    },
  };
}
