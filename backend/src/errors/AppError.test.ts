import { describe, expect, it } from 'vitest';
import { AppError } from './AppError';

describe('AppError', () => {
  it('carries the code, http status and message', () => {
    const err = new AppError('VALIDATION_ERROR', 400, 'amount must be positive');

    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.httpStatus).toBe(400);
    expect(err.message).toBe('amount must be positive');
    expect(err.details).toBeUndefined();
  });

  it('carries optional field-level details', () => {
    const details = [{ field: 'amount', issue: 'must be positive' }];
    const err = new AppError('VALIDATION_ERROR', 400, 'invalid request', details);

    expect(err.details).toEqual(details);
  });

  it('is an instance of Error so it works with throw/catch and Express error middleware', () => {
    const err = new AppError('NOT_FOUND', 404, 'not found');

    expect(err).toBeInstanceOf(Error);
  });
});
