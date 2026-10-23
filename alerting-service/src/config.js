const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 3000),
    logLevel: env.LOG_LEVEL ?? 'info',
    dedup: {
      // Alerts with the same fingerprint inside this window are collapsed into one.
      windowMs: int(env.DEDUP_WINDOW_MS, 5 * 60 * 1000),
    },
    notifier: {
      // "mock" (default, for demos) or "webhook" (POSTs to NOTIFIER_WEBHOOK_URL).
      type: env.NOTIFIER_TYPE ?? 'mock',
      webhookUrl: env.NOTIFIER_WEBHOOK_URL,
      timeoutMs: int(env.NOTIFIER_TIMEOUT_MS, 2000),
      maxAttempts: int(env.NOTIFIER_MAX_ATTEMPTS, 3),
      baseDelayMs: int(env.NOTIFIER_BASE_DELAY_MS, 200),
      mockFailureRate: Number.parseFloat(env.MOCK_NOTIFIER_FAILURE_RATE ?? '0'),
    },
  };
}
