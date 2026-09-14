import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  AccessTokenExpiredError,
  AccessTokenInvalidError,
  verifyAccessToken,
} from '../auth/accessToken';
import { AppError } from '../errors/AppError';

const BEARER_PREFIX = 'Bearer ';

export function requireAuth(accessTokenSecret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('Authorization');
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      next(new AppError('UNAUTHENTICATED', 401, 'Missing or malformed Authorization header'));
      return;
    }

    const token = header.slice(BEARER_PREFIX.length);

    try {
      const payload = verifyAccessToken(token, accessTokenSecret);
      req.auth = { userId: payload.sub, role: payload.role, branchIds: payload.branchIds };
      next();
    } catch (err) {
      if (err instanceof AccessTokenExpiredError || err instanceof AccessTokenInvalidError) {
        next(new AppError('UNAUTHENTICATED', 401, err.message));
        return;
      }
      next(err);
    }
  };
}
