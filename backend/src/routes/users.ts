import { Router } from 'express';
import type { UsersService } from '../users/usersService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { createStaffUserSchema, updateUserStatusSchema } from '../validation/authSchemas';

export function createUsersRouter(usersService: UsersService, accessTokenSecret: string): Router {
  const router = Router();
  const adminOnly = [requireAuth(accessTokenSecret), requireRole('SUPER_ADMIN', 'CENTER_ADMIN')];

  router.get(
    '/',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const users = await usersService.list(getAuthContext(req));
      res.status(200).json({ data: users });
    }),
  );

  router.post(
    '/',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const input = parseBody(createStaffUserSchema, req.body);
      const user = await usersService.createStaffUser(input);
      res.status(201).json({ data: user });
    }),
  );

  router.patch(
    '/:id/status',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'User not found');
      }
      const { status } = parseBody(updateUserStatusSchema, req.body);
      const user = await usersService.updateStatus(getAuthContext(req), id, status);
      res.status(200).json({ data: user });
    }),
  );

  return router;
}
