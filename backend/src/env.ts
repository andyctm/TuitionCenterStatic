import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  INTERNAL_JOB_SECRET: z.string().min(1, 'INTERNAL_JOB_SECRET is required'),
  EMAIL_API_KEY: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.string().default('development'),
});

export type Env = {
  databaseUrl: string;
  allowedOrigins: string[];
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  internalJobSecret: string;
  emailApiKey: string | undefined;
  port: number;
  nodeEnv: string;
};

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.parse(raw);

  return {
    databaseUrl: parsed.DATABASE_URL,
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
    internalJobSecret: parsed.INTERNAL_JOB_SECRET,
    emailApiKey: parsed.EMAIL_API_KEY,
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
  };
}
