import type { Role, UserStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { isSuperAdmin } from '../lib/branchScope';
import type { AuditLogRepository, UserRepository } from '../repositories/types';
import type { AuthContext } from '../types/authContext';
import { hashPassword } from '../auth/password';
import { omitPasswordHash } from '../lib/publicUser';
import type { PublicUser } from '../auth/authService';

export type CreateStaffUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Exclude<Role, 'STUDENT' | 'PARENT'>;
  branchId: string;
};

export type UsersServiceDeps = {
  userRepo: UserRepository;
  auditLogRepo: AuditLogRepository;
};

export function createUsersService(deps: UsersServiceDeps) {
  const { userRepo, auditLogRepo } = deps;

  return {
    async list(ctx: AuthContext): Promise<PublicUser[]> {
      const users = await userRepo.findAll(isSuperAdmin(ctx) ? undefined : { branchIds: ctx.branchIds });
      return users.map(omitPasswordHash);
    },

    async createStaffUser(input: CreateStaffUserInput): Promise<PublicUser> {
      const existing = await userRepo.findByEmail(input.email);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'An account with this email already exists');
      }

      const user = await userRepo.create({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        status: 'ACTIVE',
        branchId: input.branchId,
      });

      return omitPasswordHash(user);
    },

    // audit-log capability (FR-AUD-1): every user status change is a logged, actor-attributed event.
    async updateStatus(ctx: AuthContext, userId: string, status: UserStatus): Promise<PublicUser> {
      const existing = await userRepo.findById(userId);
      if (!existing) {
        throw new AppError('NOT_FOUND', 404, 'User not found');
      }

      const updated = await userRepo.updateStatus(userId, status);
      await auditLogRepo.create({
        actorUserId: ctx.userId,
        entityType: 'User',
        entityId: userId,
        action: 'STATUS_CHANGE',
        before: { status: existing.status },
        after: { status: updated.status },
      });
      return omitPasswordHash(updated);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
