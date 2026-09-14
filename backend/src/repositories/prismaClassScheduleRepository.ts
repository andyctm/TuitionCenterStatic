import type { PrismaClient } from '@prisma/client';
import type { ClassScheduleRepository } from './types';

export function createPrismaClassScheduleRepository(
  prisma: PrismaClient,
): ClassScheduleRepository {
  return {
    async findByBatch(batchId) {
      return prisma.classSchedule.findMany({ where: { batchId } });
    },
    async findById(id) {
      return prisma.classSchedule.findUnique({ where: { id } });
    },
    async findConflictCandidates(branchId, dayOfWeek) {
      const rows = await prisma.classSchedule.findMany({
        where: { dayOfWeek, batch: { branchId } },
        include: { batch: { select: { room: true, teacherUserId: true } } },
      });
      return rows.map((row) => ({
        id: row.id,
        batchId: row.batchId,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        room: row.batch.room,
        teacherUserId: row.batch.teacherUserId,
      }));
    },
    async create(input) {
      return prisma.classSchedule.create({ data: input });
    },
    async delete(id) {
      await prisma.classSchedule.delete({ where: { id } });
    },
  };
}
