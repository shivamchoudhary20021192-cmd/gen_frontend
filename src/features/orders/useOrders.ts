import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination } from '../../api/types'
import { navigationKeys } from '../../navigation/useNavigation'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'rto'

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'cod_pending'
  | 'cod_collected'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'cancelled'

export type FulfillmentStatus = 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'returned' | 'rto'

export interface OrderSummary {
  id: number
  order_number: string
  public_id: string
  customer: {
    id: number | null
    name: string | null
    phone: string | null
    email: string | null
    is_guest: boolean
  }
  order_status: OrderStatus
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  payment_method: string
  currency: string
  grand_total: number
  amount_paid: number
  amount_refunded: number
  amount_due: number
  item_count: number
  pincode: string | null
  shipping_method: string | null
  coupon_code: string | null
  risk_score: number | null
  source_channel: string | null
  placed_at: string | null
  delivered_at: string | null
  /**
   * The transitions this order can legally make right now, straight from the
   * server's transition table. The UI offers exactly these and nothing else —
   * a hardcoded button list in the client is how you end up showing a "Ship"
   * button that 409s.
   */
  next_statuses: OrderStatus[]
  /** Set when the customer paid in another market's currency. */
  presentment?: {
    market_id: number | null
    shop_currency: string
    exchange_rate: number
    shop_grand_total: number
  } | null
}

export interface OrderItem {
  id: number
  product_id: number | null
  variant_id: number | null
  line_type: string
  sku: string
  name: string
  variant_title: string | null
  image_url: string | null
  hsn_code: string | null
  unit_mrp: number
  unit_price: number
  quantity: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  line_total: number
  fulfilled_quantity: number
  cancelled_quantity: number
  returned_quantity: number
  refunded_amount: number
  outstanding_quantity: number
}

export interface OrderAddress {
  type: string
  name: string
  phone: string | null
  email: string | null
  line1: string
  line2: string | null
  landmark: string | null
  city: string
  state: string
  state_code: string | null
  pincode: string
  country: string | null
  gstin: string | null
  delivery_notes: string | null
}

export interface OrderTotals {
  subtotal: number
  discount_total: number
  coupon_discount: number
  loyalty_discount: number
  shipping_total: number
  /** The part of tax_total charged on delivery. */
  shipping_tax: number
  cod_fee: number
  tax_total: number
  /** The named taxes charged: "CGST 9%", "California sales tax 7.25%". */
  tax_lines: { name: string; rate: number; amount: number }[]
  cgst_total: number
  sgst_total: number
  igst_total: number
  grand_total: number
  amount_paid: number
  amount_refunded: number
  amount_due: number
  /** Paid with gift cards; refunds of it go back onto the cards. */
  gift_card_total?: number
  refundable: number
}

export interface TimelineEntry {
  id: number
  type: string
  from: string | null
  to: string
  note: string | null
  actor_type: string
  actor: string | null
  customer_visible: boolean
  at: string
}

export interface OrderShipment {
  id: number
  shipment_number: string
  carrier: string | null
  awb_number: string | null
  tracking_url: string | null
  status: string
  shipping_mode: string | null
  weight_grams: number | null
  cod_amount: number | null
  shipped_at: string | null
  estimated_delivery_at: string | null
  delivered_at: string | null
}

export interface OrderPayment {
  id: number
  gateway: string | null
  gateway_payment_id: string | null
  /** Whether the gateway signature verified — never the signature itself. */
  signature_verified: boolean
  method: string | null
  amount: number
  status: string
  instrument: string | null
  error: string | null
  captured_at: string | null
  created_at: string
}

export interface OrderRefund {
  id: number
  payment_id: number | null
  gateway_refund_id: string | null
  amount: number
  refund_type: string
  reason: string | null
  status: string
  processed_at: string | null
  created_at: string
}

