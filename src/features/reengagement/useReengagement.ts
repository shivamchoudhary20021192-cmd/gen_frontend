import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination } from '../../api/types'

/**
 * "Wanted, not bought" — people who saved a product or left it in their cart
 * and never ordered it, and the nudge that goes out to the ones who agreed to
 * be messaged.
 *
 * The consent state lives on the row rather than being inferred here. A screen
 * that decides for itself who may be messaged is a screen that will eventually
 * message someone who opted out.
 */

export type Interest = 'saved' | 'cart'

export interface AudienceRow {
  customer: {
    id: string
    name: string | null
    /** Masked by the API. The full number is never needed to send. */
    phone: string
    contactable: boolean
    /** Why not, when not. */
    reason: string | null
  }
  product: {
    id: number
    slug: string
    name: string
    image: string | null
    price: number | null
    in_stock: boolean
  }
  interest: Interest
  interested_at: string
  last_contacted_at: string | null
}

export interface AudienceSummary {
  people: number
  contactable: number
  saved: number
  cart: number
  /**
   * False when no WhatsApp provider is configured. The pipeline still records
   * every message, so without this flag a send looks successful and reaches
   * nobody.
   */
  can_send: boolean
}

export interface AudienceResponse {
  audience: AudienceRow[]
  pagination: Pagination
  summary: AudienceSummary
}

export interface SendResult {
  attempted: number
  sent: number
  skipped: { customer: string; reason: string }[]
  dry_run: boolean
  message: string
}

export interface AudienceFilters {
  page?: number
  limit?: number
  interest?: Interest | ''
  contactable?: boolean
  in_stock?: boolean
  within_days?: number | ''
}

/** Drops empty values so the query string carries only real filters. */
export function audienceParams(filters: AudienceFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (filters.page) params.page = filters.page
  if (filters.limit) params.limit = filters.limit
  if (filters.interest) params.interest = filters.interest
  if (filters.contactable) params.contactable = 'true'
  if (filters.in_stock) params.in_stock = 'true'
  if (filters.within_days) params.within_days = filters.within_days
  return params
}

export const reengagementKeys = {
  all: ['reengagement'] as const,
  audience: (filters: AudienceFilters) => ['reengagement', 'audience', filters] as const,
}

export function useAudience(filters: AudienceFilters) {
  return useQuery({
    queryKey: reengagementKeys.audience(filters),
    queryFn: () => api.get<AudienceResponse>('/reengagement/audience', audienceParams(filters)),
    staleTime: 30 * 1000,
  })
}

/**
 * Sends the nudge, or counts it.
 *
 * `dry_run` is explicit on every call rather than defaulted here: the server
 * treats a missing flag as a dry run, and a UI that relies on that default is
 * one refactor away from sending for real by accident.
 */
export function useSendNudge(filters: AudienceFilters) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ dryRun, limit }: { dryRun: boolean; limit: number }) =>
      api.post<SendResult>(
        '/reengagement/send',
        { dry_run: dryRun, limit },
        // The audience is chosen by the query string, exactly as on the list —
        // page and limit are left off so a send is never scoped to one page.
        { query: audienceParams({ ...filters, page: undefined, limit: undefined }) },
      ),
    onSuccess: (result) => {
      // A dry run changes nothing, so leave the cache alone; a real send writes
      // last_contacted_at on every row it touched.
      if (!result.dry_run) {
        void queryClient.invalidateQueries({ queryKey: reengagementKeys.all })
      }
    },
  })
}
