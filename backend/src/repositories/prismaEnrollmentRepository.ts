import { Prisma, type PrismaClient } from '@prisma/client';
import type { EnrollmentCreateResult, EnrollmentRepository } from './types';

export function createPrismaEnrollmentRepository(prisma: PrismaClient): EnrollmentRepository {
  return {
    async findAll(filter) {
      return prisma.enrollment.findMany({
        where: {
          ...(filter.batchId ? { batchId: filter.batchId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.studentProfileIds
            ? { studentProfileId: { in: filter.studentProfileIds } }
            : {}),
          ...(filter.branchIds ? { batch: { branchId: { in: filter.branchIds } } } : {}),
        },
      });
    },
    async findById(id) {
      return prisma.enrollment.findUnique({ where: { id } });
    },
    // enrollment capability: the capacity check and the insert must happen inside a single
    // serializable transaction, not as two separate round-trips, to avoid a TOCTOU race under
    // concurrent requests for the last seat.
    async createIfCapacityAvailable(input): Promise<EnrollmentCreateResult> {
      return prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.enrollment.findFirst({
            where: {
              batchId: input.batchId,
              studentProfileId: input.studentProfileId,
              status: 'ACTIVE',
            },
          });
          if (duplicate) {
            return { outcome: 'DUPLICATE' };
          }

          const activeCount = await tx.enrollment.count({
            where: { batchId: input.batchId, status: 'ACTIVE' },
          });
          if (activeCount >= input.capacity) {
            return { outcome: 'AT_CAPACITY' };
          }

          const enrollment = await tx.enrollment.create({
            data: {
              batchId: input.batchId,
              studentProfileId: input.studentProfileId,
              status: 'ACTIVE',
            },
          });
          return { outcome: 'CREATED', enrollment };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
    async updateStatus(id, status) {
      return prisma.enrollment.update({ where: { id }, data: { status } });
    },
  };
}
