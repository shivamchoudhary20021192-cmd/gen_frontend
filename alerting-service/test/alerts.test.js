import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FakeNotifier, startTestServer, alert } from './helpers.js';

describe('severity routing', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(() => ctx.close());

  for (const [severity, action, notified, status] of [
    ['CRITICAL', 'NOTIFY', 1, 'SENT'],
    ['HIGH', 'NOTIFY', 1, 'SENT'],
    ['MEDIUM', 'LOG_ONLY', 0, 'NOT_REQUIRED'],
    ['LOW', 'SKIP', 0, 'NOT_REQUIRED'],
  ]) {
    it(`${severity} -> ${action}`, async () => {
      const res = await ctx.post(alert({ severity }));
      assert.equal(res.status, 201);
      assert.equal(res.body.data.action, action);
      assert.equal(res.body.data.notificationStatus, status);
      assert.equal(ctx.notifier.calls.length, notified);
    });
  }
});

describe('validation', () => {
  let ctx;
  before(async () => { ctx = await startTestServer(); });
  after(() => ctx.close());

  it('rejects missing and invalid fields with details', async () => {
    const res = await ctx.post({ source: '', severity: 'SEVERE', metadata: [] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ['message', 'metadata', 'severity', 'source', 'type']);
  });

  it('rejects malformed JSON', async () => {
    const res = await ctx.post('{not json');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  it('accepts severity case-insensitively', async () => {
    const res = await ctx.post(alert({ severity: 'critical' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.severity, 'CRITICAL');
  });
});

describe('deduplication', () => {
  it('collapses duplicates inside the window and notifies once', async () => {
    const ctx = await startTestServer();
    const first = await ctx.post(alert());
    ctx.clock.advance(10_000);
    const second = await ctx.post(alert({ message: 'different text, same alert' }));

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.deduplicated, true);
    assert.equal(second.body.data.id, first.body.data.id);
    assert.equal(second.body.data.occurrenceCount, 2);
    assert.equal(ctx.notifier.calls.length, 1);
    assert.equal((await ctx.get('/api/v1/alerts')).body.pagination.total, 1);
    await ctx.close();
  });

  it('creates a new alert once the window has passed', async () => {
    const ctx = await startTestServer({ windowMs: 60_000 });
    const first = await ctx.post(alert());
    ctx.clock.advance(60_001);
    const second = await ctx.post(alert());

    assert.equal(second.status, 201);
    assert.notEqual(second.body.data.id, first.body.data.id);
    assert.equal(ctx.notifier.calls.length, 2);
    await ctx.close();
  });

  it('treats a different severity, source or dedupKey as a different alert', async () => {
    const ctx = await startTestServer();
    await ctx.post(alert({ severity: 'HIGH' }));
    assert.equal((await ctx.post(alert({ severity: 'CRITICAL' }))).status, 201);
    assert.equal((await ctx.post(alert({ source: 'orders-api' }))).status, 201);
    assert.equal((await ctx.post(alert({ dedupKey: 'host-1' }))).status, 201);
    assert.equal((await ctx.post(alert({ dedupKey: 'host-2' }))).status, 201);
    // same dedupKey, different type -> same alert
    assert.equal((await ctx.post(alert({ dedupKey: 'host-2', type: 'other' }))).status, 200);
    await ctx.close();
  });

  it('handles concurrent duplicates with a single notification', async () => {
    const ctx = await startTestServer();
    const results = await Promise.all(Array.from({ length: 10 }, () => ctx.post(alert())));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(ctx.notifier.calls.length, 1);
    assert.equal((await ctx.get(`/api/v1/alerts/${results[0].body.data.id}`)).body.data.occurrenceCount, 10);
    await ctx.close();
  });
});

describe('notifier failures', () => {
  it('retries transient failures and succeeds', async () => {
    const ctx = await startTestServer({ notifier: new FakeNotifier(['fail', 'fail', 'ok']) });
    const res = await ctx.post(alert());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.notificationStatus, 'SENT');
    assert.equal(res.body.data.notificationAttempts, 3);
    await ctx.close();
  });

  it('still accepts the alert when the notifier stays down, and marks it FAILED', async () => {
    const ctx = await startTestServer({ notifier: new FakeNotifier(['fail']) });
    const res = await ctx.post(alert());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.notificationStatus, 'FAILED');
    assert.equal(res.body.data.notificationAttempts, 3);
    assert.equal(res.body.data.lastNotificationError, 'boom');
    await ctx.close();
  });

  it('does not retry non-retryable errors', async () => {
    const ctx = await startTestServer({ notifier: new FakeNotifier(['fatal']) });
    const res = await ctx.post(alert());
    assert.equal(res.body.data.notificationStatus, 'FAILED');
    assert.equal(ctx.notifier.calls.length, 1);
    await ctx.close();
  });

  it('re-attempts a FAILED notification when a duplicate arrives and the notifier has recovered', async () => {
    const notifier = new FakeNotifier(['fail', 'fail', 'fail', 'ok']);
    const ctx = await startTestServer({ notifier });
    assert.equal((await ctx.post(alert())).body.data.notificationStatus, 'FAILED');

    const dup = await ctx.post(alert());
    assert.equal(dup.status, 200);
    assert.equal(dup.body.data.notificationStatus, 'SENT');
    assert.equal(dup.body.data.notificationAttempts, 4);
    assert.equal(dup.body.data.occurrenceCount, 2);

    await ctx.post(alert()); // already SENT: no further call
    assert.equal(notifier.calls.length, 4);
    await ctx.close();
  });

  it('times out a hung notifier instead of blocking forever', async () => {
    const hung = { send: () => new Promise(() => {}) };
    const ctx = await startTestServer({ notifier: hung, maxAttempts: 1 });
    const res = await ctx.post(alert());
    assert.equal(res.body.data.notificationStatus, 'FAILED');
    assert.match(res.body.data.lastNotificationError, /timed out/);
    await ctx.close();
  });
});

describe('listing and lookup', () => {
  let ctx;
  before(async () => {
    ctx = await startTestServer();
    for (const [i, severity] of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'HIGH'].entries()) {
      await ctx.post(alert({ severity, type: `t${i}`, source: i % 2 ? 'orders-api' : 'payments-api' }));
      ctx.clock.advance(1000);
    }
  });
  after(() => ctx.close());

  it('lists newest first with pagination metadata', async () => {
    const res = await ctx.get('/api/v1/alerts?limit=2&offset=1');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.pagination, { total: 5, limit: 2, offset: 1 });
    assert.deepEqual(res.body.data.map((a) => a.type), ['t3', 't2']);
  });

  it('filters by severity, action, notificationStatus and source', async () => {
    assert.equal((await ctx.get('/api/v1/alerts?severity=high')).body.pagination.total, 2);
    assert.equal((await ctx.get('/api/v1/alerts?action=LOG_ONLY')).body.pagination.total, 1);
    assert.equal((await ctx.get('/api/v1/alerts?notificationStatus=SENT')).body.pagination.total, 3);
    assert.equal((await ctx.get('/api/v1/alerts?source=orders-api&severity=HIGH')).body.pagination.total, 0);
  });

  it('rejects bad query params', async () => {
    const res = await ctx.get('/api/v1/alerts?severity=nope&limit=0');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ['limit', 'severity']);
  });

  it('gets by id and 404s for unknown ids and routes', async () => {
    const [first] = (await ctx.get('/api/v1/alerts')).body.data;
    assert.equal((await ctx.get(`/api/v1/alerts/${first.id}`)).body.data.id, first.id);
    assert.equal((await ctx.get('/api/v1/alerts/does-not-exist')).status, 404);
    assert.equal((await ctx.get('/nope')).status, 404);
  });
});
