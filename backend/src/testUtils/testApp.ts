import { createApp, type AppDeps } from '../app';
import { createAuthService } from '../auth/authService';
import { createUsersService } from '../users/usersService';
import { createBranchesService } from '../branches/branchesService';
import { createSubjectsService } from '../academic/subjectsService';
import { createGradeLevelsService } from '../academic/gradeLevelsService';
import { createCoursesService } from '../academic/coursesService';
import { createBatchesService } from '../academic/batchesService';
import { createEnrollmentService } from '../enrollment/enrollmentService';
import { createClassSessionsService } from '../attendance/classSessionsService';
import { createAttendanceService } from '../attendance/attendanceService';
import { createSessionMaterializationService } from '../attendance/sessionMaterializationService';
import { createDashboardService } from '../reporting/dashboardService';
import { createEnrollmentReportService } from '../reporting/enrollmentReportService';
import { createAttendanceReportService } from '../reporting/attendanceReportService';
import { createAuditLogService } from '../audit/auditLogService';
import {
  createFakeAttendanceRepository,
  createFakeAuditLogRepository,
  createFakeBatchRepository,
  createFakeBranchRepository,
  createFakeClassScheduleRepository,
  createFakeClassSessionRepository,
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
  AttendanceRecord,
  AuditLogRecord,
  BatchRecord,
  BranchRecord,
  ClassSessionRecord,
  CourseRecord,
  EnrollmentRecord,
  GradeLevelRecord,
  StudentProfileRecord,
  SubjectRecord,
  UserRecord,
} from '../repositories/types';

export const TEST_ACCESS_TOKEN_SECRET = 'test-access-secret';
export const TEST_INTERNAL_JOB_SECRET = 'test-internal-job-secret';
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
    seedClassSessions?: ClassSessionRecord[];
    seedAttendances?: AttendanceRecord[];
    seedAuditLogs?: AuditLogRecord[];
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
  const classSessionRepo = createFakeClassSessionRepository(options.seedClassSessions ?? []);
  const attendanceRepo = createFakeAttendanceRepository(
    options.seedAttendances ?? [],
    classSessionRepo,
  );
  const auditLogRepo = createFakeAuditLogRepository(options.seedAuditLogs ?? []);

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
  const usersService = createUsersService({ userRepo, auditLogRepo });
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
  const classSessionsService = createClassSessionsService({ classSessionRepo, batchRepo });
  const attendanceService = createAttendanceService({
    attendanceRepo,
    classSessionRepo,
    batchRepo,
    studentProfileRepo,
    parentStudentRepo,
    enrollmentRepo,
    auditLogRepo,
  });
  const sessionMaterializationService = createSessionMaterializationService({
    batchRepo,
    classScheduleRepo,
    classSessionRepo,
  });
  const dashboardService = createDashboardService({
    batchRepo,
    courseRepo,
    enrollmentRepo,
    classSessionRepo,
    attendanceRepo,
    studentProfileRepo,
    parentStudentRepo,
  });
  const enrollmentReportService = createEnrollmentReportService({
    enrollmentRepo,
    batchRepo,
    courseRepo,
    branchRepo,
  });
  const attendanceReportService = createAttendanceReportService({
    batchRepo,
    courseRepo,
    branchRepo,
    classSessionRepo,
    attendanceRepo,
  });
  const auditLogService = createAuditLogService({
    auditLogRepo,
    userRepo,
    attendanceRepo,
    classSessionRepo,
    batchRepo,
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
    classSessionsService,
    attendanceService,
    sessionMaterializationService,
    dashboardService,
    enrollmentReportService,
    attendanceReportService,
    auditLogService,
    accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
    internalJobSecret: TEST_INTERNAL_JOB_SECRET,
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
    classSessionRepo,
    attendanceRepo,
    auditLogRepo,
    sentEmails,
    authService,
    usersService,
    branchesService,
    subjectsService,
    gradeLevelsService,
    coursesService,
    batchesService,
    enrollmentService,
    classSessionsService,
    attendanceService,
    sessionMaterializationService,
    dashboardService,
    enrollmentReportService,
    attendanceReportService,
    auditLogService,
  };
}

