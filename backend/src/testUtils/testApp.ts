import { createApp, type AppDeps } from '../app';
import { createAuthService } from '../auth/authService';
import { createUsersService } from '../users/usersService';
import { createBranchesService } from '../branches/branchesService';
import { createSubjectsService } from '../academic/subjectsService';
import { createGradeLevelsService } from '../academic/gradeLevelsService';
import { createCoursesService } from '../academic/coursesService';
import { createBatchesService } from '../academic/batchesService';
import { createEnrollmentService } from '../enrollment/enrollmentService';
import {
  createFakeBatchRepository,
  createFakeBranchRepository,
  createFakeClassScheduleRepository,
  createFakeCourseRepository,
  createFakeEnrollmentRepository,
  createFakeGradeLevelRepository,
  createFakeParentStudentRepository,
  createFakePasswordResetTokenRepository,
  createFakeRefreshTokenRepository,
  createFakeStudentProfileRepository,
  createFakeSubjectRepository,
  createFakeUserRepository,
} from './fakeRepositories';
import type {
  BatchRecord,
  BranchRecord,
  CourseRecord,
  EnrollmentRecord,
  GradeLevelRecord,
  StudentProfileRecord,
  SubjectRecord,
  UserRecord,
} from '../repositories/types';

export const TEST_ACCESS_TOKEN_SECRET = 'test-access-secret';
export const TEST_ALLOWED_ORIGINS = ['https://acme.github.io'];

export function createTestApp(
  options: {
    seedUsers?: UserRecord[];
    seedBranches?: BranchRecord[];
    seedSubjects?: SubjectRecord[];
    seedGradeLevels?: GradeLevelRecord[];
    seedCourses?: CourseRecord[];
    seedBatches?: BatchRecord[];
    seedStudentProfiles?: StudentProfileRecord[];
    seedEnrollments?: EnrollmentRecord[];
    seedParentLinks?: { parentUserId: string; studentProfileId: string }[];
    checkDb?: AppDeps['checkDb'];
  } = {},
) {
  const userRepo = createFakeUserRepository(options.seedUsers ?? []);
  const refreshTokenRepo = createFakeRefreshTokenRepository();
  const passwordResetTokenRepo = createFakePasswordResetTokenRepository();
  const sentEmails: { email: string; token: string }[] = [];

  const branchRepo = createFakeBranchRepository(options.seedBranches ?? []);
  const subjectRepo = createFakeSubjectRepository(options.seedSubjects ?? []);
  const gradeLevelRepo = createFakeGradeLevelRepository(options.seedGradeLevels ?? []);
  const courseRepo = createFakeCourseRepository(options.seedCourses ?? []);
  const batchRepo = createFakeBatchRepository(options.seedBatches ?? []);
  const classScheduleRepo = createFakeClassScheduleRepository([], batchRepo);
  const studentProfileRepo = createFakeStudentProfileRepository(options.seedStudentProfiles ?? []);
  const parentStudentRepo = createFakeParentStudentRepository(options.seedParentLinks ?? []);
  const enrollmentRepo = createFakeEnrollmentRepository(options.seedEnrollments ?? [], batchRepo);

  const authService = createAuthService({
    userRepo,
    refreshTokenRepo,
    passwordResetTokenRepo,
    studentProfileRepo,
    accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
    sendPasswordResetEmail: async (email, token) => {
      sentEmails.push({ email, token });
    },
  });
  const usersService = createUsersService({ userRepo });
  const branchesService = createBranchesService({ branchRepo });
  const subjectsService = createSubjectsService({ subjectRepo });
  const gradeLevelsService = createGradeLevelsService({ gradeLevelRepo });
  const coursesService = createCoursesService({ courseRepo, subjectRepo, gradeLevelRepo });
  const batchesService = createBatchesService({
    batchRepo,
    courseRepo,
    branchRepo,
    classScheduleRepo,
  });
  const enrollmentService = createEnrollmentService({
    enrollmentRepo,
    batchRepo,
    studentProfileRepo,
    parentStudentRepo,
  });

  const app = createApp({
    allowedOrigins: TEST_ALLOWED_ORIGINS,
    checkDb: options.checkDb ?? (async () => undefined),
    authService,
    usersService,
    branchesService,
    subjectsService,
    gradeLevelsService,
    coursesService,
    batchesService,
    enrollmentService,
    accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
  });

  return {
    app,
    userRepo,
    refreshTokenRepo,
    passwordResetTokenRepo,
    branchRepo,
    subjectRepo,
    gradeLevelRepo,
    courseRepo,
    batchRepo,
    classScheduleRepo,
    studentProfileRepo,
    parentStudentRepo,
    enrollmentRepo,
    sentEmails,
    authService,
    usersService,
    branchesService,
    subjectsService,
    gradeLevelsService,
    coursesService,
    batchesService,
    enrollmentService,
  };
}

