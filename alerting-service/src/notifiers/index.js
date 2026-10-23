import { MockNotifier } from './mockNotifier.js';
import { WebhookNotifier } from './webhookNotifier.js';

export function createNotifier({ type, webhookUrl, mockFailureRate }) {
  switch (type) {
    case 'webhook':
      return new WebhookNotifier({ url: webhookUrl });
    case 'mock':
      return new MockNotifier({ failureRate: mockFailureRate });
    default:
      throw new Error(`Unknown notifier type '${type}'`);
  }
}
