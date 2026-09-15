import { describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password';
import { createFakeStudentProfileRepository, createFakeUserRepository } from '../testUtils/fakeRepositories';
import type { AuthContext } from '../types/authContext';
import { createStudentsService } from './studentsService';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { userId: 'admin_1', role: 'CENTER_ADMIN', branchIds: ['branch_1'], ...overrides };
}

async function makeService() {
  const passwordHash = await hashPassword('x');
  const colomboStudent = {
    id: 'user_stu_1',
    email: 'stu1@example.com',
    passwordHash,
    firstName: 'Nimasha',
    lastName: 'Ranasinghe',
    role: 'STUDENT' as const,
    status: 'ACTIVE' as const,
    branchId: 'branch_1',
  };
  const kandyStudent = {
    id: 'user_stu_2',
    email: 'stu2@example.com',
    passwordHash,
    firstName: 'Kasun',
    lastName: 'Silva',
    role: 'STUDENT' as const,
    status: 'ACTIVE' as const,
    branchId: 'branch_2',
  };
  const teacher = {
    id: 'user_teacher_1',
    email: 'teacher@example.com',
    passwordHash,
    firstName: 'Terry',
    lastName: 'Teacher',
    role: 'TEACHER' as const,
    status: 'ACTIVE' as const,
    branchId: 'branch_1',
  };
  const userRepo = createFakeUserRepository([colomboStudent, kandyStudent, teacher]);
  const studentProfileRepo = createFakeStudentProfileRepository([
    { id: 'stu_profile_1', userId: 'user_stu_1' },
    { id: 'stu_profile_2', userId: 'user_stu_2' },
  ]);
  return { service: createStudentsService({ userRepo, studentProfileRepo }), userRepo, studentProfileRepo };
}

describe('studentsService.list', () => {
  it('scopes results to the caller assigned branch for a Center Admin', async () => {
    const { service } = await makeService();

    const students = await service.list(ctx({ role: 'CENTER_ADMIN', branchIds: ['branch_1'] }));

    expect(students).toEqual([
      {
        studentProfileId: 'stu_profile_1',
        userId: 'user_stu_1',
        firstName: 'Nimasha',
        lastName: 'Ranasinghe',
        email: 'stu1@example.com',
        branchId: 'branch_1',
      },
    ]);
  });

  it('returns every student for a Super Admin, regardless of branch', async () => {
    const { service } = await makeService();

    const students = await service.list(ctx({ role: 'SUPER_ADMIN', branchIds: [] }));

    expect(students.map((s) => s.studentProfileId).sort()).toEqual(['stu_profile_1', 'stu_profile_2']);
  });

  it('excludes non-Student users', async () => {
    const { service } = await makeService();

    const students = await service.list(ctx({ role: 'SUPER_ADMIN', branchIds: [] }));

    expect(students.find((s) => s.userId === 'user_teacher_1')).toBeUndefined();
  });
});
