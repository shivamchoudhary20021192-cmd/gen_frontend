import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createApp } from './app.js';

const config = loadConfig();
const logger = createLogger({ level: config.logLevel });
const app = createApp({ config, logger });

const server = app.listen(config.port, () => {
  logger.info('alerting-service listening', { port: config.port, notifier: config.notifier.type, dedupWindowMs: config.dedup.windowMs });
});

const shutdown = (signal) => {
  logger.info('shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
