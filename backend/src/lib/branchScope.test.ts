import { describe, expect, it } from 'vitest';
import { isInBranchScope, isSuperAdmin } from './branchScope';
import type { AuthContext } from '../types/authContext';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'user_1', role: 'CENTER_ADMIN', branchIds: ['branch_colombo'], ...overrides };
}

describe('isSuperAdmin', () => {
  it('is true only for SUPER_ADMIN', () => {
    expect(isSuperAdmin(ctx({ role: 'SUPER_ADMIN' }))).toBe(true);
    expect(isSuperAdmin(ctx({ role: 'CENTER_ADMIN' }))).toBe(false);
  });
});

describe('isInBranchScope', () => {
  it('allows a Super Admin regardless of branch', () => {
    expect(isInBranchScope(ctx({ role: 'SUPER_ADMIN', branchIds: [] }), 'branch_kandy')).toBe(
      true,
    );
  });

  it('allows a Center Admin whose assigned branch matches', () => {
    expect(isInBranchScope(ctx({ branchIds: ['branch_colombo'] }), 'branch_colombo')).toBe(true);
  });

  it('blocks a Center Admin scoped to a different branch', () => {
    expect(isInBranchScope(ctx({ branchIds: ['branch_colombo'] }), 'branch_kandy')).toBe(false);
  });
});
