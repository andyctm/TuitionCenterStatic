import type { Request } from 'express';
import { AppError } from '../errors/AppError';
import type { AuthContext } from '../types/authContext';

// requireAuth always populates req.auth before a handler runs; this just gives route
// handlers a typed, non-optional accessor instead of a bare non-null assertion.
export function getAuthContext(req: Request): AuthContext {
  if (!req.auth) {
    throw new AppError('UNAUTHENTICATED', 401, 'Missing or malformed Authorization header');
  }
  return req.auth;
}
