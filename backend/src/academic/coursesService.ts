import { AppError } from '../errors/AppError';
import type {
  CourseRecord,
  CourseRepository,
  GradeLevelRepository,
  NewCourseInput,
  SubjectRepository,
  UpdateCourseInput,
} from '../repositories/types';

export type CoursesServiceDeps = {
  courseRepo: CourseRepository;
  subjectRepo: SubjectRepository;
  gradeLevelRepo: GradeLevelRepository;
};

export function createCoursesService(deps: CoursesServiceDeps) {
  const { courseRepo, subjectRepo, gradeLevelRepo } = deps;

  return {
    async list(): Promise<CourseRecord[]> {
      return courseRepo.findAll();
    },

    async create(input: NewCourseInput): Promise<CourseRecord> {
      const subjects = await subjectRepo.findAll();
      if (!subjects.some((s) => s.id === input.subjectId)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unknown subjectId', [
          { field: 'subjectId', issue: 'no subject with this id exists' },
        ]);
      }

      const gradeLevels = await gradeLevelRepo.findAll();
      if (!gradeLevels.some((g) => g.id === input.gradeLevelId)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unknown gradeLevelId', [
          { field: 'gradeLevelId', issue: 'no grade level with this id exists' },
        ]);
      }

      const existing = await courseRepo.findBySubjectAndGrade(
        input.subjectId,
        input.gradeLevelId,
      );
      if (existing) {
        throw new AppError(
          'CONFLICT',
          409,
          'A course already exists for this subject and grade level',
        );
      }

      return courseRepo.create(input);
    },

    async update(id: string, input: UpdateCourseInput): Promise<CourseRecord> {
      const existing = await courseRepo.findById(id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 404, 'Course not found');
      }
      return courseRepo.update(id, input);
    },

    async delete(id: string): Promise<void> {
      const existing = await courseRepo.findById(id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 404, 'Course not found');
      }
      await courseRepo.delete(id);
    },
  };
}

export type CoursesService = ReturnType<typeof createCoursesService>;
