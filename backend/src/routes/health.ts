import { Router } from 'express';

export function createHealthRouter(checkDb: () => Promise<void>): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      await checkDb();
      res.status(200).json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  return router;
}