export interface OrderDetail extends OrderSummary {
  totals: OrderTotals
  items: OrderItem[]
  shipping_address: OrderAddress | null
  billing_address: OrderAddress | null
  notes: { customer: string | null; admin: string | null }
  cancellation: { reason: string | null; by: string | null; at: string | null } | null
  estimated_delivery: { from: string | null; to: string | null }
  payments: OrderPayment[]
  refunds: OrderRefund[]
  shipments: OrderShipment[]
  timeline: TimelineEntry[]
}

export interface OrderListParams {
  // Indexed because these go straight to the query-string builder, which
  // enumerates them without knowing the exact shape.
  [key: string]: string | number | boolean | undefined
  page?: number
  limit?: number
  q?: string
  order_status?: string
  payment_status?: string
  fulfillment_status?: string
  payment_method?: string
  customer_id?: number
  placed_from?: string
  placed_to?: string
  unfulfilled?: boolean
  sort?: string
}

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: OrderListParams) => ['orders', 'list', params] as const,
  counts: ['orders', 'counts'] as const,
  detail: (id: number) => ['orders', 'detail', id] as const,
}

export function useOrderList(params: OrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => api.get<{ orders: OrderSummary[]; pagination: Pagination }>('/orders', params),
    // Keeps the table on screen while a filter change loads, instead of
    // collapsing to a spinner on every keystroke.
    placeholderData: (previous) => previous,
  })
}

export function useOrderCounts() {
  return useQuery({
    queryKey: orderKeys.counts,
    queryFn: () => api.get<{ counts: Record<string, number> }>('/orders/counts'),
    staleTime: 30_000,
  })
}

export function useOrder(id: number | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? 0),
    queryFn: () => api.get<{ order: OrderDetail }>(`/orders/${id}`),
    enabled: Boolean(id),
  })
}

/**
 * Every order mutation refreshes the same three things.
 *
 * The order itself is obvious; the list matters because a status change moves
 * a row between tabs; the sidebar matters because the Orders badge counts
 * pending orders and would otherwise sit stale until the next poll.
 */
function useOrderMutation<TVariables>(
  id: number,
  run: (variables: TVariables) => Promise<{ order: OrderDetail }>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (data) => {
      queryClient.setQueryData(orderKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
      void queryClient.invalidateQueries({ queryKey: navigationKeys.menu })
    },
  })
}

export function useChangeOrderStatus(id: number) {
  return useOrderMutation<{ status: OrderStatus; note?: string | null; notify_customer?: boolean }>(id, (body) =>
    api.post<{ order: OrderDetail }>(`/orders/${id}/status`, body),
  )
}

export interface ShipInput {
  carrier_id?: number | null
  awb_number?: string | null
  tracking_url?: string | null
  shipping_mode?: 'surface' | 'air' | 'express'
  weight_grams?: number | null
  note?: string | null
}

export function useShipOrder(id: number) {
  return useOrderMutation<ShipInput>(id, (body) =>
    // Idempotency-keyed server-side: a double-clicked Ship button must not
    // produce two AWBs, so the key is generated once per attempt here.
    api.post<{ order: OrderDetail }>(`/orders/${id}/ship`, body, {
      idempotencyKey: crypto.randomUUID(),
    }),
  )
}

export function useCancelOrder(id: number) {
  return useOrderMutation<{ reason: string; restock?: boolean; note?: string | null }>(id, (body) =>
    api.post<{ order: OrderDetail }>(`/orders/${id}/cancel`, body),
  )
}

export function useRefundOrder(id: number) {
  return useOrderMutation<{ amount?: number; reason: string; internal_note?: string | null; restock?: boolean }>(
    id,
    (body) =>
      api.post<{ order: OrderDetail }>(`/orders/${id}/refund`, body, {
        idempotencyKey: crypto.randomUUID(),
      }),
  )
}

export function useSetOrderNote(id: number) {
  return useOrderMutation<string | null>(id, (admin_note) =>
    api.patch<{ order: OrderDetail }>(`/orders/${id}/note`, { admin_note }),
  )
}
