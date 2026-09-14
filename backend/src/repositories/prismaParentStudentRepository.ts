import type { PrismaClient } from '@prisma/client';
import type { ParentStudentRepository } from './types';

export function createPrismaParentStudentRepository(
  prisma: PrismaClient,
): ParentStudentRepository {
  return {
    async listStudentProfileIdsForParent(parentUserId) {
      const links = await prisma.parentStudent.findMany({
        where: { parentUserId },
        select: { studentProfileId: true },
      });
      return links.map((link) => link.studentProfileId);
    },
  };
}
