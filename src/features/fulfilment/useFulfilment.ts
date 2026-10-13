import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination } from '../../api/types'
import { orderKeys } from '../orders/useOrders'

/** What the query-string builder can serialise. Wider than the screens need. */
type QueryParams = Record<string, string | number | boolean | null | undefined>

// ── shipments ────────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'created'
  | 'label_generated'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'ndr'
  | 'rto_initiated'
  | 'rto_in_transit'
  | 'rto_delivered'
  | 'lost'
  | 'damaged'
  | 'cancelled'

export interface Shipment {
  id: number
  shipment_number: string
  order: { id: number; order_number: string; status: string }
  customer: { name: string | null; phone: string | null }
  destination: { city: string; state: string; pincode: string } | null
  carrier: {
    id: number
    name: string
    code: string
    /**
     * Whether the carrier is genuinely connected. False while the stand-in
     * provider is in use — the screens say so rather than implying a booking
     * that never happened.
     */
    is_live: boolean
  } | null
  awb_number: string | null
  tracking_url: string | null
  status: ShipmentStatus
  shipping_mode: string
  weight_grams: number | null
  shipping_charge: number | null
  cod_amount: number
  ndr_reason: string | null
  ndr_attempts: number
  rto_reason: string | null
  item_count: number
  shipped_at: string | null
  estimated_delivery_at: string | null
  delivered_at: string | null
  created_at: string
  next_statuses: ShipmentStatus[]
  can_cancel: boolean
}

export interface ShipmentDetail extends Shipment {
  items: {
    id: number
    order_item_id: number
    quantity: number
    sku: string
    name: string
    variant_title: string | null
    image_url: string | null
  }[]
  tracking: {
    id: number
    status: string
    label: string | null
    description: string | null
    location: string | null
    at: string
  }[]
}

export interface Carrier {
  id: number
  code: string
  name: string
  supports_cod: boolean
  supports_reverse_pickup: boolean
  is_active: boolean
  provider: string | null
  is_live: boolean
}

export const fulfilmentKeys = {
  shipments: ['shipments'] as const,
  shipmentList: (params: QueryParams) => ['shipments', 'list', params] as const,
  shipmentCounts: ['shipments', 'counts'] as const,
  shipment: (id: number) => ['shipments', 'detail', id] as const,
  carriers: ['shipments', 'carriers'] as const,
  returns: ['returns'] as const,
  returnList: (params: QueryParams) => ['returns', 'list', params] as const,
  returnCounts: ['returns', 'counts'] as const,
  return: (id: number) => ['returns', 'detail', id] as const,
  returnable: (orderId: number) => ['returns', 'returnable', orderId] as const,
  invoices: ['invoices'] as const,
  invoiceList: (params: QueryParams) => ['invoices', 'list', params] as const,
  invoice: (id: number) => ['invoices', 'detail', id] as const,
  carts: ['carts'] as const,
  cartList: (params: QueryParams) => ['carts', 'list', params] as const,
  cart: (id: number) => ['carts', 'detail', id] as const,
}

export function useShipmentList(params: QueryParams) {
  return useQuery({
    queryKey: fulfilmentKeys.shipmentList(params),
    queryFn: () => api.get<{ shipments: Shipment[]; pagination: Pagination }>('/shipments', params),
    placeholderData: (previous) => previous,
  })
}

export function useShipmentCounts() {
  return useQuery({
    queryKey: fulfilmentKeys.shipmentCounts,
    queryFn: () => api.get<{ counts: Record<string, number> }>('/shipments/counts'),
    staleTime: 30_000,
  })
}

export function useShipment(id: number | undefined) {
  return useQuery({
    queryKey: fulfilmentKeys.shipment(id ?? 0),
    queryFn: () => api.get<{ shipment: ShipmentDetail }>(`/shipments/${id}`),
    enabled: Boolean(id),
  })
}

export function useCarriers() {
  return useQuery({
    queryKey: fulfilmentKeys.carriers,
    queryFn: () => api.get<{ carriers: Carrier[] }>('/shipments/carriers'),
    staleTime: 10 * 60_000,
  })
}

/**
 * Shipment writes refresh the shipment, the list and the order behind it.
 *
 * The order matters: an order's own screen shows the shipment's status, and a
 * parcel marked delivered here that still reads "shipped" there is the kind of
 * disagreement that gets a customer told the wrong thing.
 */
function useShipmentMutation<TVariables>(
  id: number,
  run: (variables: TVariables) => Promise<{ shipment: ShipmentDetail }>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (data) => {
      queryClient.setQueryData(fulfilmentKeys.shipment(id), data)
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.shipments })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

