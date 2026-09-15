import type { PrismaClient } from '@prisma/client';
import type { AttendanceRepository } from './types';

export function createPrismaAttendanceRepository(prisma: PrismaClient): AttendanceRepository {
  return {
    async findById(id) {
      return prisma.attendance.findUnique({ where: { id } });
    },
    async findBySession(classSessionId) {
      return prisma.attendance.findMany({ where: { classSessionId } });
    },
    async findByStudent(studentProfileId) {
      const rows = await prisma.attendance.findMany({
        where: { studentProfileId },
        include: { classSession: { select: { sessionDate: true, batchId: true } } },
      });
      return rows.map((row) => ({
        id: row.id,
        classSessionId: row.classSessionId,
        studentProfileId: row.studentProfileId,
        status: row.status,
        remarks: row.remarks,
        markedAt: row.markedAt,
        sessionDate: row.classSession.sessionDate,
        batchId: row.classSession.batchId,
      }));
    },
    async upsertMany(classSessionId, records) {
      return Promise.all(
        records.map((record) =>
          prisma.attendance.upsert({
            where: {
              classSessionId_studentProfileId: {
                classSessionId,
                studentProfileId: record.studentProfileId,
              },
            },
            create: {
              classSessionId,
              studentProfileId: record.studentProfileId,
              status: record.status,
              remarks: record.remarks ?? null,
            },
            update: {
              status: record.status,
              remarks: record.remarks ?? null,
              markedAt: new Date(),
            },
          }),
        ),
      );
    },
  };
}
