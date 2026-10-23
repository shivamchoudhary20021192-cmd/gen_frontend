import express from 'express';
import { InMemoryAlertRepository } from './repositories/inMemoryAlertRepository.js';
import { NotificationService } from './services/notificationService.js';
import { AlertService } from './services/alertService.js';
import { createNotifier } from './notifiers/index.js';
import { MockNotifier } from './notifiers/mockNotifier.js';
import { alertRoutes } from './http/routes.js';
import { errorHandler, notFoundHandler } from './http/errorHandler.js';
import { ValidationError } from './errors.js';

/**
 * Composition root. Every collaborator can be overridden, which is how tests inject
 * a fake notifier, a controllable clock and zero retry delay.
 */
export function createApp({ config, logger, notifier, repository, clock } = {}) {
  const resolvedNotifier = notifier ?? createNotifier(config.notifier);
  const notificationService = new NotificationService({
    notifier: resolvedNotifier,
    logger,
    timeoutMs: config.notifier.timeoutMs,
    maxAttempts: config.notifier.maxAttempts,
    baseDelayMs: config.notifier.baseDelayMs,
  });
  const alertService = new AlertService({
    repository: repository ?? new InMemoryAlertRepository(),
    notificationService,
    logger,
    dedupWindowMs: config.dedup.windowMs,
    clock,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => logger.debug('request', {
      method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - started,
    }));
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1/alerts', alertRoutes(alertService));

  // Demo helper: flip the mock notifier into an "outage" without restarting the server.
  if (resolvedNotifier instanceof MockNotifier) {
    app.get('/admin/mock-notifier', (req, res) => res.json({ failureRate: resolvedNotifier.failureRate, delivered: resolvedNotifier.sent.length }));
    app.put('/admin/mock-notifier', (req, res, next) => {
      const rate = req.body?.failureRate;
      if (typeof rate !== 'number' || rate < 0 || rate > 1) {
        return next(new ValidationError([{ field: 'failureRate', message: 'must be a number between 0 and 1' }]));
      }
      resolvedNotifier.failureRate = rate;
      return res.json({ failureRate: rate });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
