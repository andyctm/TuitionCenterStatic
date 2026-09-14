import { Router } from 'express';
import type { AuthService } from '../auth/authService';
import { requireAuth } from '../middleware/requireAuth';
import { createLoginRateLimiter } from '../middleware/loginRateLimiter';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validation/authSchemas';

export function createAuthRouter(authService: AuthService, accessTokenSecret: string): Router {
  const router = Router();
  const loginRateLimiter = createLoginRateLimiter();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const input = parseBody(registerSchema, req.body);
      const user = await authService.register(input);
      res.status(201).json({ data: user });
    }),
  );

  router.post(
    '/login',
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const input = parseBody(loginSchema, req.body);
      const result = await authService.login(input);
      res.status(200).json({ data: result });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const input = parseBody(logoutSchema, req.body);
      await authService.logout(input);
      res.status(204).send();
    }),
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const input = parseBody(refreshSchema, req.body);
      const result = await authService.refresh(input);
      res.status(200).json({ data: result });
    }),
  );

  router.post(
    '/forgot-password',
    asyncHandler(async (req, res) => {
      const input = parseBody(forgotPasswordSchema, req.body);
      await authService.forgotPassword(input);
      // Always 204, regardless of whether the email exists — see authService.forgotPassword.
      res.status(204).send();
    }),
  );

  router.post(
    '/reset-password',
    asyncHandler(async (req, res) => {
      const input = parseBody(resetPasswordSchema, req.body);
      await authService.resetPassword(input);
      res.status(204).send();
    }),
  );

  router.get(
    '/me',
    requireAuth(accessTokenSecret),
    asyncHandler(async (req, res) => {
      const user = await authService.me(req.auth!.userId);
      res.status(200).json({ data: user });
    }),
  );

  return router;
}
