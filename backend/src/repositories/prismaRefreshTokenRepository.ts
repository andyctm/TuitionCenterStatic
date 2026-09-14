import type { PrismaClient } from '@prisma/client';
import type { RefreshTokenRepository } from './types';

export function createPrismaRefreshTokenRepository(prisma: PrismaClient): RefreshTokenRepository {
  return {
    async create(input) {
      return prisma.refreshToken.create({ data: input });
    },
    async findByHash(tokenHash) {
      return prisma.refreshToken.findUnique({ where: { tokenHash } });
    },
    async revoke(id) {
      await prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
    },
    async revokeAllForUser(userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}
