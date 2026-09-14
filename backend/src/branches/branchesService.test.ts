import { describe, expect, it } from 'vitest';
import { createBranchesService } from './branchesService';
import { createFakeBranchRepository } from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import type { BranchRecord } from '../repositories/types';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'user_1', role: 'SUPER_ADMIN', branchIds: [], ...overrides };
}

function seedBranch(overrides: Partial<BranchRecord> = {}): BranchRecord {
  return {
    id: 'branch_colombo',
    name: 'Colombo',
    timezone: 'Asia/Colombo',
    isActive: true,
    ...overrides,
  };
}

describe('branchesService.list', () => {
  it('returns every branch for a Super Admin', async () => {
    const colombo = seedBranch();
    const kandy = seedBranch({ id: 'branch_kandy', name: 'Kandy' });
    const repo = createFakeBranchRepository([colombo, kandy]);
    const service = createBranchesService({ branchRepo: repo });

    const result = await service.list(ctx({ role: 'SUPER_ADMIN' }));

    expect(result.map((b) => b.id).sort()).toEqual(['branch_colombo', 'branch_kandy']);
  });

  it('returns only assigned branches for a Center Admin', async () => {
    const colombo = seedBranch();
    const kandy = seedBranch({ id: 'branch_kandy', name: 'Kandy' });
    const repo = createFakeBranchRepository([colombo, kandy]);
    const service = createBranchesService({ branchRepo: repo });

    const result = await service.list(
      ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }),
    );

    expect(result.map((b) => b.id)).toEqual(['branch_colombo']);
  });
});

describe('branchesService.getById', () => {
  it('returns 404 when a Center Admin requests an out-of-scope branch', async () => {
    const kandy = seedBranch({ id: 'branch_kandy', name: 'Kandy' });
    const repo = createFakeBranchRepository([kandy]);
    const service = createBranchesService({ branchRepo: repo });

    await expect(
      service.getById(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_colombo'] }), 'branch_kandy'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('returns the branch for a Super Admin regardless of scope', async () => {
    const kandy = seedBranch({ id: 'branch_kandy', name: 'Kandy' });
    const repo = createFakeBranchRepository([kandy]);
    const service = createBranchesService({ branchRepo: repo });

    const result = await service.getById(ctx({ role: 'SUPER_ADMIN' }), 'branch_kandy');

    expect(result.id).toBe('branch_kandy');
  });
});

describe('branchesService.create', () => {
  it('rejects a duplicate branch name with 409', async () => {
    const repo = createFakeBranchRepository([seedBranch({ name: 'Colombo' })]);
    const service = createBranchesService({ branchRepo: repo });

    await expect(service.create({ name: 'Colombo' })).rejects.toMatchObject({
      code: 'CONFLICT',
      httpStatus: 409,
    });
  });

  it('creates a branch with a default timezone', async () => {
    const repo = createFakeBranchRepository();
    const service = createBranchesService({ branchRepo: repo });

    const result = await service.create({ name: 'Galle' });

    expect(result.name).toBe('Galle');
    expect(result.timezone).toBe('Asia/Colombo');
  });
});

describe('branchesService.update', () => {
  it('throws 404 for a non-existent branch', async () => {
    const repo = createFakeBranchRepository();
    const service = createBranchesService({ branchRepo: repo });

    await expect(service.update('missing', { name: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('updates an existing branch', async () => {
    const repo = createFakeBranchRepository([seedBranch()]);
    const service = createBranchesService({ branchRepo: repo });

    const result = await service.update('branch_colombo', { isActive: false });

    expect(result.isActive).toBe(false);
  });
});
