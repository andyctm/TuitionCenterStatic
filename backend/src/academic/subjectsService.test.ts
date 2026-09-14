import { describe, expect, it } from 'vitest';
import { createSubjectsService } from './subjectsService';
import { createFakeSubjectRepository } from '../testUtils/fakeRepositories';

describe('subjectsService.create', () => {
  it('rejects a duplicate subject code with 409', async () => {
    const repo = createFakeSubjectRepository([{ id: 's1', name: 'Mathematics', code: 'MATH' }]);
    const service = createSubjectsService({ subjectRepo: repo });

    await expect(service.create({ name: 'Maths', code: 'MATH' })).rejects.toMatchObject({
      code: 'CONFLICT',
      httpStatus: 409,
    });
  });

  it('creates a subject with a unique code', async () => {
    const repo = createFakeSubjectRepository();
    const service = createSubjectsService({ subjectRepo: repo });

    const result = await service.create({ name: 'Science', code: 'SCI' });

    expect(result).toMatchObject({ name: 'Science', code: 'SCI' });
  });
});

describe('subjectsService.list', () => {
  it('returns all subjects', async () => {
    const repo = createFakeSubjectRepository([{ id: 's1', name: 'Mathematics', code: 'MATH' }]);
    const service = createSubjectsService({ subjectRepo: repo });

    const result = await service.list();

    expect(result).toHaveLength(1);
  });
});
