import { Router } from 'express';
import type { AuditLogService } from '../audit/auditLogService';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { auditLogListQuerySchema } from '../validation/auditLogSchemas';

export function createAuditLogsRouter(
  auditLogService: AuditLogService,
  accessTokenSecret: string,
): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth(accessTokenSecret),
    requireRole('SUPER_ADMIN', 'CENTER_ADMIN'),
    asyncHandler(async (req, res) => {
      const query = parseBody(auditLogListQuerySchema, req.query);
      const logs = await auditLogService.list(getAuthContext(req), query);
      res.status(200).json({ data: logs });
    }),
  );

  return router;
}
