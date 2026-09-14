import cors from 'cors';
import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { isOriginAllowed } from './lib/corsAllowlist';
import { errorHandler } from './middleware/errorHandler';
import { createHealthRouter } from './routes/health';

export type AppDeps = {
  allowedOrigins: string[];
  checkDb: () => Promise<void>;
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

  app.use(errorHandler);

  return app;
}
