import type { FulfillmentStatus, OrderStatus, PaymentStatus } from './useOrders'

type ChipColor = 'default' | 'info' | 'warning' | 'error' | 'success'

/**
 * One place that decides what every status is called and coloured.
 *
 * Shopify's convention, and worth keeping: colour carries *needs attention*,
 * not *is good*. Pending is amber because someone has to act on it; delivered
 * is a quiet grey-green because nobody does. Anything that lost money or a
 * parcel is red.
 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  rto: 'Returned to origin',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, ChipColor> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'info',
  packed: 'info',
  shipped: 'info',
  out_for_delivery: 'info',
  delivered: 'success',
  cancelled: 'default',
  returned: 'error',
  rto: 'error',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  authorized: 'Authorised',
  paid: 'Paid',
  cod_pending: 'COD — to collect',
  cod_collected: 'COD collected',
  partially_refunded: 'Partly refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
  cancelled: 'Payment cancelled',
}

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, ChipColor> = {
  pending: 'warning',
  authorized: 'info',
  paid: 'success',
  cod_pending: 'warning',
  cod_collected: 'success',
  partially_refunded: 'warning',
  refunded: 'default',
  failed: 'error',
  cancelled: 'default',
}

export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  unfulfilled: 'Unfulfilled',
  partially_fulfilled: 'Partly fulfilled',
  fulfilled: 'Fulfilled',
  returned: 'Returned',
  rto: 'RTO',
}

export const FULFILLMENT_COLOR: Record<FulfillmentStatus, ChipColor> = {
  unfulfilled: 'warning',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  returned: 'error',
  rto: 'error',
}

/**
 * The verb for moving *to* a status — "Mark as packed" reads worse on a button
 * than "Pack", and a row of buttons is where an operator's eye goes first.
 */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  pending: 'Reopen',
  confirmed: 'Confirm',
  processing: 'Start processing',
  packed: 'Mark packed',
  shipped: 'Ship',
  out_for_delivery: 'Out for delivery',
  delivered: 'Mark delivered',
  cancelled: 'Cancel',
  returned: 'Mark returned',
  rto: 'Mark RTO',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  razorpay: 'Razorpay',
  cod: 'Cash on delivery',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  manual: 'Manual',
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? method
}