export function useRefreshTracking(id: number) {
  return useShipmentMutation<void>(id, () =>
    api.post<{ shipment: ShipmentDetail }>(`/shipments/${id}/refresh-tracking`, {}),
  )
}

export function useShipmentStatus(id: number) {
  return useShipmentMutation<{ status: ShipmentStatus; note?: string | null; reason?: string | null }>(id, (body) =>
    api.post<{ shipment: ShipmentDetail }>(`/shipments/${id}/status`, body),
  )
}

export function useCancelShipment(id: number) {
  return useShipmentMutation<{ reason: string }>(id, (body) =>
    api.post<{ shipment: ShipmentDetail }>(`/shipments/${id}/cancel`, body),
  )
}

// ── returns ──────────────────────────────────────────────────────────────────

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'received'
  | 'inspected'
  | 'refunded'
  | 'closed'

export type ReturnReason =
  | 'damaged'
  | 'wrong_item'
  | 'missing_item'
  | 'not_as_described'
  | 'adverse_reaction'
  | 'changed_mind'
  | 'late_delivery'
  | 'expired_product'
  | 'other'

export interface ReturnRequest {
  id: number
  rma_number: string
  order: {
    id: number
    order_number: string
    status: string
    payment_method: string
    delivered_at: string | null
    amount_paid: number
    amount_refunded: number
    refundable: number
  }
  customer: { id: number | null; name: string | null; phone: string | null }
  reason: ReturnReason
  reason_detail: string | null
  status: ReturnStatus
  refund_method: string
  requested_amount: number
  approved_amount: number | null
  pickup_awb: string | null
  rejection_reason: string | null
  inspection_note: string | null
  item_count: number
  requested_at: string
  approved_at: string | null
  approved_by: string | null
  received_at: string | null
  closed_at: string | null
  next_statuses: ReturnStatus[]
}

export interface ReturnDetail extends ReturnRequest {
  items: {
    id: number
    order_item_id: number
    sku: string
    name: string
    variant_title: string | null
    image_url: string | null
    quantity: number
    unit_price: number
    refund_amount: number
    condition: string | null
    restock: boolean
    condition_note: string | null
  }[]
}

export interface ReturnableOrder {
  order: { id: number; order_number: string; status: string; delivered_at: string | null }
  window: { days: number; days_since_delivery: number | null; in_window: boolean; delivered: boolean }
  items: {
    order_item_id: number
    sku: string
    name: string
    variant_title: string | null
    image_url: string | null
    unit_price: number
    delivered_quantity: number
    returned_quantity: number
    pending_return_quantity: number
    returnable: number
  }[]
}

export function useReturnList(params: QueryParams) {
  return useQuery({
    queryKey: fulfilmentKeys.returnList(params),
    queryFn: () => api.get<{ returns: ReturnRequest[]; pagination: Pagination }>('/returns', params),
    placeholderData: (previous) => previous,
  })
}

export function useReturnCounts() {
  return useQuery({
    queryKey: fulfilmentKeys.returnCounts,
    queryFn: () => api.get<{ counts: Record<string, number> }>('/returns/counts'),
    staleTime: 30_000,
  })
}

export function useReturn(id: number | undefined) {
  return useQuery({
    queryKey: fulfilmentKeys.return(id ?? 0),
    queryFn: () => api.get<{ return: ReturnDetail }>(`/returns/${id}`),
    enabled: Boolean(id),
  })
}

export function useReturnable(orderId: number | undefined) {
  return useQuery({
    queryKey: fulfilmentKeys.returnable(orderId ?? 0),
    queryFn: () => api.get<ReturnableOrder>(`/returns/returnable/${orderId}`),
    enabled: Boolean(orderId),
  })
}

export function useCreateReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      order_id: number
      reason: ReturnReason
      reason_detail?: string | null
      items: { order_item_id: number; quantity: number }[]
    }) =>
      api.post<{ return: ReturnDetail }>('/returns', body, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.returns })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

function useReturnMutation<TVariables>(
  id: number,
  run: (variables: TVariables) => Promise<{ return: ReturnDetail }>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (data) => {
      queryClient.setQueryData(fulfilmentKeys.return(id), data)
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.returns })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

export function useReturnStatus(id: number) {
  return useReturnMutation<{
    status: ReturnStatus
    note?: string | null
    reason?: string | null
    approved_amount?: number
  }>(id, (body) => api.post<{ return: ReturnDetail }>(`/returns/${id}/status`, body))
}

