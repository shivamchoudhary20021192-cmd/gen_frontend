import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination, ProductSummary } from '../../api/types'

export type CollectionType = 'manual' | 'automatic'
export type SortType =
  | 'manual'
  | 'best_selling'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'title_asc'
  | 'rating_desc'

export interface CollectionRule {
  field: string
  operator: string
  value: string | null
}

export interface Collection {
  template_suffix?: string | null
  id: number
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  meta_title: string | null
  meta_description: string | null
  collection_type: CollectionType
  match_condition: 'all' | 'any'
  sort_type: SortType
  image_media_id: number | null
  banner_media_id: number | null
  is_active: boolean
  show_in_menu: boolean
  product_count: number
  published_at: string | null
  sort_order: number
  created_at: string
  rules?: CollectionRule[]
}

export interface CollectionInput {
  title?: string
  slug?: string
  subtitle?: string | null
  description?: string | null
  meta_title?: string | null
  meta_description?: string | null
  collection_type?: CollectionType
  match_condition?: 'all' | 'any'
  sort_type?: SortType
  image_media_id?: number | null
  banner_media_id?: number | null
  is_active?: boolean
  show_in_menu?: boolean
  rules?: CollectionRule[]
  product_ids?: number[]
}

export const collectionKeys = {
  all: ['collections'] as const,
  list: (params: Record<string, unknown>) => ['collections', 'list', params] as const,
  detail: (id: number) => ['collections', 'detail', id] as const,
  members: (id: number) => ['collections', 'members', id] as const,
}

export function useCollectionList(params: Record<string, string | number | boolean | undefined> = {}) {
  return useQuery({
    queryKey: collectionKeys.list(params),
    queryFn: ({ signal }) =>
      api.get<{ collections: Collection[]; pagination: Pagination }>(
        '/collections',
        { limit: 100, ...params },
        signal,
      ),
    placeholderData: (previous) => previous,
  })
}

export function useCollection(id: number | undefined) {
  return useQuery({
    queryKey: collectionKeys.detail(id ?? 0),
    queryFn: () => api.get<{ collection: Collection }>(`/collections/${id}`),
    enabled: typeof id === 'number' && id > 0,
  })
}

/**
 * The products currently in a collection.
 *
 * Automatic collections materialise their membership into `collection_products`
 * on recalculate, so both kinds answer the same query — which is why the form
 * can show "what is in here" identically for manual and rule-driven sets.
 */
export function useCollectionMembers(id: number | undefined) {
  return useQuery({
    queryKey: collectionKeys.members(id ?? 0),
    queryFn: () =>
      api.get<{ products: ProductSummary[]; pagination: Pagination }>('/products', {
        collection_id: id,
        limit: 100,
      }),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (collection: CollectionInput) =>
      api.post<{ collection: Collection }>(
        '/collections',
        { collection },
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all })
    },
  })
}

export function useUpdateCollection(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (collection: CollectionInput) =>
      api.patch<{ collection: Collection }>(`/collections/${id}`, { collection }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all })
    },
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/collections/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all })
    },
  })
}

/** Recalculating an automatic collection rewrites its membership rows. */
export function useRecalculateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<{ product_count: number }>(`/collections/${id}/recalculate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all })
    },
  })
}

/**
 * Replace a manual collection's membership in one request.
 *
 * The API also exposes single add/remove endpoints; this batch one exists so
 * picking thirty products in the dialog is one call, not thirty.
 */
export function useSetCollectionProducts(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productIds: number[]) =>
      api.put<{ collection: Collection }>(`/collections/${id}/products`, { product_ids: productIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all })
    },
  })
}

export interface ProductCollection extends Collection {
  /** False for automatic collections — the product page can't detach those. */
  editable_here: boolean
}

export const productCollectionKeys = {
  forProduct: (productId: number) => ['collections', 'for-product', productId] as const,
}

/** The collections a product is in — the product form's Collections card. */
export function useProductCollections(productId: number | undefined) {
  return useQuery({
    queryKey: productCollectionKeys.forProduct(productId ?? 0),
    queryFn: () =>
      api.get<{ collections: ProductCollection[]; manual_collection_ids: number[] }>(
        `/products/${productId}/collections`,
      ),
    enabled: typeof productId === 'number' && productId > 0,
  })
}

export function useSetProductCollections(productId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (collectionIds: number[]) =>
      api.put<{ collections: ProductCollection[]; manual_collection_ids: number[] }>(
        `/products/${productId}/collections`,
        { collection_ids: collectionIds },
      ),
    onSuccess: () => {
      // The collection list shows product counts, which just changed.
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all })
    },
  })
}

/** Manual collections only — the feed behind the product-form dropdown. */
export function useManualCollectionOptions(enabled = true) {
  return useQuery({
    queryKey: ['collections', 'options', 'manual'],
    queryFn: () =>
      api.get<{ collections: Collection[]; pagination: Pagination }>('/collections', {
        type: 'manual',
        limit: 200,
      }),
    staleTime: 60_000,
    enabled,
  })
}
