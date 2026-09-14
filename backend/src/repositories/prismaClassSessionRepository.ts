import type { PrismaClient } from '@prisma/client';
import type { ClassSessionRepository } from './types';

export function createPrismaClassSessionRepository(prisma: PrismaClient): ClassSessionRepository {
  return {
    async findByBatch(batchId) {
      return prisma.classSession.findMany({ where: { batchId } });
    },
    async findById(id) {
      return prisma.classSession.findUnique({ where: { id } });
    },
    async findByBatchAndDate(batchId, sessionDate) {
      return prisma.classSession.findUnique({
        where: { batchId_sessionDate: { batchId, sessionDate } },
      });
    },
    async create(input) {
      return prisma.classSession.create({ data: { status: 'SCHEDULED', ...input } });
    },
  };
}
