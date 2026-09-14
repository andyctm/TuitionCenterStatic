import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/AppError';
import { toErrorEnvelope } from './errorEnvelope';

describe('toErrorEnvelope', () => {
  it('formats an AppError into the standard error envelope', () => {
    const err = new AppError('VALIDATION_ERROR', 400, 'amount must be positive', [
      { field: 'amount', issue: 'must be positive' },
    ]);

    expect(toErrorEnvelope(err)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'amount must be positive',
        details: [{ field: 'amount', issue: 'must be positive' }],
      },
    });
  });

  it('omits details when the AppError has none', () => {
    const err = new AppError('NOT_FOUND', 404, 'not found');

    expect(toErrorEnvelope(err)).toEqual({
      error: { code: 'NOT_FOUND', message: 'not found' },
    });
  });

  it('maps any non-AppError into a generic INTERNAL_ERROR without leaking internals', () => {
    const err = new Error('a raw db connection string leaked here');

    expect(toErrorEnvelope(err)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });
});
