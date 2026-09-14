import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/AppError';
import { requireRole } from './requireRole';

function makeReq(auth?: Request['auth']): Request {
  return { auth } as unknown as Request;
}

describe('requireRole', () => {
  it('calls next() with no error when the caller has one of the allowed roles', () => {
    const middleware = requireRole('CENTER_ADMIN', 'SUPER_ADMIN');
    const req = makeReq({ userId: 'u1', role: 'SUPER_ADMIN', branchIds: [] });
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(AppError 403) when the caller has a role that is not allowed', () => {
    const middleware = requireRole('CENTER_ADMIN', 'SUPER_ADMIN');
    const req = makeReq({ userId: 'u1', role: 'TEACHER', branchIds: [] });
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.httpStatus).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('calls next(AppError 401) when req.auth is missing (requireAuth was not run first)', () => {
    const middleware = requireRole('SUPER_ADMIN');
    const req = makeReq(undefined);
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err.httpStatus).toBe(401);
  });
});
