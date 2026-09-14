import type { PrismaClient } from '@prisma/client';
import type { GradeLevelRepository } from './types';

export function createPrismaGradeLevelRepository(prisma: PrismaClient): GradeLevelRepository {
  return {
    async findAll() {
      return prisma.gradeLevel.findMany();
    },
    async findByName(name) {
      return prisma.gradeLevel.findUnique({ where: { name } });
    },
    async create(input) {
      return prisma.gradeLevel.create({ data: input });
    },
  };
}
