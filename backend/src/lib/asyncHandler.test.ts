import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { asyncHandler } from './asyncHandler';

describe('asyncHandler', () => {
  it('calls next() when the wrapped handler resolves without throwing', async () => {
    const handler = asyncHandler(async () => {});
    const next = vi.fn() as unknown as NextFunction;

    await handler({} as Request, {} as Response, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejection to next()', async () => {
    const error = new Error('boom');
    const handler = asyncHandler(async () => {
      throw error;
    });
    const next = vi.fn() as unknown as NextFunction;

    await handler({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
