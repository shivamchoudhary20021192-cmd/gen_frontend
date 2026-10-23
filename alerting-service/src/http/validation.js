import { Action, NotificationStatus, Severity } from '../domain/alert.js';
import { ValidationError } from '../errors.js';

const MAX = { source: 100, type: 100, message: 2000, dedupKey: 200 };
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function parseCreateAlert(body) {
  const errors = [];
  if (!isPlainObject(body)) throw new ValidationError([{ field: 'body', message: 'must be a JSON object' }]);

  const requiredString = (field) => {
    const value = body[field];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push({ field, message: 'is required and must be a non-empty string' });
    } else if (value.length > MAX[field]) {
      errors.push({ field, message: `must be at most ${MAX[field]} characters` });
    }
    return typeof value === 'string' ? value.trim() : value;
  };

  const source = requiredString('source');
  const type = requiredString('type');
  const message = requiredString('message');

  const severity = typeof body.severity === 'string' ? body.severity.toUpperCase() : body.severity;
  if (!Object.values(Severity).includes(severity)) {
    errors.push({ field: 'severity', message: `must be one of ${Object.values(Severity).join(', ')}` });
  }

  let dedupKey;
  if (body.dedupKey !== undefined) {
    if (typeof body.dedupKey !== 'string' || body.dedupKey.trim() === '' || body.dedupKey.length > MAX.dedupKey) {
      errors.push({ field: 'dedupKey', message: `must be a non-empty string of at most ${MAX.dedupKey} characters` });
    } else {
      dedupKey = body.dedupKey.trim();
    }
  }

  if (body.metadata !== undefined && !isPlainObject(body.metadata)) {
    errors.push({ field: 'metadata', message: 'must be an object' });
  }

  if (errors.length) throw new ValidationError(errors);
  return { source, type, message, severity, dedupKey, metadata: body.metadata };
}

export function parseListQuery(query) {
  const errors = [];

  const oneOf = (field, allowed, transform = (v) => v) => {
    if (query[field] === undefined) return undefined;
    const value = transform(String(query[field]));
    if (!allowed.includes(value)) errors.push({ field, message: `must be one of ${allowed.join(', ')}` });
    return value;
  };
  const integer = (field, { min, max, fallback }) => {
    if (query[field] === undefined) return fallback;
    const value = Number(query[field]);
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push({ field, message: `must be an integer between ${min} and ${max}` });
    }
    return value;
  };

  const filters = {
    severity: oneOf('severity', Object.values(Severity), (v) => v.toUpperCase()),
    action: oneOf('action', Object.values(Action), (v) => v.toUpperCase()),
    notificationStatus: oneOf('notificationStatus', Object.values(NotificationStatus), (v) => v.toUpperCase()),
    source: query.source === undefined ? undefined : String(query.source),
  };
  const page = {
    limit: integer('limit', { min: 1, max: 100, fallback: 20 }),
    offset: integer('offset', { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 }),
  };

  if (errors.length) throw new ValidationError(errors);
  return { filters, page };
}
