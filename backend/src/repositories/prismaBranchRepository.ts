import type { PrismaClient } from '@prisma/client';
import type { BranchRepository } from './types';

export function createPrismaBranchRepository(prisma: PrismaClient): BranchRepository {
  return {
    async findAll(filter) {
      return prisma.branch.findMany(filter?.ids ? { where: { id: { in: filter.ids } } } : undefined);
    },
    async findById(id) {
      return prisma.branch.findUnique({ where: { id } });
    },
    async create(input) {
      return prisma.branch.create({ data: input });
    },
    async update(id, input) {
      return prisma.branch.update({ where: { id }, data: input });
    },
  };
}
