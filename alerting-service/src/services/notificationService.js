import { setTimeout as sleep } from 'node:timers/promises';
import { NotificationStatus } from '../domain/alert.js';

/**
 * Wraps the external notifier with a per-attempt timeout and bounded retries
 * (exponential backoff + jitter, retrying only errors flagged `retryable`).
 * `notify` never throws: callers get a result describing what happened.
 */
export class NotificationService {
  constructor({ notifier, logger, timeoutMs, maxAttempts, baseDelayMs, random = Math.random }) {
    Object.assign(this, { notifier, logger, timeoutMs, maxAttempts, baseDelayMs, random });
  }

  async notify(alert) {
    let attempts = 0;
    let lastError = null;
    while (attempts < this.maxAttempts) {
      attempts += 1;
      try {
        await this.#attempt(alert);
        return { status: NotificationStatus.SENT, attempts, error: null };
      } catch (err) {
        lastError = err.message;
        this.logger.warn('notification attempt failed', {
          alertId: alert.id, attempt: attempts, maxAttempts: this.maxAttempts, retryable: err.retryable !== false, error: err.message,
        });
        if (err.retryable === false || attempts >= this.maxAttempts) break;
        await sleep(this.#backoff(attempts));
      }
    }
    return { status: NotificationStatus.FAILED, attempts, error: lastError };
  }

  async #attempt(alert) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      // Race against the abort signal too, so a notifier that ignores `signal` still cannot hang us.
      await Promise.race([
        this.notifier.send(alert, { signal: controller.signal }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error(`Notifier timed out after ${this.timeoutMs}ms`), { retryable: true }));
        }, { once: true })),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  #backoff(attempt) {
    const exp = this.baseDelayMs * 2 ** (attempt - 1);
    return exp + Math.floor(this.random() * this.baseDelayMs);
  }
}
