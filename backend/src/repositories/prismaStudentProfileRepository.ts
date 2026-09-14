import type { PrismaClient } from '@prisma/client';
import type { StudentProfileRepository } from './types';

export function createPrismaStudentProfileRepository(
  prisma: PrismaClient,
): StudentProfileRepository {
  return {
    async findById(id) {
      return prisma.studentProfile.findUnique({ where: { id } });
    },
    async findByUserId(userId) {
      return prisma.studentProfile.findUnique({ where: { userId } });
    },
    async create(input) {
      return prisma.studentProfile.create({ data: input });
    },
  };
}
