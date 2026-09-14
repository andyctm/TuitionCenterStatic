import type { PrismaClient } from '@prisma/client';
import type { CourseRepository } from './types';

export function createPrismaCourseRepository(prisma: PrismaClient): CourseRepository {
  return {
    async findAll() {
      return prisma.course.findMany();
    },
    async findById(id) {
      return prisma.course.findUnique({ where: { id } });
    },
    async findBySubjectAndGrade(subjectId, gradeLevelId) {
      return prisma.course.findUnique({
        where: { subjectId_gradeLevelId: { subjectId, gradeLevelId } },
      });
    },
    async create(input) {
      return prisma.course.create({ data: input });
    },
    async update(id, input) {
      return prisma.course.update({ where: { id }, data: input });
    },
    async delete(id) {
      await prisma.course.delete({ where: { id } });
    },
  };
}
