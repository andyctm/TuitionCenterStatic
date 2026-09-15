import { describe, expect, it } from 'vitest';
import { createFakeAuditLogRepository, createFakeUserRepository } from '../testUtils/fakeRepositories';
import { hashPassword } from '../auth/password';
import { createUsersService } from './usersService';
import type { AuthContext } from '../types/authContext';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'admin_1', role: 'CENTER_ADMIN', branchIds: ['branch_1'], ...overrides };
}

async function makeService(seed: Parameters<typeof createFakeUserRepository>[0] = []) {
  const userRepo = createFakeUserRepository(seed);
  const auditLogRepo = createFakeAuditLogRepository();
  return { service: createUsersService({ userRepo, auditLogRepo }), userRepo, auditLogRepo };
}

describe('usersService.list', () => {
  it('scopes results to the caller assigned branch for a Center Admin', async () => {
    const colomboUser = { id: 'u1', email: 'a@example.com', passwordHash: await hashPassword('x'), firstName: 'A', lastName: 'B', role: 'TEACHER' as const, status: 'ACTIVE' as const, branchId: 'branch_1' };
    const kandyUser = { id: 'u2', email: 'b@example.com', passwordHash: await hashPassword('x'), firstName: 'C', lastName: 'D', role: 'TEACHER' as const, status: 'ACTIVE' as const, branchId: 'branch_2' };
    const { service } = await makeService([colomboUser, kandyUser]);

    const users = await service.list(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_1'] }));

    expect(users.map((u) => u.id)).toEqual(['u1']);
  });

  it('returns every user for a Super Admin, regardless of branch', async () => {
    const colomboUser = { id: 'u1', email: 'a@example.com', passwordHash: await hashPassword('x'), firstName: 'A', lastName: 'B', role: 'TEACHER' as const, status: 'ACTIVE' as const, branchId: 'branch_1' };
    const kandyUser = { id: 'u2', email: 'b@example.com', passwordHash: await hashPassword('x'), firstName: 'C', lastName: 'D', role: 'TEACHER' as const, status: 'ACTIVE' as const, branchId: 'branch_2' };
    const { service } = await makeService([colomboUser, kandyUser]);

    const users = await service.list(ctx({ role: 'SUPER_ADMIN', branchIds: [] }));

    expect(users.map((u) => u.id).sort()).toEqual(['u1', 'u2']);
  });

  it('never includes passwordHash', async () => {
    const user = { id: 'u1', email: 'a@example.com', passwordHash: await hashPassword('x'), firstName: 'A', lastName: 'B', role: 'TEACHER' as const, status: 'ACTIVE' as const, branchId: 'branch_1' };
    const { service } = await makeService([user]);

    const users = await service.list(ctx({ role: 'SUPER_ADMIN', branchIds: [] }));

    expect(users[0]).not.toHaveProperty('passwordHash');
  });
});

describe('usersService.createStaffUser', () => {
  it('creates an ACTIVE staff account (admin-created accounts skip the PENDING approval step)', async () => {
    const { service } = await makeService();

    const user = await service.createStaffUser({
      email: 'teacher@example.com',
      password: 'a-strong-password',
      firstName: 'Terry',
      lastName: 'Teacher',
      role: 'TEACHER',
      branchId: 'branch_1',
    });

    expect(user.status).toBe('ACTIVE');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with 409 CONFLICT', async () => {
    const existing = {
      id: 'u1',
      email: 'dup@example.com',
      passwordHash: await hashPassword('x'),
      firstName: 'A',
      lastName: 'B',
      role: 'TEACHER' as const,
      status: 'ACTIVE' as const,
      branchId: null,
    };
    const { service } = await makeService([existing]);

    await expect(
      service.createStaffUser({
        email: 'dup@example.com',
        password: 'whatever123',
        firstName: 'X',
        lastName: 'Y',
        role: 'ACCOUNTANT',
        branchId: 'branch_1',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });
});

describe('usersService.updateStatus', () => {
  it('approves a PENDING self-registration to ACTIVE', async () => {
    const pendingUser = {
      id: 'u2',
      email: 'pending@example.com',
      passwordHash: await hashPassword('x'),
      firstName: 'P',
      lastName: 'Q',
      role: 'STUDENT' as const,
      status: 'PENDING' as const,
      branchId: null,
    };
    const { service } = await makeService([pendingUser]);

    const updated = await service.updateStatus(ctx(), 'u2', 'ACTIVE');

    expect(updated.status).toBe('ACTIVE');
  });

  it('throws NOT_FOUND for an unknown user id', async () => {
    const { service } = await makeService();

    await expect(service.updateStatus(ctx(), 'nope', 'ACTIVE')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('writes an AuditLog entry capturing the actor and before/after status', async () => {
    const pendingUser = {
      id: 'u2',
      email: 'pending@example.com',
      passwordHash: await hashPassword('x'),
      firstName: 'P',
      lastName: 'Q',
      role: 'STUDENT' as const,
      status: 'PENDING' as const,
      branchId: null,
    };
    const { service, auditLogRepo } = await makeService([pendingUser]);

    await service.updateStatus(ctx({ userId: 'admin_9' }), 'u2', 'ACTIVE');

    const logs = await auditLogRepo.findAll({});
    expect(logs).toEqual([
      expect.objectContaining({
        actorUserId: 'admin_9',
        entityType: 'User',
        entityId: 'u2',
        action: 'STATUS_CHANGE',
        before: { status: 'PENDING' },
        after: { status: 'ACTIVE' },
      }),
    ]);
  });
});
