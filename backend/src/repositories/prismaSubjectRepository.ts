import type { PrismaClient } from '@prisma/client';
import type { SubjectRepository } from './types';

export function createPrismaSubjectRepository(prisma: PrismaClient): SubjectRepository {
  return {
    async findAll() {
      return prisma.subject.findMany();
    },
    async findByCode(code) {
      return prisma.subject.findUnique({ where: { code } });
    },
    async create(input) {
      return prisma.subject.create({ data: input });
    },
  };
}
