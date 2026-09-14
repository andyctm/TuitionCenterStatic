import { describe, expect, it } from 'vitest';
import { createGradeLevelsService } from './gradeLevelsService';
import { createFakeGradeLevelRepository } from '../testUtils/fakeRepositories';

describe('gradeLevelsService.create', () => {
  it('rejects a duplicate grade level name with 409', async () => {
    const repo = createFakeGradeLevelRepository([{ id: 'g1', name: 'Primary 3', sortOrder: 3 }]);
    const service = createGradeLevelsService({ gradeLevelRepo: repo });

    await expect(service.create({ name: 'Primary 3', sortOrder: 3 })).rejects.toMatchObject({
      code: 'CONFLICT',
      httpStatus: 409,
    });
  });

  it('creates a grade level with a unique name', async () => {
    const repo = createFakeGradeLevelRepository();
    const service = createGradeLevelsService({ gradeLevelRepo: repo });

    const result = await service.create({ name: 'Primary 4', sortOrder: 4 });

    expect(result).toMatchObject({ name: 'Primary 4', sortOrder: 4 });
  });
});

describe('gradeLevelsService.list', () => {
  it('returns all grade levels', async () => {
    const repo = createFakeGradeLevelRepository([{ id: 'g1', name: 'Primary 3', sortOrder: 3 }]);
    const service = createGradeLevelsService({ gradeLevelRepo: repo });

    const result = await service.list();

    expect(result).toHaveLength(1);
  });
});
