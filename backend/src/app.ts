import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import type { AuthService } from './auth/authService';
import type { UsersService } from './users/usersService';
import type { BranchesService } from './branches/branchesService';
import type { SubjectsService } from './academic/subjectsService';
import type { GradeLevelsService } from './academic/gradeLevelsService';
import type { CoursesService } from './academic/coursesService';
import type { BatchesService } from './academic/batchesService';
import type { EnrollmentService } from './enrollment/enrollmentService';
import type { ClassSessionsService } from './attendance/classSessionsService';
import type { AttendanceService } from './attendance/attendanceService';
import type { SessionMaterializationService } from './attendance/sessionMaterializationService';
import type { DashboardService } from './reporting/dashboardService';
import type { EnrollmentReportService } from './reporting/enrollmentReportService';
import type { AttendanceReportService } from './reporting/attendanceReportService';
import type { AuditLogService } from './audit/auditLogService';
import type { StudentsService } from './students/studentsService';
import { isOriginAllowed } from './lib/corsAllowlist';
import { errorHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { createUsersRouter } from './routes/users';
import { createBranchesRouter } from './routes/branches';
import { createCoursesRouter, createGradeLevelsRouter, createSubjectsRouter } from './routes/academicStructure';
import { createBatchesRouter } from './routes/batches';
import { createEnrollmentsRouter } from './routes/enrollments';
import { createAttendanceRouter } from './routes/attendance';
import { createStudentsRouter } from './routes/students';
import { createInternalRouter } from './routes/internal';
import { createDashboardRouter } from './routes/dashboard';
import { createReportsRouter } from './routes/reports';
import { createAuditLogsRouter } from './routes/auditLogs';

export type AppDeps = {
  allowedOrigins: string[];
  checkDb: () => Promise<void>;
  authService: AuthService;
  usersService: UsersService;
  branchesService: BranchesService;
  subjectsService: SubjectsService;
  gradeLevelsService: GradeLevelsService;
  coursesService: CoursesService;
  batchesService: BatchesService;
  enrollmentService: EnrollmentService;
  classSessionsService: ClassSessionsService;
  attendanceService: AttendanceService;
  sessionMaterializationService: SessionMaterializationService;
  dashboardService: DashboardService;
  enrollmentReportService: EnrollmentReportService;
  attendanceReportService: AttendanceReportService;
  auditLogService: AuditLogService;
  studentsService: StudentsService;
  accessTokenSecret: string;
  internalJobSecret: string;
};

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.use(pinoHttp({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' }));
  // Security-headers hardening pass (M6, NFR-4/OWASP A05) — this is a pure JSON API with no
  // HTML views of its own, so helmet's default CSP is a defense-in-depth backstop rather than
  // the primary control; X-Frame-Options/X-Content-Type-Options are the headers that matter here.
  app.use(helmet({ frameguard: { action: 'deny' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, deps.allowedOrigins)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
    }),
  );
  app.use(express.json());

  app.use('/api/health', createHealthRouter(deps.checkDb));
  app.use('/api/auth', createAuthRouter(deps.authService, deps.accessTokenSecret));
  app.use('/api/users', createUsersRouter(deps.usersService, deps.accessTokenSecret));
  app.use('/api/branches', createBranchesRouter(deps.branchesService, deps.accessTokenSecret));
  app.use('/api/subjects', createSubjectsRouter(deps.subjectsService, deps.accessTokenSecret));
  app.use(
    '/api/grade-levels',
    createGradeLevelsRouter(deps.gradeLevelsService, deps.accessTokenSecret),
  );
  app.use('/api/courses', createCoursesRouter(deps.coursesService, deps.accessTokenSecret));
  app.use('/api/batches', createBatchesRouter(deps.batchesService, deps.classSessionsService, deps.accessTokenSecret));
  app.use(
    '/api/enrollments',
    createEnrollmentsRouter(deps.enrollmentService, deps.accessTokenSecret),
  );
  app.use('/api/sessions', createAttendanceRouter(deps.attendanceService, deps.accessTokenSecret));
  app.use(
    '/api/students',
    createStudentsRouter(deps.attendanceService, deps.studentsService, deps.accessTokenSecret),
  );
  app.use(
    '/api/internal',
    createInternalRouter(deps.sessionMaterializationService, deps.internalJobSecret),
  );
  app.use('/api/dashboard', createDashboardRouter(deps.dashboardService, deps.accessTokenSecret));
  app.use(
    '/api/reports',
    createReportsRouter(deps.enrollmentReportService, deps.attendanceReportService, deps.accessTokenSecret),
  );
  app.use('/api/audit-logs', createAuditLogsRouter(deps.auditLogService, deps.accessTokenSecret));

  app.use(errorHandler);


  return app;
}
