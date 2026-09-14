import type { Logger } from 'pino';
import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      auth?: { userId: string; role: Role; branchIds: string[] };
    }
  }
}

export {};
