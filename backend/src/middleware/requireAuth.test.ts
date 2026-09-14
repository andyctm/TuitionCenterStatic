import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../auth/accessToken';
import { AppError } from '../errors/AppError';
import { requireAuth } from './requireAuth';

const secret = 'test-secret';

function makeReq(authorizationHeader?: string): Request {
  return {
    header: (name: string) => (name === 'Authorization' ? authorizationHeader : undefined),
  } as unknown as Request;
}

describe('requireAuth', () => {
  const middleware = requireAuth(secret);

  it('attaches req.auth and calls next() with no error for a valid bearer token', () => {
    const token = signAccessToken({ sub: 'user_1', role: 'TEACHER', branchIds: ['b1'] }, secret);
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    expect(req.auth).toEqual({ userId: 'user_1', role: 'TEACHER', branchIds: ['b1'] });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(AppError 401) when the Authorization header is missing', () => {
    const req = makeReq(undefined);
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.httpStatus).toBe(401);
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('calls next(AppError 401) for a malformed header (missing "Bearer " prefix)', () => {
    const req = makeReq('not-a-bearer-token');
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err.httpStatus).toBe(401);
  });

  it('calls next(AppError 401) for an invalid/expired token', () => {
    const req = makeReq('Bearer not-a-real-jwt');
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err.httpStatus).toBe(401);
    expect(err.code).toBe('UNAUTHENTICATED');
  });
});
