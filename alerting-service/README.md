# Alerting Service

A mini alerting service: REST APIs to ingest and list alerts. Depending on severity an alert
triggers a notification, is skipped, or is only logged. Duplicate alerts are collapsed, and
failures of the external notification call are retried and never lose the alert.

Node.js (>= 20) + Express. In-memory storage behind a repository interface.

## Run

```bash
npm install
npm start            # http://localhost:3000
npm test             # 20 tests, node:test, no extra deps
```

Import `postman/alerting-service.postman_collection.json` into Postman and run the folders in order
(each request has assertions, so the Collection Runner works too).

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | |
| `DEDUP_WINDOW_MS` | 300000 | Duplicate-collapse window |
| `NOTIFIER_TYPE` | `mock` | `mock` or `webhook` |
| `NOTIFIER_WEBHOOK_URL` | – | Required for `webhook` |
| `NOTIFIER_TIMEOUT_MS` / `NOTIFIER_MAX_ATTEMPTS` / `NOTIFIER_BASE_DELAY_MS` | 2000 / 3 / 200 | Per-attempt timeout, attempts, backoff base |
| `MOCK_NOTIFIER_FAILURE_RATE` | 0 | 0..1, mock notifier only |
| `LOG_LEVEL` | info | debug/info/warn/error/silent |

## API

### `POST /api/v1/alerts`
```json
{ "source": "payments-api", "type": "high_latency", "severity": "CRITICAL",
  "message": "p99 > 2s", "dedupKey": "optional", "metadata": { "optional": "object" } }
```
- `201` new alert recorded, `200` collapsed into an existing alert (`"deduplicated": true`), `400` validation error.
- The call succeeds even if the external notification fails; look at `notificationStatus`.

### `GET /api/v1/alerts`
Filters: `severity`, `action`, `notificationStatus`, `source`; paging: `limit` (1-100, default 20), `offset`.
Newest first. Returns `{ data: [...], pagination: { total, limit, offset } }`.

### `GET /api/v1/alerts/:id` — `200` or `404`.

### Demo helpers (mock notifier only)
`GET/PUT /admin/mock-notifier` with `{ "failureRate": 1 }` simulates an outage without a restart. `GET /health`.

## Behaviour

**Severity routing** (`src/domain/alert.js`, one table to change the policy):

| Severity | Action | Effect |
|---|---|---|
| CRITICAL, HIGH | `NOTIFY` | call the external notifier |
| MEDIUM | `LOG_ONLY` | stored + logged as an incident, no notification |
| LOW | `SKIP` | stored, no notification, no log noise (debug only) |

All alerts are persisted so they stay listable/auditable; "skip" refers to the notification.

**Deduplication.** Fingerprint = `sha256(source, dedupKey || type, severity)`. A second alert with the
same fingerprint within the window increments `occurrenceCount` / `lastSeenAt` on the existing alert and
sends **no** new notification. Severity is part of the fingerprint so an escalation is never swallowed.
After the window passes a new alert is created. The check-and-insert is a single atomic repository
operation (`createOrIncrement`), so concurrent duplicates yield exactly one alert and one notification
(covered by a test with 10 parallel requests).

**External call failures** (`NotificationService`): per-attempt timeout, up to 3 attempts with exponential
backoff + jitter, retrying only errors flagged retryable (network, 5xx, 429; other 4xx fail fast). When
retries are exhausted the alert is kept with `notificationStatus=FAILED` and `lastNotificationError`.
A later duplicate of a `FAILED` alert re-attempts the notification (guarded by a compare-and-set so only
one concurrent request retries). The webhook notifier sends an `Idempotency-Key` header (the alert id).

## Layout
```
src/
  config.js, logger.js, errors.js
  domain/alert.js                 severities, routing policy, fingerprint, alert factory
  repositories/                   AlertRepository (in-memory impl)
  notifiers/                      Notifier interface: mock + webhook
  services/alertService.js        ingest / dedup / routing orchestration
  services/notificationService.js timeout + retry/backoff
  http/                           routes, validation, error handler
  app.js                          composition root (everything injectable for tests)
  server.js                       bootstrap + graceful shutdown
```

## Known trade-offs / next steps
- Storage is in-memory (lost on restart). Swap in Postgres/Redis behind `AlertRepository`; the two atomic
  operations map to an upsert on a unique fingerprint index and a conditional `UPDATE`.
- Notification is awaited inside the request (bounded by timeout x attempts) so the response reports the
  outcome. At scale, enqueue it and have a worker retry `FAILED` alerts instead.
- No auth / rate limiting; no circuit breaker around the notifier (would be the next resilience step).
