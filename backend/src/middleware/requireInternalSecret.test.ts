import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/AppError';
import { requireInternalSecret } from './requireInternalSecret';

const secret = 'test-internal-secret';

function makeReq(headerValue?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'x-internal-job-secret' ? headerValue : undefined),
  } as unknown as Request;
}

describe('requireInternalSecret', () => {
  const middleware = requireInternalSecret(secret);

  it('calls next() with no error when the header matches the secret', () => {
    const req = makeReq(secret);
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(AppError 401) when the header is missing', () => {
    const req = makeReq(undefined);
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.httpStatus).toBe(401);
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('calls next(AppError 401) when the header does not match', () => {
    const req = makeReq('wrong-secret');
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err.httpStatus).toBe(401);
  });
});
