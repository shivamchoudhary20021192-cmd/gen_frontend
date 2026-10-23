import { NotifierError } from '../errors.js';

/** Posts the alert to an external HTTP endpoint (Slack-style incoming webhook, PagerDuty proxy, ...). */
export class WebhookNotifier {
  constructor({ url, fetchImpl = fetch }) {
    if (!url) throw new Error('NOTIFIER_WEBHOOK_URL is required for the webhook notifier');
    this.url = url;
    this.fetch = fetchImpl;
  }

  async send(alert, { signal } = {}) {
    let response;
    try {
      response = await this.fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': alert.id },
        body: JSON.stringify(alert),
        signal,
      });
    } catch (cause) {
      throw new NotifierError(`Notifier unreachable: ${cause.message}`, { retryable: true, cause });
    }
    if (response.ok) return;
    // 5xx and 429 are worth retrying; other 4xx mean our request is wrong and will not improve.
    const retryable = response.status >= 500 || response.status === 429;
    throw new NotifierError(`Notifier responded ${response.status}`, { retryable });
  }
}
