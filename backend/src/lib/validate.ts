import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      issue: issue.message,
    }));
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body', details);
  }
  return result.data;
}
