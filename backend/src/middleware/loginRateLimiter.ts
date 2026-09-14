import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';
import { toErrorEnvelope } from '../lib/errorEnvelope';
import { AppError } from '../errors/AppError';

const WINDOW_MS = 15 * 60 * 1000; // auth capability: 15 minute lockout window.
const MAX_ATTEMPTS = 5; // auth capability: 5 consecutive failures per (email, IP).

// A factory (not a shared singleton) so each Express app/test gets its own isolated counter store.
export function createLoginRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
      return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
    },
    handler: (_req, res) => {
      res
        .status(429)
        .json(
          toErrorEnvelope(
            new AppError('RATE_LIMITED', 429, 'Too many login attempts — try again later'),
          ),
        );
    },
  });
}
