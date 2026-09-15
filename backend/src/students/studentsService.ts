import { isSuperAdmin } from '../lib/branchScope';
import type { StudentProfileRepository, UserRepository } from '../repositories/types';
import type { AuthContext } from '../types/authContext';

export type StudentsServiceDeps = {
  userRepo: UserRepository;
  studentProfileRepo: StudentProfileRepository;
};

// Backs the Enrollment page's student search. GET /api/users (which has names) is
// Super Admin/Center Admin only, but Accountants can also create enrollments — this is a
// narrower, read-only view (name/email/branch, no other user fields) safe to expose more broadly.
export type StudentDirectoryItem = {
  studentProfileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  branchId: string | null;
};

export function createStudentsService(deps: StudentsServiceDeps) {
  const { userRepo, studentProfileRepo } = deps;

  return {
    async list(ctx: AuthContext): Promise<StudentDirectoryItem[]> {
      const users = await userRepo.findAll(isSuperAdmin(ctx) ? undefined : { branchIds: ctx.branchIds });
      const students = users.filter((u) => u.role === 'STUDENT');
      const profiles = await Promise.all(students.map((u) => studentProfileRepo.findByUserId(u.id)));

      const items: StudentDirectoryItem[] = [];
      students.forEach((user, i) => {
        const profile = profiles[i];
        if (!profile) return;
        items.push({
          studentProfileId: profile.id,
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          branchId: user.branchId,
        });
      });
      return items;
    },
  };
}

export type StudentsService = ReturnType<typeof createStudentsService>;
