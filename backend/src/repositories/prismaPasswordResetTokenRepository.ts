import type { PrismaClient } from '@prisma/client';
import type { PasswordResetTokenRepository } from './types';

export function createPrismaPasswordResetTokenRepository(
  prisma: PrismaClient,
): PasswordResetTokenRepository {
  return {
    async create(input) {
      return prisma.passwordResetToken.create({ data: input });
    },
    async findByHash(tokenHash) {
      return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    },
    async markUsed(id) {
      await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
    },
  };
}
