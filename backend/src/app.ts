import cors from 'cors';
import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import type { AuthService } from './auth/authService';
import type { UsersService } from './users/usersService';
import { isOriginAllowed } from './lib/corsAllowlist';
import { errorHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { createUsersRouter } from './routes/users';

export type AppDeps = {
  allowedOrigins: string[];
  checkDb: () => Promise<void>;
  authService: AuthService;
  usersService: UsersService;
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

  app.use(errorHandler);

  return app;
}
