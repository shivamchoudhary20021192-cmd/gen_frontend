import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

/**
 * The strip above the header on the storefront.
 *
 * Several lines, rotating — free delivery, the student offer, the festival code
 * — rather than the one CMS banner this replaces. A banner carries a
 * photograph, two crops and a call to action; this is a sentence, and the
 * things it needs are an order, a schedule and sometimes a coupon.
 */

export interface AnnouncementCoupon {
  id: number
  code: string | null
  title: string | null
  type: string | null
  value: number | null
  /** Whether it may be advertised right now — active, in window, not used up. */
  live: boolean
}

export type Visibility = 'all' | 'desktop' | 'mobile'
export type DeviceChoice = 'all' | 'desktop' | 'mobile' | 'none'
export type PageType = 'index' | 'product' | 'collection' | 'list-collections' | 'cart' | 'page' | 'blog' | 'article' | 'search' | 'policy'

export interface Announcement {
  id: number
  message: string
  /** 'free_shipping': the message has {amount} where what is left to spend goes. */
  kind: 'message' | 'free_shipping'
  success_message: string | null
  free_shipping_threshold: number | null
  coupon: AnnouncementCoupon | null
  link: { type: string; url: string | null; ref_id: number | null; label: string | null }
  starts_at: string | null
  ends_at: string | null
  /** Count down to ends_at, beside the message. */
  show_countdown: boolean
  background_hex: string | null
  text_hex: string | null
  visibility: Visibility
  /** Page types it shows on; empty is every page. */
  show_on: PageType[]
  audience: 'all' | 'guests' | 'customers'
  /** Countries (the shopper's market); empty is everywhere. */
  countries: string[]
  is_active: boolean
  sort_order: number
  /** Why this line is not on the site, in plain words, or null when it is. */
  hidden_because: string | null
  /** The last 30 days, counted with shoppers' analytics consent. */
  stats: { views: number; clicks: number }
  updated_at: string
}

export interface AnnouncementSettings {
  is_enabled: boolean
  display_mode: 'rotate' | 'marquee'
  transition: 'fade' | 'slide' | 'slide_up' | 'typewriter' | 'none'
  autoplay: boolean
  rotation_seconds: number
  pause_on_hover: boolean
  marquee_speed: number
  marquee_direction: 'left' | 'right'
  marquee_separator: string
  height_mode: 'auto' | 'uniform' | 'fixed'
  fixed_height_desktop: number
  fixed_height_mobile: number
  max_lines: number
  font_size_desktop: number
  font_size_mobile: number
  font_weight: 'regular' | 'medium' | 'bold'
  text_transform: 'none' | 'uppercase'
  text_align: 'center' | 'left'
  background_hex: string | null
  background_gradient_hex: string | null
  text_hex: string | null
  bar_visibility: Visibility
  arrows_visibility: DeviceChoice
  link_arrow_visibility: DeviceChoice
  is_dismissible: boolean
  dismiss_days: number
}

export interface AnnouncementInput {
  message: string
  kind?: 'message' | 'free_shipping'
  success_message?: string | null
  free_shipping_threshold?: number | null
  show_countdown?: boolean
  background_hex?: string | null
  text_hex?: string | null
  visibility?: Visibility
  show_on?: PageType[]
  audience?: 'all' | 'guests' | 'customers'
  countries?: string[]
  coupon_id?: number | null
  link_type?: string
  link_url?: string | null
  link_ref_id?: number | null
  cta_label?: string | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean
}

const PATH = '/content/announcements'

export const announcementKeys = {
  all: ['announcements'] as const,
}

export function useAnnouncementBar() {
  return useQuery({
    queryKey: announcementKeys.all,
    queryFn: () => api.get<{ announcements: Announcement[]; settings: AnnouncementSettings }>(PATH),
  })
}

/**
 * Every write invalidates the whole list.
 *
 * The rows carry an order and the settings carry the rotation, and both are
 * rendered on the same screen — refetching one without the other is how a list
 * ends up showing an order the server no longer agrees with.
 */
function useBarMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: announcementKeys.all })
    },
  })
}

export function useCreateAnnouncement() {
  return useBarMutation((input: AnnouncementInput) => api.post(PATH, input))
}

export function useUpdateAnnouncement() {
  return useBarMutation(({ id, input }: { id: number; input: Partial<AnnouncementInput> }) =>
    api.patch(`${PATH}/${id}`, input),
  )
}

export function useDeleteAnnouncement() {
  return useBarMutation((id: number) => api.delete(`${PATH}/${id}`))
}

export function useReorderAnnouncements() {
  return useBarMutation((ids: number[]) => api.put(`${PATH}/order`, { ids }))
}

export function useUpdateAnnouncementSettings() {
  return useBarMutation((input: Partial<AnnouncementSettings>) => api.patch(`${PATH}/settings`, input))
}
