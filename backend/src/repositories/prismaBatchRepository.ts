import type { PrismaClient } from '@prisma/client';
import type { BatchRepository } from './types';

export function createPrismaBatchRepository(prisma: PrismaClient): BatchRepository {
  return {
    async findAll(filter) {
      return prisma.batch.findMany({
        where: {
          ...(filter.branchIds ? { branchId: { in: filter.branchIds } } : {}),
          ...(filter.teacherUserId ? { teacherUserId: filter.teacherUserId } : {}),
          ...(filter.courseId ? { courseId: filter.courseId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.term ? { term: filter.term } : {}),
        },
      });
    },
    async findById(id) {
      return prisma.batch.findUnique({ where: { id } });
    },
    async create(input) {
      return prisma.batch.create({ data: input });
    },
    async update(id, input) {
      return prisma.batch.update({ where: { id }, data: input });
    },
  };
}
