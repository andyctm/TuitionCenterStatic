import type { Role, UserStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { isSuperAdmin } from '../lib/branchScope';
import type { AuditLogRepository, StudentProfileRepository, UserRepository } from '../repositories/types';
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

export type CreateStudentUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  branchId?: string;
};

export type UsersServiceDeps = {
  userRepo: UserRepository;
  auditLogRepo: AuditLogRepository;
  studentProfileRepo: StudentProfileRepository;
};

export function createUsersService(deps: UsersServiceDeps) {
  const { userRepo, auditLogRepo, studentProfileRepo } = deps;

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

    // admin-created student accounts skip self-registration's PENDING approval step, same as staff.
    async createStudentUser(input: CreateStudentUserInput): Promise<PublicUser> {
      const existing = await userRepo.findByEmail(input.email);
      if (existing) {
        throw new AppError('CONFLICT', 409, 'An account with this email already exists');
      }

      const user = await userRepo.create({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'STUDENT',
        status: 'ACTIVE',
        branchId: input.branchId ?? null,
      });
      await studentProfileRepo.create({ userId: user.id });

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
