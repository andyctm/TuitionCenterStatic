import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../errors/AppError';

// Must run after requireAuth (needs req.auth already populated).
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AppError('UNAUTHENTICATED', 401, 'Missing or malformed Authorization header'));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}
