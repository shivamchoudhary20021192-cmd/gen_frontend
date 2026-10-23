import { createHash, randomUUID } from 'node:crypto';

export const Severity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

/** What the service decides to do with an alert. */
export const Action = Object.freeze({
  NOTIFY: 'NOTIFY', // call the external notifier
  LOG_ONLY: 'LOG_ONLY', // record + log the incident, no notification
  SKIP: 'SKIP', // record only, no notification and no log noise
});

export const NotificationStatus = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
});

/** Severity -> action routing table. Change here to change the policy. */
export const SEVERITY_POLICY = Object.freeze({
  [Severity.CRITICAL]: Action.NOTIFY,
  [Severity.HIGH]: Action.NOTIFY,
  [Severity.MEDIUM]: Action.LOG_ONLY,
  [Severity.LOW]: Action.SKIP,
});

export const actionFor = (severity) => SEVERITY_POLICY[severity];

/**
 * Identity of "the same alert" for deduplication.
 * An explicit dedupKey wins; otherwise source + type. Severity is always part of it so an
 * escalation (e.g. MEDIUM -> CRITICAL) is never swallowed by an older, quieter alert.
 */
export function fingerprint({ source, type, severity, dedupKey }) {
  const identity = dedupKey ? `key:${dedupKey}` : `type:${type}`;
  return createHash('sha256').update([source, identity, severity].join('\u0000')).digest('hex');
}

export function buildAlert(input, now) {
  const severity = input.severity;
  const action = actionFor(severity);
  const timestamp = now.toISOString();
  return {
    id: randomUUID(),
    source: input.source,
    type: input.type,
    severity,
    message: input.message,
    metadata: input.metadata ?? {},
    dedupKey: input.dedupKey ?? null,
    fingerprint: fingerprint(input),
    action,
    notificationStatus: action === Action.NOTIFY ? NotificationStatus.PENDING : NotificationStatus.NOT_REQUIRED,
    notificationAttempts: 0,
    lastNotificationError: null,
    notifiedAt: null,
    occurrenceCount: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
  };
}
