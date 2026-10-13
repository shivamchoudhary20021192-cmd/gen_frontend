import { ApiError } from '../api/client'

/** The message to show for anything a request threw. */
export function errorMessage(caught: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (caught instanceof ApiError) return caught.message
  if (caught instanceof TypeError) return 'Could not reach the server.'
  return fallback
}

/** Field-level messages from a validation error, or none. */
export function fieldErrors(caught: unknown): Record<string, string> {
  return caught instanceof ApiError ? caught.fieldErrors() : {}
}

/** The plan does not include this, or its limit is used up: the fix is upgrading. */
export function isPlanError(caught: unknown): boolean {
  return caught instanceof ApiError && (caught.code === 'FEATURE_NOT_IN_PLAN' || caught.code === 'PLAN_LIMIT_REACHED')
}
