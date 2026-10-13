import type { StockState } from '../../api/types'

/**
 * How each stock state is labelled and coloured.
 *
 * The state itself comes from the API — see `StockState` — so this file only
 * decides presentation. Nothing here recomputes "is this low", because the
 * counters in the summary cards are computed server-side from one expression and
 * a second opinion in the client is exactly how a table stops matching its own
 * totals.
 */
export const STOCK_STATE_META: Record<
  StockState,
  { label: string; colour: 'success' | 'warning' | 'error' | 'default'; help: string }
> = {
  in_stock: {
    label: 'In stock',
    colour: 'success',
    help: 'Above the low-stock threshold for this variant.',
  },
  low: {
    label: 'Low stock',
    colour: 'warning',
    help: 'At or below the low-stock threshold — worth reordering.',
  },
  out_of_stock: {
    label: 'Out of stock',
    colour: 'error',
    help: 'Nothing available to sell at this location.',
  },
  untracked: {
    label: 'Not tracked',
    colour: 'default',
    help: 'Inventory tracking is switched off for this variant, so it always sells.',
  },
}

/** The filter dropdown above the stock table. */
export const STOCK_STATE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All stock levels' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'untracked', label: 'Not tracked' },
]

/**
 * Movement types, in the words a merchant would use.
 *
 * The keys are the database enum. A type missing from this map still renders —
 * `movementLabel` falls back to the raw key rather than a blank cell — so adding
 * a movement type to the schema degrades to something readable instead of a gap
 * in the ledger.
 */
export const MOVEMENT_META: Record<string, { label: string; tone: 'in' | 'out' | 'neutral' }> = {
  purchase_receipt: { label: 'Stock received', tone: 'in' },
  sale: { label: 'Sold', tone: 'out' },
  cancellation: { label: 'Order cancelled', tone: 'in' },
  return_restock: { label: 'Return restocked', tone: 'in' },
  rto_restock: { label: 'RTO restocked', tone: 'in' },
  adjustment: { label: 'Manual adjustment', tone: 'neutral' },
  damage: { label: 'Damaged', tone: 'out' },
  expiry: { label: 'Expired', tone: 'out' },
  transfer_in: { label: 'Transferred in', tone: 'in' },
  transfer_out: { label: 'Transferred out', tone: 'out' },
  reservation_hold: { label: 'Reserved', tone: 'neutral' },
  reservation_release: { label: 'Reservation released', tone: 'neutral' },
  stock_take: { label: 'Stock take', tone: 'neutral' },
}

export function movementLabel(type: string): string {
  return MOVEMENT_META[type]?.label ?? type.replace(/_/g, ' ')
}

/** The full list for the ledger's type filter, ordered as the map is written. */
export const MOVEMENT_TYPE_FILTERS = [
  { value: 'all', label: 'All movement types' },
  ...Object.entries(MOVEMENT_META).map(([value, meta]) => ({ value, label: meta.label })),
]

export const LOCATION_TYPE_OPTIONS = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'store', label: 'Retail store' },
  { value: '3pl', label: 'Third-party logistics' },
  { value: 'virtual', label: 'Virtual / dropship' },
]

/** Signed quantity, so +12 and −3 read at a glance in the ledger. */
export function signedQuantity(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta)
}

/**
 * What a movement points at, in plain words.
 *
 * A sale carries the id of the order that caused it; before that id was recorded
 * the ledger could say a movement came from "an order" but not which one, so this
 * deliberately shows the reference rather than hiding it behind the type.
 */
export function movementReference(
  referenceType: string | null,
  referenceId: number | null,
): string | null {
  if (!referenceType) return null
  const noun = referenceType.replace(/_/g, ' ')
  return referenceId ? `${noun} #${referenceId}` : noun
}
