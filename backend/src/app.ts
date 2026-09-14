import cors from 'cors';
import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import type { AuthService } from './auth/authService';
import type { UsersService } from './users/usersService';
import type { BranchesService } from './branches/branchesService';
import type { SubjectsService } from './academic/subjectsService';
import type { GradeLevelsService } from './academic/gradeLevelsService';
import type { CoursesService } from './academic/coursesService';
import type { BatchesService } from './academic/batchesService';
import { isOriginAllowed } from './lib/corsAllowlist';
import { errorHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { createUsersRouter } from './routes/users';
import { createBranchesRouter } from './routes/branches';
import { createCoursesRouter, createGradeLevelsRouter, createSubjectsRouter } from './routes/academicStructure';
import { createBatchesRouter } from './routes/batches';

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
  accessTokenSecret: string;
};

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.use(pinoHttp({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' }));
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
  app.use('/api/batches', createBatchesRouter(deps.batchesService, deps.accessTokenSecret));

  app.use(errorHandler);


  return app;
}
