import { Router } from "express";

export function healthRouter() {
    const router = Router();

     router.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok' });
  });

  return router;
}