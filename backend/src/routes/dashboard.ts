import { Router } from 'express';
import type { DashboardService } from '../reporting/dashboardService';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';

export function createDashboardRouter(
  dashboardService: DashboardService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);

  router.get(
    '/summary',
    authed,
    asyncHandler(async (req, res) => {
      const summary = await dashboardService.getSummary(getAuthContext(req));
      res.status(200).json({ data: summary });
    }),
  );

  return router;
}
