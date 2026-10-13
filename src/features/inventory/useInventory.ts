import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type {
  InventoryLocation,
  InventoryMovement,
  InventorySummary,
  Pagination,
  StockItem,
} from '../../api/types'

/** What the query-string builder can serialise. Wider than the screens need. */
type QueryParams = Record<string, string | number | boolean | null | undefined>

export const inventoryKeys = {
  all: ['inventory'] as const,
  stock: (params: QueryParams) => [...inventoryKeys.all, 'stock', params] as const,
  variant: (variantId: number) => [...inventoryKeys.all, 'variant', variantId] as const,
  movements: (params: QueryParams) => [...inventoryKeys.all, 'movements', params] as const,
  locations: () => [...inventoryKeys.all, 'locations'] as const,
}

/**
 * The stock table and the cards above it, in one request.
 *
 * The summary travels with the page rather than being fetched separately, so the
 * cards always describe the rows underneath them — filter by location or search
 * for a SKU and both move together. Two independent requests could and did land
 * out of step, which is how the page came to show "3,740 units" over a table
 * holding a different number.
 */
export interface StockPage {
  items: StockItem[]
  pagination: Pagination
  summary: InventorySummary
}

export function useStockLevels(params: QueryParams) {
  return useQuery({
    queryKey: inventoryKeys.stock(params),
    queryFn: () => api.get<StockPage>('/inventory', params),
    // Keeping the previous page on screen while the next one loads stops the
    // table collapsing to zero rows on every keystroke of the search box.
    placeholderData: (previous) => previous,
  })
}

export interface VariantStock {
  item: StockItem
  recent_movements: InventoryMovement[]
}

export function useVariantStock(variantId: number | null) {
  return useQuery({
    queryKey: inventoryKeys.variant(variantId ?? 0),
    queryFn: () => api.get<VariantStock>(`/inventory/${variantId}`),
    enabled: variantId !== null,
  })
}

export function useMovements(params: QueryParams, enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.movements(params),
    queryFn: () =>
      api.get<{ movements: InventoryMovement[]; pagination: Pagination }>('/inventory/movements', params),
    enabled,
    placeholderData: (previous) => previous,
  })
}

export function useLocations(enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.locations(),
    queryFn: () => api.get<{ locations: InventoryLocation[] }>('/inventory/locations'),
    enabled,
  })
}

/**
 * Everything that moves stock invalidates everything that reports on it.
 *
 * An adjustment changes the row, the counters, the ledger and the location
 * totals at once; invalidating the whole namespace is cheaper to reason about
 * than four surgical keys, and it is what keeps the cards honest after a write.
 */
function useStockMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  })
}

export function useAdjustStock() {
  return useStockMutation<{
    variantId: number
    quantity_delta: number
    location_id?: number
    reason: string
  }>(({ variantId, ...body }) => api.post(`/inventory/${variantId}/adjust`, body))
}

export function useSetStock() {
  return useStockMutation<{
    variantId: number
    quantity: number
    location_id?: number
    reason: string
  }>(({ variantId, ...body }) => api.post(`/inventory/${variantId}/set`, body))
}

export function useBulkAdjust() {
  return useStockMutation<{
    items: { variant_id: number; location_id?: number; quantity_delta: number }[]
    reason: string
  }>((body) => api.post('/inventory/bulk-adjust', body))
}

export function useCreateLocation() {
  return useStockMutation<Record<string, unknown>>((location) =>
    api.post('/inventory/locations', { location }),
  )
}

export function useUpdateLocation() {
  return useStockMutation<{ id: number; location: Record<string, unknown> }>(({ id, location }) =>
    api.patch(`/inventory/locations/${id}`, { location }),
  )
}

/**
 * The message an API error should show a merchant.
 *
 * The interesting failures here are deliberate refusals — an adjustment that
 * would take stock below zero, a duplicate location code — and their messages are
 * written to be read. Falling back to a generic string would throw away the only
 * part of the response that explains what to do next.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
