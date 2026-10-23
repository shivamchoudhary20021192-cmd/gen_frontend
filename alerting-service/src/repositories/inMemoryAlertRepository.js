/**
 * In-memory alert store. The async interface mirrors what a real DB-backed repository would expose,
 * so swapping it out does not touch the service layer.
 *
 * `createOrIncrement` and `compareAndSetNotificationStatus` are the two operations that must be
 * atomic in any implementation (unique index / upsert / conditional update in SQL or Mongo).
 * Here atomicity falls out of Node's single thread: there is no `await` inside either method.
 */
export class InMemoryAlertRepository {
  #byId = new Map();
  #latestByFingerprint = new Map();

  async createOrIncrement(candidate, windowMs, now) {
    const existing = this.#latestByFingerprint.get(candidate.fingerprint);
    if (existing && now.getTime() - Date.parse(existing.lastSeenAt) < windowMs) {
      existing.occurrenceCount += 1;
      existing.lastSeenAt = now.toISOString();
      return { alert: structuredClone(existing), created: false };
    }
    const stored = structuredClone(candidate);
    this.#byId.set(stored.id, stored);
    this.#latestByFingerprint.set(stored.fingerprint, stored);
    return { alert: structuredClone(stored), created: true };
  }

  async findById(id) {
    const alert = this.#byId.get(id);
    return alert ? structuredClone(alert) : null;
  }

  async update(id, patch) {
    const alert = this.#byId.get(id);
    if (!alert) return null;
    Object.assign(alert, patch);
    return structuredClone(alert);
  }

  /** Atomically move notificationStatus from one of `from` to `to`. Returns the alert, or null if it lost the race. */
  async compareAndSetNotificationStatus(id, from, to) {
    const alert = this.#byId.get(id);
    if (!alert || !from.includes(alert.notificationStatus)) return null;
    alert.notificationStatus = to;
    return structuredClone(alert);
  }

  async list({ severity, action, notificationStatus, source } = {}, { limit, offset }) {
    const matches = [...this.#byId.values()]
      .filter((a) => (!severity || a.severity === severity)
        && (!action || a.action === action)
        && (!notificationStatus || a.notificationStatus === notificationStatus)
        && (!source || a.source === source))
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || b.id.localeCompare(a.id));
    return {
      items: matches.slice(offset, offset + limit).map((a) => structuredClone(a)),
      total: matches.length,
    };
  }
}
