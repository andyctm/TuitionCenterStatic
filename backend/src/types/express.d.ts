import type { Logger } from 'pino';
import type { AuthContext } from './authContext';

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      auth?: AuthContext;
    }
  }
}

export {};
