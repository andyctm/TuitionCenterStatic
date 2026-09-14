import { AppError } from '../errors/AppError';
import type { NewSubjectInput, SubjectRecord, SubjectRepository } from '../repositories/types';

export type SubjectsServiceDeps = {
  subjectRepo: SubjectRepository;
};

export function createSubjectsService(deps: SubjectsServiceDeps) {
  const { subjectRepo } = deps;

  return {
    async list(): Promise<SubjectRecord[]> {
      return subjectRepo.findAll();
    },

    async create(input: NewSubjectInput): Promise<SubjectRecord> {
      const existing = await subjectRepo.findByCode(input.code);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'A subject with this code already exists');
      }
      return subjectRepo.create(input);
    },
  };
}

export type SubjectsService = ReturnType<typeof createSubjectsService>;
