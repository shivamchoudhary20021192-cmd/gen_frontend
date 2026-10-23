import { Action, NotificationStatus, buildAlert } from '../domain/alert.js';
import { NotFoundError } from '../errors.js';

export class AlertService {
  constructor({ repository, notificationService, logger, dedupWindowMs, clock = () => new Date() }) {
    Object.assign(this, { repository, notificationService, logger, dedupWindowMs, clock });
  }

  /** @returns {{alert, deduplicated: boolean}} */
  async ingest(input) {
    const now = this.clock();
    const candidate = buildAlert(input, now);
    const { alert, created } = await this.repository.createOrIncrement(candidate, this.dedupWindowMs, now);

    if (!created) {
      this.logger.info('duplicate alert collapsed', {
        alertId: alert.id, fingerprint: alert.fingerprint, occurrenceCount: alert.occurrenceCount,
      });
      return { alert: await this.#retryFailedNotification(alert), deduplicated: true };
    }

    switch (alert.action) {
      case Action.NOTIFY:
        return { alert: await this.#dispatch(alert), deduplicated: false };
      case Action.LOG_ONLY:
        this.logger.warn('incident logged (no notification)', {
          alertId: alert.id, source: alert.source, type: alert.type, severity: alert.severity, message: alert.message,
        });
        break;
      default:
        this.logger.debug('alert skipped by policy', { alertId: alert.id, severity: alert.severity });
    }
    return { alert, deduplicated: false };
  }

  async get(id) {
    const alert = await this.repository.findById(id);
    if (!alert) throw new NotFoundError('Alert', id);
    return alert;
  }

  list(filters, page) {
    return this.repository.list(filters, page);
  }

  /**
   * A duplicate arriving after the first notification FAILED is the natural retry trigger.
   * The compare-and-set guarantees only one concurrent request re-dispatches.
   */
  async #retryFailedNotification(alert) {
    if (alert.action !== Action.NOTIFY || alert.notificationStatus !== NotificationStatus.FAILED) return alert;
    const claimed = await this.repository.compareAndSetNotificationStatus(
      alert.id, [NotificationStatus.FAILED], NotificationStatus.PENDING,
    );
    return claimed ? this.#dispatch(claimed) : alert;
  }

  async #dispatch(alert) {
    const result = await this.notificationService.notify(alert);
    const sent = result.status === NotificationStatus.SENT;
    if (sent) {
      this.logger.info('notification sent', { alertId: alert.id, attempts: result.attempts });
    } else {
      this.logger.error('notification failed, alert kept for retry', { alertId: alert.id, attempts: result.attempts, error: result.error });
    }
    // Re-read: duplicates may have bumped occurrenceCount while we were calling out.
    const latest = await this.repository.findById(alert.id);
    return this.repository.update(alert.id, {
      notificationStatus: result.status,
      notificationAttempts: latest.notificationAttempts + result.attempts,
      lastNotificationError: result.error,
      notifiedAt: sent ? this.clock().toISOString() : latest.notifiedAt,
    });
  }
}
