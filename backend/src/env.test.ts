import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@host/db',
  ALLOWED_ORIGINS: 'https://acme.github.io,http://localhost:5500',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  INTERNAL_JOB_SECRET: 'internal-job-secret',
  PORT: '4000',
};

describe('parseEnv', () => {
  it('parses valid env vars, splitting ALLOWED_ORIGINS into an array', () => {
    const env = parseEnv(validEnv);

    expect(env.allowedOrigins).toEqual(['https://acme.github.io', 'http://localhost:5500']);
    expect(env.databaseUrl).toBe(validEnv.DATABASE_URL);
    expect(env.port).toBe(4000);
  });

  it('defaults PORT to 4000 when not provided', () => {
    const { PORT, ...rest } = validEnv;
    const env = parseEnv(rest);

    expect(env.port).toBe(4000);
  });

  it('throws a descriptive error when a required var is missing', () => {
    const { DATABASE_URL, ...rest } = validEnv;

    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
