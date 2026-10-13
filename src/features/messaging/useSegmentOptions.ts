import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

export interface SegmentOption {
  id: number
  name: string
  segment_type: 'manual' | 'auto' | 'imported'
  customer_count: number
  rules: unknown
}

/**
 * The saved segments, for a campaign to aim at.
 *
 * The path is `/segments/segments` and that is not a typo: the segments module
 * mounts a router at `/segments` whose own routes also begin with `/segments`.
 * Asking for the path that actually exists is the right call from here — the
 * duplication is a bug in that module's routing, not something this screen
 * should paper over by shipping a request that 404s.
 */
export function useSegmentOptions() {
  return useQuery({
    queryKey: ['messaging', 'segment-options'],
    queryFn: () => api.get<{ segments: SegmentOption[] }>('/segments/segments'),
    staleTime: 5 * 60 * 1000,
  })
}
