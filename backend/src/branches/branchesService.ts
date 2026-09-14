import { AppError } from '../errors/AppError';
import { isInBranchScope, isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type { BranchRecord, BranchRepository, NewBranchInput, UpdateBranchInput } from '../repositories/types';

export type BranchesServiceDeps = {
  branchRepo: BranchRepository;
};

export function createBranchesService(deps: BranchesServiceDeps) {
  const { branchRepo } = deps;

  return {
    async list(ctx: AuthContext): Promise<BranchRecord[]> {
      return branchRepo.findAll(isSuperAdmin(ctx) ? undefined : { ids: ctx.branchIds });
    },

    async getById(ctx: AuthContext, id: string): Promise<BranchRecord> {
      const branch = await branchRepo.findById(id);
      if (!branch || !isInBranchScope(ctx, branch.id)) {
        throw new AppError('NOT_FOUND', 404, 'Branch not found');
      }
      return branch;
    },

    async create(input: NewBranchInput): Promise<BranchRecord> {
      const existing = (await branchRepo.findAll()).find((b) => b.name === input.name);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'A branch with this name already exists');
      }
      return branchRepo.create(input);
    },

    async update(id: string, input: UpdateBranchInput): Promise<BranchRecord> {
      const existing = await branchRepo.findById(id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 404, 'Branch not found');
      }
      return branchRepo.update(id, input);
    },
  };
}

export type BranchesService = ReturnType<typeof createBranchesService>;
