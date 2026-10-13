import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Category, Pagination, Product, ProductInput, ProductSummary } from '../../api/types'

export interface ProductListParams {
  page?: number
  limit?: number
  q?: string
  status?: string
  category_id?: number
  sort?: string
}

interface ProductListResponse {
  products: ProductSummary[]
  pagination: Pagination
}

export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => ['products', 'list', params] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
}

export function useProductList(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: ({ signal }) => api.get<ProductListResponse>('/products', { ...params }, signal),
    placeholderData: (previous) => previous,
  })
}

export function useProduct(id: number | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? 0),
    queryFn: ({ signal }) => api.get<{ product: Product }>(`/products/${id}`, undefined, signal),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (product: ProductInput) =>
      api.post<{ product: Product }>(
        '/products',
        { product },
        // A slow save plus an impatient second click must not create two
        // products. The key is per-attempt, so a genuine retry still works.
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (product: Partial<ProductInput>) =>
      api.patch<{ product: Product }>(`/products/${id}`, { product }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useProductAction(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'publish' | 'unpublish' | 'archive' | 'duplicate') =>
      api.post<{ product: Product }>(`/products/${id}/${action}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/products/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useBulkProductAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      ids: number[]
      action: 'publish' | 'unpublish' | 'archive' | 'delete' | 'set_category'
      category_id?: number | null
    }) => api.post<{ affected: number; skipped: { id: number; reason: string }[] }>('/products/bulk', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

// ── categories ───────────────────────────────────────────────────────────────
export const categoryKeys = {
  all: ['categories'] as const,
  list: (tree: boolean) => ['categories', 'list', tree] as const,
}

export function useCategories(tree = false) {
  return useQuery({
    queryKey: categoryKeys.list(tree),
    queryFn: () =>
      api.get<{ categories: Category[] }>('/categories', tree ? { tree: true } : undefined),
    staleTime: 60_000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (category: { name: string; parent_id?: number | null; short_description?: string }) =>
      api.post<{ category: Category }>('/categories', { category }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

/**
 * Photographs for one shade, replaced as a set.
 *
 * Saved on its own rather than with the form: a picture attaches to a shade
 * that already exists, and holding it until the next Save would lose it if the
 * person navigated away.
 */
export function useSetShadeImages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      optionValueId,
      mediaIds,
    }: {
      productId: number
      optionValueId: number
      mediaIds: number[]
    }) =>
      api.put<{ product: Product }>(`/products/${productId}/shades/${optionValueId}/images`, {
        media_ids: mediaIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
