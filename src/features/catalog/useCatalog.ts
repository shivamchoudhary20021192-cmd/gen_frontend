import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type {
  CatalogList,
  CatalogProduct,
  CatalogStatus,
  Category,
  Definition,
  FieldType,
  Location,
  MetaobjectDefinition,
  MetaobjectEntry,
  OwnerType,
  ReferenceItem,
} from './types'

export interface CatalogListParams {
  status?: CatalogStatus
  q?: string
  vendor?: string
  product_type?: string
  tag?: string
  category?: string
  sort?: string
  after?: string
  limit?: number
}

export interface EditorFields {
  product: Definition[]
  variant: Definition[]
}

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (params: CatalogListParams) => ['catalog', 'list', params] as const,
  product: (id: number) => ['catalog', 'product', id] as const,
  blank: ['catalog', 'blank'] as const,
  definitions: (owner: OwnerType) => ['catalog', 'definitions', owner] as const,
  metaobjectTypes: ['catalog', 'metaobject-types'] as const,
  entries: (type: string, q: string) => ['catalog', 'entries', type, q] as const,
}

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => queryClient.invalidateQueries({ queryKey: catalogKeys.all })

// ── products ─────────────────────────────────────────────────────────────────

export function useCatalogList(params: CatalogListParams) {
  return useQuery({
    queryKey: catalogKeys.list(params),
    queryFn: ({ signal }) => api.get<CatalogList>('/catalog/products', { ...params }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useCatalogProduct(id: number | undefined) {
  return useQuery({
    queryKey: catalogKeys.product(id ?? 0),
    queryFn: ({ signal }) => api.get<{ product: CatalogProduct; fields: EditorFields }>(`/catalog/products/${id}`, undefined, signal),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useBlankProduct(enabled: boolean) {
  return useQuery({
    queryKey: catalogKeys.blank,
    queryFn: ({ signal }) => api.get<{ fields: EditorFields; locations: Location[] }>('/catalog/products/new', undefined, signal),
    enabled,
  })
}

export function useSaveCatalogProduct(id: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (product: Record<string, unknown>) =>
      id
        ? api.patch<{ product: CatalogProduct; fields: EditorFields }>(`/catalog/products/${id}`, { product })
        : api.post<{ product: CatalogProduct; fields: EditorFields }>('/catalog/products', { product }, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: (data) => {
      queryClient.setQueryData(catalogKeys.product(data.product.id), data)
      void invalidate(queryClient)
    },
  })
}

export function useDeleteCatalogProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/catalog/products/${id}`),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useDuplicateCatalogProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title?: string }) =>
      api.post<{ product: CatalogProduct }>(`/catalog/products/${id}/duplicate`, { title }, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useCatalogBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { ids: number[]; action: string; status?: CatalogStatus; tags?: string[]; value?: string | null }) =>
      api.post<{ done: number[]; failed: { id: number; error: string }[] }>('/catalog/products/bulk', input),
    onSuccess: () => void invalidate(queryClient),
  })
}

// ── lookups ──────────────────────────────────────────────────────────────────

export function useSuggestions(field: 'vendor' | 'product_type' | 'tag', q: string) {
  return useQuery({
    queryKey: ['catalog', 'suggestions', field, q],
    queryFn: ({ signal }) => api.get<{ values: string[] }>('/catalog/suggestions', { field, q }, signal),
    staleTime: 30_000,
  })
}

export function useTaxonomy(q: string, parent: string | null) {
  return useQuery({
    queryKey: ['catalog', 'taxonomy', q, parent],
    queryFn: ({ signal }) => api.get<{ categories: Category[] }>('/catalog/taxonomy', q ? { q } : parent ? { parent } : undefined, signal),
    staleTime: 5 * 60_000,
  })
}

export function useFieldTypes() {
  return useQuery({
    queryKey: ['catalog', 'field-types'],
    queryFn: ({ signal }) => api.get<FieldType[]>('/catalog/field-types', undefined, signal),
    staleTime: Infinity,
  })
}

export function useReferenceSearch(kind: string, q: string, metaobjectType: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['catalog', 'references', kind, q, metaobjectType ?? null],
    queryFn: ({ signal }) =>
      api.get<{ items: ReferenceItem[] }>(`/catalog/references/${kind}`, { q, ...(metaobjectType ? { metaobject_type: metaobjectType } : {}) }, signal),
    enabled,
    staleTime: 15_000,
  })
}

export function useReferenceLabels(kind: string, ids: number[]) {
  return useQuery({
    queryKey: ['catalog', 'reference-labels', kind, ids],
    queryFn: ({ signal }) => api.get<{ items: ReferenceItem[] }>(`/catalog/references/${kind}`, { ids: ids.join(',') }, signal),
    enabled: ids.length > 0,
    staleTime: 60_000,
  })
}

// ── classic → new ────────────────────────────────────────────────────────────

export function useClassicCandidates(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['catalog', 'classic', q],
    queryFn: ({ signal }) =>
      api.get<{ products: { id: number; title: string; handle: string; status: string; variant_count: number }[]; remaining: number }>(
        '/catalog/classic',
        { q, limit: 100 },
        signal,
      ),
    enabled,
  })
}

export function useAdoptClassic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => api.post<{ done: number[]; failed: { id: number; error: string }[] }>('/catalog/classic/adopt', { ids }),
    onSuccess: () => {
      void invalidate(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// ── custom fields ────────────────────────────────────────────────────────────

export function useDefinitions(owner: OwnerType) {
  return useQuery({
    queryKey: catalogKeys.definitions(owner),
    queryFn: ({ signal }) => api.get<{ definitions: Definition[] }>('/catalog/definitions', { owner_type: owner }, signal),
  })
}

export function useSaveDefinition(id: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (definition: Record<string, unknown>) =>
      id ? api.patch<{ definition: Definition }>(`/catalog/definitions/${id}`, { definition }) : api.post<{ definition: Definition }>('/catalog/definitions', { definition }),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useDeleteDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/catalog/definitions/${id}`),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useSetPinned() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { owner_type: OwnerType; ids: number[] }) => api.put<{ definitions: Definition[] }>('/catalog/definitions/pinned', input),
    onSuccess: () => void invalidate(queryClient),
  })
}

// ── metaobjects ──────────────────────────────────────────────────────────────

export function useMetaobjectTypes() {
  return useQuery({
    queryKey: catalogKeys.metaobjectTypes,
    queryFn: ({ signal }) => api.get<{ definitions: MetaobjectDefinition[] }>('/catalog/metaobject-definitions', undefined, signal),
  })
}

export function useSaveMetaobjectType(id: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (definition: Record<string, unknown>) =>
      id
        ? api.patch<{ definition: MetaobjectDefinition }>(`/catalog/metaobject-definitions/${id}`, { definition })
        : api.post<{ definition: MetaobjectDefinition }>('/catalog/metaobject-definitions', { definition }),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useDeleteMetaobjectType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/catalog/metaobject-definitions/${id}`),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useEntries(type: string, q: string) {
  return useQuery({
    queryKey: catalogKeys.entries(type, q),
    queryFn: ({ signal }) =>
      api.get<{ definition: MetaobjectDefinition; entries: MetaobjectEntry[]; next: string | null }>(`/catalog/metaobjects/${encodeURIComponent(type)}`, { q, limit: 100 }, signal),
    enabled: Boolean(type),
    placeholderData: keepPreviousData,
  })
}

export function useSaveEntry(type: string, id: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: Record<string, unknown>) =>
      id
        ? api.patch<{ entry: MetaobjectEntry }>(`/catalog/metaobjects/${encodeURIComponent(type)}/${id}`, { entry })
        : api.post<{ entry: MetaobjectEntry }>(`/catalog/metaobjects/${encodeURIComponent(type)}`, { entry }),
    onSuccess: () => void invalidate(queryClient),
  })
}

export function useDeleteEntry(type: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/catalog/metaobjects/${encodeURIComponent(type)}/${id}`),
    onSuccess: () => void invalidate(queryClient),
  })
}

/** Field errors keyed by the API's full path ("variants.0.price", "metafields.custom.material"). */
export function detailErrors(caught: unknown): Record<string, string> {
  const details = (caught as { details?: Record<string, unknown> } | null)?.details
  const out: Record<string, string> = {}
  if (!details) return out
  for (const [key, value] of Object.entries(details)) if (Array.isArray(value) && typeof value[0] === 'string') out[key] = value[0]
  return out
}
