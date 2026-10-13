import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination } from '../../api/types'
import type { ReviewStatus } from './reviewMeta'

type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface AdminReview {
  id: number
  public_id: string
  product: { id: number; name: string; slug: string }
  variant_title: string | null
  order_number: string | null
  author_name: string
  author_location: string | null
  rating: number
  title: string | null
  body: string | null
  age_range: string | null
  usage_duration: string | null
  would_recommend: boolean | null
  is_verified_purchase: boolean
  flagged_adverse_reaction: boolean
  status: ReviewStatus
  rejection_reason: string | null
  moderation_note: string | null
  moderated_by: string | null
  moderated_at: string | null
  open_reports: number
  helpful_count: number
  report_count: number
  source: string
  published_at: string | null
  created_at: string
  reply: { body: string; author: string; published_at: string | null } | null
  /** Which moves the server will accept from here. The buttons come from this. */
  next_statuses: string[]
}

export interface ReviewsPage {
  reviews: AdminReview[]
  pagination: Pagination
  counts: Record<string, number>
}

export const reviewKeys = {
  all: ['reviews'] as const,
  list: (params: QueryParams) => [...reviewKeys.all, 'list', params] as const,
}

export function useReviews(params: QueryParams) {
  return useQuery({
    queryKey: reviewKeys.list(params),
    queryFn: () => api.get<ReviewsPage>('/reviews', params),
    placeholderData: (previous) => previous,
  })
}

/**
 * Every moderation decision changes the queue counts and the product's rating,
 * so the whole namespace is invalidated rather than one key. Cheaper to reason
 * about than four surgical invalidations, and it is what keeps the badge
 * honest after a decision.
 */
function useModerationMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  })
}

export function useChangeReviewStatus() {
  return useModerationMutation<{ id: number; status: string; note?: string; reason?: string }>(
    ({ id, ...body }) => api.post(`/reviews/${id}/status`, body),
  )
}

export function useReplyToReview() {
  return useModerationMutation<{ id: number; body: string; display_name?: string }>(({ id, ...body }) =>
    api.post(`/reviews/${id}/reply`, body),
  )
}

/**
 * The message an API refusal should show.
 *
 * The interesting failures here are deliberate — an illegal transition, a
 * rejection with no reason, a reply on an unpublished review — and their
 * messages are written to be read.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
