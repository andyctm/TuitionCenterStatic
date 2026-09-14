import type { Role, UserStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import type { UserRepository } from '../repositories/types';
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
};

export function createUsersService(deps: UsersServiceDeps) {
  const { userRepo } = deps;

  return {
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

    async updateStatus(userId: string, status: UserStatus): Promise<PublicUser> {
      const existing = await userRepo.findById(userId);
      if (!existing) {
        throw new AppError('NOT_FOUND', 404, 'User not found');
      }

      const updated = await userRepo.updateStatus(userId, status);
      return omitPasswordHash(updated);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
