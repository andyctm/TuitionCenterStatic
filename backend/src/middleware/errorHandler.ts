import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { toErrorEnvelope } from '../lib/errorEnvelope';

// Central Express error handler: any AppError thrown in a route/service lands here with the
// right HTTP status; anything else is logged and reported generically (never leaks internals).
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof AppError ? err.httpStatus : 500;

  if (!(err instanceof AppError)) {
    req.log?.error({ err }, 'unhandled error');
  }

  res.status(status).json(toErrorEnvelope(err));
}
