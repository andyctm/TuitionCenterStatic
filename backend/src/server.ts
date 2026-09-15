import 'dotenv/config';
import { createApp } from './app';
import { createAuthService } from './auth/authService';
import { parseEnv } from './env';
import { prisma } from './lib/prisma';
import { createPrismaPasswordResetTokenRepository } from './repositories/prismaPasswordResetTokenRepository';
import { createPrismaRefreshTokenRepository } from './repositories/prismaRefreshTokenRepository';
import { createPrismaUserRepository } from './repositories/prismaUserRepository';
import { createPrismaBranchRepository } from './repositories/prismaBranchRepository';
import { createPrismaSubjectRepository } from './repositories/prismaSubjectRepository';
import { createPrismaGradeLevelRepository } from './repositories/prismaGradeLevelRepository';
import { createPrismaCourseRepository } from './repositories/prismaCourseRepository';
import { createPrismaBatchRepository } from './repositories/prismaBatchRepository';
import { createPrismaClassScheduleRepository } from './repositories/prismaClassScheduleRepository';
import { createPrismaStudentProfileRepository } from './repositories/prismaStudentProfileRepository';
import { createPrismaParentStudentRepository } from './repositories/prismaParentStudentRepository';
import { createPrismaEnrollmentRepository } from './repositories/prismaEnrollmentRepository';
import { createPrismaClassSessionRepository } from './repositories/prismaClassSessionRepository';
import { createPrismaAttendanceRepository } from './repositories/prismaAttendanceRepository';
import { createPrismaAuditLogRepository } from './repositories/prismaAuditLogRepository';
import { createUsersService } from './users/usersService';
import { createBranchesService } from './branches/branchesService';
import { createSubjectsService } from './academic/subjectsService';
import { createGradeLevelsService } from './academic/gradeLevelsService';
import { createCoursesService } from './academic/coursesService';
import { createBatchesService } from './academic/batchesService';
import { createEnrollmentService } from './enrollment/enrollmentService';
import { createClassSessionsService } from './attendance/classSessionsService';
import { createAttendanceService } from './attendance/attendanceService';
import { createSessionMaterializationService } from './attendance/sessionMaterializationService';
import { createDashboardService } from './reporting/dashboardService';
import { createEnrollmentReportService } from './reporting/enrollmentReportService';
import { createAttendanceReportService } from './reporting/attendanceReportService';
import { createAuditLogService } from './audit/auditLogService';
import { createStudentsService } from './students/studentsService';

const env = parseEnv(process.env);

const userRepo = createPrismaUserRepository(prisma);
const refreshTokenRepo = createPrismaRefreshTokenRepository(prisma);
const passwordResetTokenRepo = createPrismaPasswordResetTokenRepository(prisma);
const branchRepo = createPrismaBranchRepository(prisma);
const subjectRepo = createPrismaSubjectRepository(prisma);
const gradeLevelRepo = createPrismaGradeLevelRepository(prisma);
const courseRepo = createPrismaCourseRepository(prisma);
const batchRepo = createPrismaBatchRepository(prisma);
const classScheduleRepo = createPrismaClassScheduleRepository(prisma);
const studentProfileRepo = createPrismaStudentProfileRepository(prisma);
const parentStudentRepo = createPrismaParentStudentRepository(prisma);
const enrollmentRepo = createPrismaEnrollmentRepository(prisma);
const classSessionRepo = createPrismaClassSessionRepository(prisma);
const attendanceRepo = createPrismaAttendanceRepository(prisma);
const auditLogRepo = createPrismaAuditLogRepository(prisma);

const authService = createAuthService({
  userRepo,
  refreshTokenRepo,
  passwordResetTokenRepo,
  studentProfileRepo,
  accessTokenSecret: env.jwtAccessSecret,
  sendPasswordResetEmail: async (email, token) => {
    // TODO(M1 follow-up): wire a real transactional email provider using env.emailApiKey.
    console.log(`[password-reset] would email ${email} a reset token: ${token}`);
  },
});
const usersService = createUsersService({ userRepo, auditLogRepo, studentProfileRepo });
const branchesService = createBranchesService({ branchRepo });
const subjectsService = createSubjectsService({ subjectRepo });
const gradeLevelsService = createGradeLevelsService({ gradeLevelRepo });
const coursesService = createCoursesService({ courseRepo, subjectRepo, gradeLevelRepo });
const batchesService = createBatchesService({ batchRepo, courseRepo, branchRepo, classScheduleRepo });
const enrollmentService = createEnrollmentService({
  enrollmentRepo,
  batchRepo,
  studentProfileRepo,
  parentStudentRepo,
  userRepo,
  courseRepo,
  gradeLevelRepo,
});
const classSessionsService = createClassSessionsService({ classSessionRepo, batchRepo });
const attendanceService = createAttendanceService({
  attendanceRepo,
  userRepo,
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
  userRepo,
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
const studentsService = createStudentsService({ userRepo, studentProfileRepo });

const app = createApp({
  allowedOrigins: env.allowedOrigins,
  checkDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
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
  studentsService,
  accessTokenSecret: env.jwtAccessSecret,
  internalJobSecret: env.internalJobSecret,
});

// No external cron was ever configured to hit POST /api/internal/jobs/materialize-sessions,
// so ClassSession rows never got created past the initial manual seed. Self-heal in-process
// instead of depending on an external scheduler: run on boot, then on a fixed interval.
const SESSION_MATERIALIZATION_INTERVAL_MS = 6 * 60 * 60 * 1000;

function runSessionMaterialization(): void {
  sessionMaterializationService
    .run()
    .then((result) => {
      if (result.created > 0) {
        console.log(`[session-materialization] created ${result.created} session(s)`);
      }
    })
    .catch((err) => {
      console.error('[session-materialization] failed', err);
    });
}

app.listen(env.port, () => {
  console.log(`TCMS API listening on port ${env.port}`);
  runSessionMaterialization();
  setInterval(runSessionMaterialization, SESSION_MATERIALIZATION_INTERVAL_MS);
});
