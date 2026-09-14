import type { PrismaClient } from '@prisma/client';
import type { NewUserInput, UserRecord, UserRepository } from './types';

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },
    async findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },
    async create(input: NewUserInput): Promise<UserRecord> {
      return prisma.user.create({ data: input });
    },
    async updateStatus(id, status) {
      return prisma.user.update({ where: { id }, data: { status } });
    },
    async updatePasswordHash(id, passwordHash) {
      await prisma.user.update({ where: { id }, data: { passwordHash } });
    },
  };
}
