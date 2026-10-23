import { NotifierError } from '../errors.js';

/**
 * Stand-in for the external call, for demos and local runs.
 * `failureRate` (0..1) can be changed at runtime through PUT /admin/mock-notifier.
 */
export class MockNotifier {
  constructor({ failureRate = 0, latencyMs = 50, random = Math.random } = {}) {
    this.failureRate = failureRate;
    this.latencyMs = latencyMs;
    this.random = random;
    this.sent = [];
  }

  async send(alert, { signal } = {}) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, this.latencyMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new NotifierError('Notifier timed out', { retryable: true }));
      }, { once: true });
    });
    if (this.random() < this.failureRate) {
      throw new NotifierError('Mock notifier simulated outage', { retryable: true });
    }
    this.sent.push(alert.id);
  }
}
