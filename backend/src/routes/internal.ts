import { Router } from 'express';
import type { SessionMaterializationService } from '../attendance/sessionMaterializationService';
import { asyncHandler } from '../lib/asyncHandler';
import { requireInternalSecret } from '../middleware/requireInternalSecret';

export function createInternalRouter(
  sessionMaterializationService: SessionMaterializationService,
  internalJobSecret: string,
): Router {
  const router = Router();

  router.post(
    '/jobs/materialize-sessions',
    requireInternalSecret(internalJobSecret),
    asyncHandler(async (_req, res) => {
      const result = await sessionMaterializationService.run();
      res.status(200).json({ data: result });
    }),
  );

  return router;
}