export function useSchedulePickup(id: number) {
  return useReturnMutation<{ carrier_id?: number | null }>(id, (body) =>
    api.post<{ return: ReturnDetail }>(`/returns/${id}/schedule-pickup`, body, {
      idempotencyKey: crypto.randomUUID(),
    }),
  )
}

export function useInspectReturn(id: number) {
  return useReturnMutation<{
    note?: string | null
    items: { id: number; condition: string; restock: boolean; condition_note?: string | null }[]
  }>(id, (body) => api.post<{ return: ReturnDetail }>(`/returns/${id}/inspect`, body))
}

export function useRefundReturn(id: number) {
  return useReturnMutation<{ amount?: number; note?: string | null }>(id, (body) =>
    api.post<{ return: ReturnDetail }>(`/returns/${id}/refund`, body, { idempotencyKey: crypto.randomUUID() }),
  )
}

// ── invoices ─────────────────────────────────────────────────────────────────

export interface Invoice {
  id: number
  invoice_number: string
  invoice_type: 'tax_invoice' | 'credit_note'
  against_invoice: string | null
  order: { id: number; order_number: string }
  customer: { name: string | null; phone: string | null }
  invoice_date: string
  seller_gstin: string | null
  seller_legal_name: string | null
  buyer_gstin: string | null
  place_of_supply: string | null
  place_of_supply_name: string | null
  taxable_value: number
  cgst: number
  sgst: number
  igst: number
  shipping: number
  cod_fee: number
  round_off: number
  total_amount: number
  tax_total: number
  is_inter_state: boolean
  status: string
  pdf_url: string | null
  issued_at: string | null
}

export interface InvoiceSummary {
  invoice_count: number
  taxable_value: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export function useInvoiceList(params: QueryParams) {
  return useQuery({
    queryKey: fulfilmentKeys.invoiceList(params),
    queryFn: () =>
      api.get<{ invoices: Invoice[]; pagination: Pagination; summary: InvoiceSummary }>('/invoices', params),
    placeholderData: (previous) => previous,
  })
}

export function useIssueInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post<{ invoice: Invoice; already_existed: boolean }>(`/invoices/orders/${orderId}/issue`, {}, {
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.invoices })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

export function useIssueCreditNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { invoiceId: number; amount: number; reason: string }) =>
      api.post<{ invoice: Invoice }>(
        `/invoices/${input.invoiceId}/credit-note`,
        { amount: input.amount, reason: input.reason },
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.invoices })
    },
  })
}

// ── abandoned carts ──────────────────────────────────────────────────────────

export interface AbandonedCart {
  id: number
  customer: {
    id: number | null
    name: string | null
    phone: string | null
    email: string | null
    reachable: boolean
  }
  item_count: number
  value: number
  pincode: string | null
  status: string
  abandoned_at: string | null
  hours_since: number | null
  last_contacted_at: string | null
  recovery_url: string | null
}

export interface AbandonedCartDetail extends AbandonedCart {
  items: {
    id: number
    variant_id: number
    sku: string
    name: string
    slug: string
    variant_title: string | null
    quantity: number
    unit_price: number
    line_total: number
    in_stock: boolean
    available: number | null
  }[]
}

export function useAbandonedCarts(params: QueryParams) {
  return useQuery({
    queryKey: fulfilmentKeys.cartList(params),
    queryFn: () =>
      api.get<{
        carts: AbandonedCart[]
        pagination: Pagination
        stats: { abandoned_carts: number; value_at_risk: number; recovered_last_30_days: number }
      }>('/carts/abandoned', params),
    placeholderData: (previous) => previous,
  })
}

export function useAbandonedCart(id: number | undefined) {
  return useQuery({
    queryKey: fulfilmentKeys.cart(id ?? 0),
    queryFn: () => api.get<{ cart: AbandonedCartDetail }>(`/carts/abandoned/${id}`),
    enabled: Boolean(id),
  })
}

/**
 * Marks stale carts abandoned.
 *
 * Called when the screen mounts. There is no scheduler yet, so a queue that
 * fills when someone opens it beats one that never fills.
 */
export function useSweepCarts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ marked_abandoned: number; idle_hours: number }>('/carts/abandoned/sweep', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.carts })
    },
  })
}

export function useRecoveryLink(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ recovery_url: string; token: string }>(`/carts/abandoned/${id}/recovery-link`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.carts })
    },
  })
}

export function useMarkContacted(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ cart: AbandonedCartDetail }>(`/carts/abandoned/${id}/contacted`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.carts })
    },
  })
}

export function useDismissCart(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ dismissed: boolean }>(`/carts/abandoned/${id}/dismiss`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fulfilmentKeys.carts })
    },
  })
}
