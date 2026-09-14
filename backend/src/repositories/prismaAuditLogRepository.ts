import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditLogRepository } from './types';

export function createPrismaAuditLogRepository(prisma: PrismaClient): AuditLogRepository {
  return {
    async create(input) {
      return prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          before: (input.before ?? null) as Prisma.InputJsonValue,
          after: (input.after ?? null) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
        },
      });
    },
  };
}
