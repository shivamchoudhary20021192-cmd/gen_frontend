import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination } from '../../api/types'
import { navigationKeys } from '../../navigation/useNavigation'

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y' | 'free_gift'
export type DiscountState = 'active' | 'scheduled' | 'expired' | 'disabled' | 'exhausted'

export interface Discount {
  id: number
  code: string
  title: string | null
  description: string | null
  discount_type: DiscountType
  value: number
  max_discount_amount: number | null
  min_order_amount: number
  min_quantity: number
  /** Buy X get Y: how many to buy, how many they get, and (optionally) which variant. */
  buy_quantity: number | null
  get_quantity: number | null
  get_variant_id: number | null
  /** Free gift: the variant added at no charge, and whether it is taken from stock. */
  gift_variant_id: number | null
  gift_reserves_inventory: boolean
  applies_to: 'all' | 'products' | 'categories' | 'collections'
  customer_eligibility: 'all' | 'new_customers' | 'returning' | 'specific'
  usage_limit_total: number | null
  usage_limit_per_customer: number
  used_count: number
  is_stackable: boolean
  is_automatic: boolean
  is_visible: boolean
  priority: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  state: DiscountState
  summary: string
  product_count: number
  redemption_count: number
  created_at: string
  targets?: {
    products: { id: number; name: string; slug: string }[]
    collections: { id: number; title: string }[]
    categories: { id: number; name: string }[]
  }
}

export interface ProductDiscount extends Discount {
  /** Where this discount reaches the product from. */
  source: 'product' | 'collection' | 'category' | 'all_products'
  /** False for inherited discounts — they aren't this product's to detach. */
  editable_here: boolean
}

export interface DiscountInput {
  code?: string
  title?: string | null
  description?: string | null
  discount_type?: DiscountType
  value?: number
  max_discount_amount?: number | null
  min_order_amount?: number
  applies_to?: 'all' | 'products' | 'categories' | 'collections'
  customer_eligibility?: 'all' | 'new_customers' | 'returning' | 'specific'
  usage_limit_total?: number | null
  usage_limit_per_customer?: number
  is_stackable?: boolean
  is_automatic?: boolean
  is_visible?: boolean
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean
  product_ids?: number[]
}

export const discountKeys = {
  all: ['discounts'] as const,
  list: (params: Record<string, unknown>) => ['discounts', 'list', params] as const,
  detail: (id: number) => ['discounts', 'detail', id] as const,
  options: ['discounts', 'options'] as const,
  forProduct: (productId: number) => ['discounts', 'product', productId] as const,
}

export type DiscountListParams = Record<string, string | number | boolean | null | undefined>

export function useDiscountList(params: DiscountListParams) {
  return useQuery({
    queryKey: discountKeys.list(params),
    queryFn: ({ signal }) =>
      api.get<{ discounts: Discount[]; pagination: Pagination }>('/discounts', params, signal),
    placeholderData: (previous) => previous,
  })
}

export function useDiscount(id: number | undefined) {
  return useQuery({
    queryKey: discountKeys.detail(id ?? 0),
    queryFn: () => api.get<{ discount: Discount }>(`/discounts/${id}`),
    enabled: typeof id === 'number' && id > 0,
  })
}

/** Active discounts only — the feed behind the product-form dropdown. */
export function useDiscountOptions(enabled = true) {
  return useQuery({
    queryKey: discountKeys.options,
    queryFn: () => api.get<{ discounts: Discount[] }>('/discounts/options'),
    staleTime: 60_000,
    enabled,
  })
}

export function useCreateDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (discount: DiscountInput) =>
      api.post<{ discount: Discount }>('/discounts', { discount }, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: discountKeys.all })
    },
  })
}

export function useUpdateDiscount(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (discount: DiscountInput) => api.patch<{ discount: Discount }>(`/discounts/${id}`, { discount }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: discountKeys.all })
    },
  })
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/discounts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: discountKeys.all })
    },
  })
}

/** Discounts page → choose the products a discount covers (the Shopify way). */
/**
 * Takes the discount id per call rather than closing over it.
 *
 * A discount being *created* has no id until the POST comes back, so a hook
 * bound at render time could never attach that discount's products — which is
 * why a new "specific products" discount used to save with none attached, and
 * silently apply to the whole catalogue.
 */
export function useSetDiscountProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, productIds }: { id: number; productIds: number[] }) =>
      api.put<{ discount: Discount }>(`/discounts/${id}/products`, { product_ids: productIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: discountKeys.all })
    },
  })
}

// ── product side ─────────────────────────────────────────────────────────────
export function useProductDiscounts(productId: number | undefined) {
  return useQuery({
    queryKey: discountKeys.forProduct(productId ?? 0),
    queryFn: () =>
      api.get<{ discounts: ProductDiscount[]; direct_discount_ids: number[] }>(
        `/products/${productId}/discounts`,
      ),
    enabled: typeof productId === 'number' && productId > 0,
  })
}

/**
 * Product form → attach or detach discounts. Writes the same
 * `coupon_products` rows the Discounts page writes: one source of truth, two
 * doors into it.
 */
export function useSetProductDiscounts(productId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (discountIds: number[]) =>
      api.put<{ discounts: ProductDiscount[]; direct_discount_ids: number[] }>(
        `/products/${productId}/discounts`,
        { discount_ids: discountIds },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: discountKeys.all })
      // A badge in the sidebar may now be stale.
      void queryClient.invalidateQueries({ queryKey: navigationKeys.menu })
    },
  })
}
