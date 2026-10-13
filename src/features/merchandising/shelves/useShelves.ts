import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

/**
 * Shelves — the merchandised rows of products on the storefront.
 *
 * Two things are being edited, and they are separate on purpose: the LAYOUT
 * (how the row is drawn) and the SOURCE (which products are in it, either
 * hand-picked or a rule the shop states once). The catalogue below is served
 * by the API rather than hard-coded here, so a rule added to the backend
 * appears in this form without a frontend release.
 */

export interface ShelfRuleWindow {
  default: number
  min: number
  max: number
}

export interface ShelfSource {
  key: string
  label: string
  description: string
  window: ShelfRuleWindow | null
  needs_collection: boolean
  /** What fills the shelf when the rule is short, or null when nothing does. */
  fallback: 'newest' | 'bestselling' | 'rating' | null
}

export interface ShelfCatalogue {
  sources: ShelfSource[]
  layouts: { key: string; label: string; description: string }[]
  placements: { key: string; label: string; scope: 'category' | 'collection' | null }[]
  max_products_ceiling: number
}

export interface ShelfPin {
  product_id: number
  name: string
  slug: string
  status: string
  sort_order: number
}

export interface Shelf {
  id: number
  title: string
  eyebrow: string | null
  subtitle: string | null
  placement: string
  scope_ref_id: number | null
  layout: string
  source: string
  source_label: string
  source_collection_id: number | null
  source_collection_title: string | null
  window_days: number | null
  /** What the window actually is once the rule's default and bounds apply. */
  effective_window_days: number | null
  max_products: number
  include_sold_out: boolean
  tone: 'ivory' | 'cream'
  cta_label: string | null
  link_type: string
  link_url: string | null
  link_ref_id: number | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  sort_order: number
  pin_count: number
  /** Why this shelf is not on the site, in plain words, or null when it is. */
  hidden_because: string | null
  updated_at: string
  pins?: ShelfPin[]
}

export interface ShelfInput {
  title: string
  eyebrow?: string | null
  subtitle?: string | null
  placement?: string
  scope_ref_id?: number | null
  layout?: string
  source?: string
  source_collection_id?: number | null
  window_days?: number | null
  max_products?: number
  include_sold_out?: boolean
  tone?: string
  cta_label?: string | null
  link_type?: string
  link_url?: string | null
  link_ref_id?: number | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean
  pinned_product_ids?: number[]
}

/** What the rule would choose right now, and how it got there. */
export interface ShelfPreview {
  products: {
    id: number
    slug: string
    name: string
    price: number | null
    mrp: number | null
    image: string | null
    image_alt: string
    in_stock: boolean
  }[]
  from_rule: number
  from_pins: number
  from_fallback: number
  shortfall: number
  fallback: string | null
}

const PATH = '/merchandising/shelves'

export const shelfKeys = {
  all: ['shelves'] as const,
  one: (id: number) => ['shelves', id] as const,
  preview: (id: number) => ['shelves', id, 'preview'] as const,
  catalogue: ['shelves', 'catalogue'] as const,
}

/** Rarely changes — it is this build's own vocabulary, not the shop's data. */
export function useShelfCatalogue() {
  return useQuery({
    queryKey: shelfKeys.catalogue,
    queryFn: () => api.get<ShelfCatalogue>(`${PATH}/catalogue`),
    staleTime: 10 * 60 * 1000,
  })
}

export function useShelves(placement?: string) {
  return useQuery({
    queryKey: [...shelfKeys.all, placement ?? 'every'],
    queryFn: () =>
      api.get<{ shelves: Shelf[] }>(placement ? `${PATH}?placement=${encodeURIComponent(placement)}` : PATH),
  })
}

export function useShelf(id: number | null) {
  return useQuery({
    queryKey: shelfKeys.one(id ?? 0),
    queryFn: () => api.get<{ shelf: Shelf }>(`${PATH}/${id}`),
    enabled: id !== null,
  })
}

/**
 * What this shelf's rule chooses right now.
 *
 * The single most useful thing on the screen: "Most repurchased over 180 days"
 * means nothing until you see the products it returns for *this* catalogue.
 * Never cached — it exists to answer "what did my change just do".
 */
export function useShelfPreview(id: number | null) {
  return useQuery({
    queryKey: shelfKeys.preview(id ?? 0),
    queryFn: () => api.get<{ preview: ShelfPreview }>(`${PATH}/${id}/preview`),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * Generic over the result as well as the variables, so a caller that needs the
 * created row's id — to navigate to it — still has a type for it.
 */
function useShelfMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shelfKeys.all })
    },
  })
}

export function useCreateShelf() {
  return useShelfMutation((input: ShelfInput) => api.post<{ shelf: Shelf }>(PATH, input))
}

export function useUpdateShelf() {
  return useShelfMutation(({ id, input }: { id: number; input: Partial<ShelfInput> }) =>
    api.patch(`${PATH}/${id}`, input),
  )
}

export function useDeleteShelf() {
  return useShelfMutation((id: number) => api.delete(`${PATH}/${id}`))
}

export function useReorderShelves() {
  return useShelfMutation((ids: number[]) => api.put(`${PATH}/order`, { ids }))
}
