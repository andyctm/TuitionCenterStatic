import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { parseBody } from './validate';

const schema = z.object({ email: z.string().email(), age: z.number().min(0) });

describe('parseBody', () => {
  it('returns the parsed data for a valid body', () => {
    const result = parseBody(schema, { email: 'a@b.com', age: 5 });

    expect(result).toEqual({ email: 'a@b.com', age: 5 });
  });

  it('throws a VALIDATION_ERROR AppError with field-level details for an invalid body', () => {
    try {
      parseBody(schema, { email: 'not-an-email', age: -1 });
      throw new Error('expected parseBody to throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 400 });
      const details = (err as { details?: { field: string }[] }).details;
      expect(details?.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'age']));
    }
  });
});
