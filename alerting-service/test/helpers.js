import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { NotifierError } from '../src/errors.js';

/** Scriptable notifier: each call consumes the next behaviour ('ok' | 'fail' | 'fatal'); the last one repeats. */
export class FakeNotifier {
  constructor(script = ['ok']) {
    this.script = script;
    this.calls = [];
  }

  async send(alert) {
    this.calls.push(alert.id);
    const step = this.script[Math.min(this.calls.length - 1, this.script.length - 1)];
    if (step === 'fail') throw new NotifierError('boom', { retryable: true });
    if (step === 'fatal') throw new NotifierError('bad request', { retryable: false });
  }
}

export async function startTestServer({ notifier = new FakeNotifier(), windowMs = 60_000, maxAttempts = 3 } = {}) {
  let now = new Date('2026-01-01T00:00:00.000Z');
  const clock = { now: () => now, advance: (ms) => { now = new Date(now.getTime() + ms); } };
  const config = {
    dedup: { windowMs },
    notifier: { timeoutMs: 500, maxAttempts, baseDelayMs: 1 },
  };
  const app = createApp({ config, logger: createLogger({ level: 'silent' }), notifier, clock: clock.now });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return {
    notifier,
    clock,
    post: (body) => request('POST', '/api/v1/alerts', body),
    get: (path) => request('GET', path),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const alert = (overrides = {}) => ({
  source: 'payments-api',
  type: 'high_latency',
  severity: 'CRITICAL',
  message: 'p99 latency above 2s',
  ...overrides,
});
