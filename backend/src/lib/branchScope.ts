import type { AuthContext } from '../types/authContext';

export function isSuperAdmin(ctx: AuthContext): boolean {
  return ctx.role === 'SUPER_ADMIN';
}

// branch-scoping capability: Super Admin sees everything; everyone else is confined
// to their assigned branch(es).
export function isInBranchScope(ctx: AuthContext, branchId: string): boolean {
  return isSuperAdmin(ctx) || ctx.branchIds.includes(branchId);
}
