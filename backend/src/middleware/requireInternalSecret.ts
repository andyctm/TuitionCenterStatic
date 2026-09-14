import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError';

const HEADER_NAME = 'x-internal-job-secret';

// Guards internal/system endpoints (e.g. the session-materialization cron job) with a shared
// secret header instead of a user JWT — there is no human user behind these calls.
export function requireInternalSecret(secret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const provided = req.header(HEADER_NAME);
    if (!provided || provided !== secret) {
      next(new AppError('UNAUTHENTICATED', 401, 'Missing or invalid internal job secret'));
      return;
    }
    next();
  };
}
