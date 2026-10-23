import { Router } from 'express';
import { parseCreateAlert, parseListQuery } from './validation.js';

// Express 4 does not catch rejected promises from async handlers.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function alertRoutes(alertService) {
  const router = Router();

  // 201 = new alert recorded, 200 = collapsed into an existing alert (deduplicated).
  router.post('/', asyncHandler(async (req, res) => {
    const { alert, deduplicated } = await alertService.ingest(parseCreateAlert(req.body));
    res.status(deduplicated ? 200 : 201).json({ data: alert, deduplicated });
  }));

  router.get('/', asyncHandler(async (req, res) => {
    const { filters, page } = parseListQuery(req.query);
    const { items, total } = await alertService.list(filters, page);
    res.json({ data: items, pagination: { total, limit: page.limit, offset: page.offset } });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    res.json({ data: await alertService.get(req.params.id) });
  }));

  return router;
}
