import { describe, expect, it } from 'vitest';
import { createCoursesService } from './coursesService';
import {
  createFakeCourseRepository,
  createFakeGradeLevelRepository,
  createFakeSubjectRepository,
} from '../testUtils/fakeRepositories';

function makeDeps() {
  const subjectRepo = createFakeSubjectRepository([{ id: 'subj_1', name: 'Math', code: 'MATH' }]);
  const gradeLevelRepo = createFakeGradeLevelRepository([
    { id: 'grade_1', name: 'Primary 3', sortOrder: 3 },
  ]);
  const courseRepo = createFakeCourseRepository();
  return { subjectRepo, gradeLevelRepo, courseRepo };
}

describe('coursesService.create', () => {
  it('rejects an unknown subjectId with 400', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);

    await expect(
      service.create({ subjectId: 'missing', gradeLevelId: 'grade_1', name: 'Primary 3 Math' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
  });

  it('rejects an unknown gradeLevelId with 400', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);

    await expect(
      service.create({ subjectId: 'subj_1', gradeLevelId: 'missing', name: 'Primary 3 Math' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
  });

  it('rejects a duplicate subject+gradeLevel combination with 409', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);
    await service.create({ subjectId: 'subj_1', gradeLevelId: 'grade_1', name: 'Primary 3 Math' });

    await expect(
      service.create({
        subjectId: 'subj_1',
        gradeLevelId: 'grade_1',
        name: 'Primary 3 Math (again)',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('creates a course for a valid subject+gradeLevel pair', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);

    const result = await service.create({
      subjectId: 'subj_1',
      gradeLevelId: 'grade_1',
      name: 'Primary 3 Math',
    });

    expect(result.name).toBe('Primary 3 Math');
  });
});

describe('coursesService.update', () => {
  it('throws 404 for a non-existent course', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);

    await expect(service.update('missing', { name: 'New name' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });
});

describe('coursesService.delete', () => {
  it('throws 404 for a non-existent course', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);

    await expect(service.delete('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('deletes an existing course', async () => {
    const deps = makeDeps();
    const service = createCoursesService(deps);
    const created = await service.create({
      subjectId: 'subj_1',
      gradeLevelId: 'grade_1',
      name: 'Primary 3 Math',
    });

    await service.delete(created.id);

    expect(await deps.courseRepo.findById(created.id)).toBeNull();
  });
});
