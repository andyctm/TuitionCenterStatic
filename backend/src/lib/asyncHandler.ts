import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Forwards a rejected promise to Express's error-handling middleware — avoids a try/catch in
// every async route handler.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    return fn(req, res, next).catch(next);
  };
}
