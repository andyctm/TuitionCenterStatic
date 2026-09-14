import { Router } from 'express';
import type { BranchesService } from '../branches/branchesService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { createBranchSchema, updateBranchSchema } from '../validation/academicSchemas';

export function createBranchesRouter(
  branchesService: BranchesService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);
  const superAdminOnly = [authed, requireRole('SUPER_ADMIN')];

  router.get(
    '/',
    authed,
    asyncHandler(async (req, res) => {
      const branches = await branchesService.list(getAuthContext(req));
      res.status(200).json({ data: branches });
    }),
  );

  router.post(
    '/',
    ...superAdminOnly,
    asyncHandler(async (req, res) => {
      const input = parseBody(createBranchSchema, req.body);
      const branch = await branchesService.create(input);
      res.status(201).json({ data: branch });
    }),
  );

  router.get(
    '/:id',
    authed,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'Branch not found');
      }
      const branch = await branchesService.getById(getAuthContext(req), id);
      res.status(200).json({ data: branch });
    }),
  );

  router.patch(
    '/:id',
    ...superAdminOnly,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'Branch not found');
      }
      const input = parseBody(updateBranchSchema, req.body);
      const branch = await branchesService.update(id, input);
      res.status(200).json({ data: branch });
    }),
  );

  return router;
}
