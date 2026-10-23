export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details) {
    super('Request validation failed', { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} '${id}' not found`, { status: 404, code: 'NOT_FOUND' });
  }
}

/** Thrown by notifier implementations. `retryable` drives the retry policy. */
export class NotifierError extends Error {
  constructor(message, { retryable = true, cause } = {}) {
    super(message, { cause });
    this.name = 'NotifierError';
    this.retryable = retryable;
  }
}
