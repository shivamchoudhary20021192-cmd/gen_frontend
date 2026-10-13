import type { ReturnReason, ReturnStatus, ShipmentStatus } from './useFulfilment'

type ChipColor = 'default' | 'info' | 'warning' | 'error' | 'success'

/**
 * Labels and colours for the fulfilment statuses.
 *
 * Same convention as the orders screens: colour carries *needs attention*, not
 * *is good*. NDR is amber because someone has to call the customer; RTO and
 * lost are red because money or goods are gone.
 */
export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  created: 'Created',
  label_generated: 'Label ready',
  pickup_scheduled: 'Pickup booked',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  ndr: 'Delivery failed',
  rto_initiated: 'RTO started',
  rto_in_transit: 'RTO in transit',
  rto_delivered: 'Returned to us',
  lost: 'Lost',
  damaged: 'Damaged',
  cancelled: 'Cancelled',
}

export const SHIPMENT_STATUS_COLOR: Record<ShipmentStatus, ChipColor> = {
  created: 'default',
  label_generated: 'info',
  pickup_scheduled: 'info',
  picked_up: 'info',
  in_transit: 'info',
  out_for_delivery: 'info',
  delivered: 'success',
  ndr: 'warning',
  rto_initiated: 'warning',
  rto_in_transit: 'warning',
  rto_delivered: 'error',
  lost: 'error',
  damaged: 'error',
  cancelled: 'default',
}

/** The verb for moving *to* a status — buttons read better as actions. */
export const SHIPMENT_ACTION_LABEL: Record<ShipmentStatus, string> = {
  created: 'Reset',
  label_generated: 'Generate label',
  pickup_scheduled: 'Book pickup',
  picked_up: 'Mark picked up',
  in_transit: 'Mark in transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Mark delivered',
  ndr: 'Record failed delivery',
  rto_initiated: 'Start RTO',
  rto_in_transit: 'RTO in transit',
  rto_delivered: 'Mark returned to us',
  lost: 'Mark lost',
  damaged: 'Mark damaged',
  cancelled: 'Cancel',
}

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  pickup_scheduled: 'Pickup booked',
  picked_up: 'Picked up',
  received: 'Received',
  inspected: 'Inspected',
  refunded: 'Refunded',
  closed: 'Closed',
}

export const RETURN_STATUS_COLOR: Record<ReturnStatus, ChipColor> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'default',
  pickup_scheduled: 'info',
  picked_up: 'info',
  received: 'info',
  inspected: 'info',
  refunded: 'success',
  closed: 'default',
}

export const RETURN_ACTION_LABEL: Record<ReturnStatus, string> = {
  requested: 'Reopen',
  approved: 'Approve',
  rejected: 'Reject',
  pickup_scheduled: 'Book pickup',
  picked_up: 'Mark picked up',
  received: 'Mark received',
  inspected: 'Inspect',
  refunded: 'Refund',
  closed: 'Close',
}

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item sent',
  missing_item: 'Item missing',
  not_as_described: 'Not as described',
  adverse_reaction: 'Adverse reaction',
  changed_mind: 'Changed their mind',
  late_delivery: 'Arrived too late',
  expired_product: 'Expired product',
  other: 'Other',
}

export const CONDITION_LABEL: Record<string, string> = {
  unopened: 'Unopened',
  opened: 'Opened, sellable',
  damaged: 'Damaged',
  used: 'Used',
  unknown: 'Not assessed',
}

/**
 * Which conditions a returned unit can go back on the shelf in.
 *
 * Used to default the restock checkbox. An opened cosmetic is not resellable in
 * India, so only unopened is offered by default — the operator can still
 * override, but the safe answer should not require a decision.
 */
export const RESTOCKABLE_CONDITIONS = new Set(['unopened']);
