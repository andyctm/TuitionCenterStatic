import { z } from 'zod';

export const auditLogListQuerySchema = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
});
