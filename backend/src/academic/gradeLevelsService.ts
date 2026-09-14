import { AppError } from '../errors/AppError';
import type {
  GradeLevelRecord,
  GradeLevelRepository,
  NewGradeLevelInput,
} from '../repositories/types';

export type GradeLevelsServiceDeps = {
  gradeLevelRepo: GradeLevelRepository;
};

export function createGradeLevelsService(deps: GradeLevelsServiceDeps) {
  const { gradeLevelRepo } = deps;

  return {
    async list(): Promise<GradeLevelRecord[]> {
      return gradeLevelRepo.findAll();
    },

    async create(input: NewGradeLevelInput): Promise<GradeLevelRecord> {
      const existing = await gradeLevelRepo.findByName(input.name);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'A grade level with this name already exists');
      }
      return gradeLevelRepo.create(input);
    },
  };
}

export type GradeLevelsService = ReturnType<typeof createGradeLevelsService>;
