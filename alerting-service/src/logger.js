const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/** Minimal structured (JSON-lines) logger. */
export function createLogger({ level = 'info', sink = console } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const emit = (name, msg, fields) => {
    if (LEVELS[name] < threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: name, msg, ...fields });
    (name === 'error' ? sink.error : sink.log).call(sink, line);
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  };
}
