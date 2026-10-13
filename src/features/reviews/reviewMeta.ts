/**
 * How each review state is labelled and coloured.
 *
 * The state itself comes from the API, and so does the list of moves allowed
 * from it (`next_statuses`). Nothing here re-derives either — the screen renders
 * the buttons the server says are legal rather than showing all five and
 * letting the request fail, which is the same rule the orders screen follows.
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'spam' | 'hidden'

export const REVIEW_STATUS_META: Record<
  ReviewStatus,
  { label: string; colour: 'default' | 'success' | 'warning' | 'error' | 'info'; help: string }
> = {
  pending: {
    label: 'Awaiting review',
    colour: 'warning',
    help: 'Submitted by a verified buyer and not yet visible to anyone on the storefront.',
  },
  approved: {
    label: 'Published',
    colour: 'success',
    help: 'Live on the product page and counted in its rating.',
  },
  hidden: {
    label: 'Hidden',
    colour: 'default',
    help: 'Was published, now taken down. Not counted in the rating.',
  },
  rejected: {
    label: 'Rejected',
    colour: 'error',
    help: 'Declined with a reason. Never published, never counted.',
  },
  spam: {
    label: 'Spam',
    colour: 'error',
    help: 'Marked as spam. Never published, never counted.',
  },
}

/** The action a moderator is taking, phrased as the button they press. */
export const STATUS_ACTIONS: Record<string, { label: string; colour: 'success' | 'error' | 'inherit'; needsReason?: boolean }> = {
  approved: { label: 'Approve', colour: 'success' },
  rejected: { label: 'Reject', colour: 'error', needsReason: true },
  spam: { label: 'Mark spam', colour: 'error' },
  hidden: { label: 'Hide', colour: 'inherit' },
}

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Awaiting review' },
  { value: 'approved', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'spam', label: 'Spam' },
  { value: 'all', label: 'Everything' },
]

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'rating_low', label: 'Lowest rated first' },
  { value: 'rating_high', label: 'Highest rated first' },
]

/** Plain words for the enum the storefront form collects. */
export const USAGE_DURATION_LABELS: Record<string, string> = {
  less_than_week: 'Under a week',
  one_to_four_weeks: '1–4 weeks',
  one_to_three_months: '1–3 months',
  three_months_plus: 'Over 3 months',
}

export const AGE_RANGE_LABELS: Record<string, string> = {
  under_18: 'Under 18',
  '18_24': '18–24',
  '25_34': '25–34',
  '35_44': '35–44',
  '45_54': '45–54',
  '55_plus': '55+',
}

export function usageDurationLabel(value: string | null): string | null {
  if (!value) return null
  return USAGE_DURATION_LABELS[value] ?? value.replace(/_/g, ' ')
}

export function ageRangeLabel(value: string | null): string | null {
  if (!value) return null
  return AGE_RANGE_LABELS[value] ?? value.replace(/_/g, ' ')
}
