import { AppError } from '../errors/AppError';

// Standard error response shape per docs/04-api-specification.md §1.1.
export function toErrorEnvelope(err: unknown) {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }

  return {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  };
}
