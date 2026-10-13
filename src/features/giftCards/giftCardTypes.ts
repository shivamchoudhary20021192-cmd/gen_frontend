export type GiftCardState = 'active' | 'disabled' | 'expired' | 'used'

export interface GiftCard {
  id: number
  last_characters: string
  masked_code: string
  initial_value: number
  balance: number
  currency: string
  expires_on: string | null
  status: 'enabled' | 'disabled'
  state: GiftCardState
  source: 'manual' | 'purchase' | 'api'
  customer: { id: number; name: string | null; email: string | null } | null
  order: { id: number; order_number: string | null } | null
  recipient: { name: string | null; email: string | null; phone: string | null; message: string | null } | null
  note: string | null
  created_at: string
  last_used_at: string | null
  disabled_at: string | null
}

export interface GiftCardTransaction {
  id: number
  kind: 'issue' | 'debit' | 'credit' | 'adjustment'
  amount: number
  balance_after: number
  order: { id: number; order_number: string | null } | null
  note: string | null
  actor_type: 'admin' | 'customer' | 'system'
  created_at: string
}

export interface GiftCardList {
  gift_cards: GiftCard[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
  summary: { issued: number; outstanding: number; currency: string }
}

export const giftCardKeys = {
  all: ['gift-cards'] as const,
  list: (params: Record<string, unknown>) => ['gift-cards', 'list', params] as const,
  one: (id: number) => ['gift-cards', id] as const,
}

export const STATE: Record<GiftCardState, { label: string; color: 'success' | 'default' | 'warning' | 'error' }> = {
  active: { label: 'Active', color: 'success' },
  used: { label: 'Used', color: 'default' },
  expired: { label: 'Expired', color: 'warning' },
  disabled: { label: 'Disabled', color: 'error' },
}

export const TRANSACTION: Record<GiftCardTransaction['kind'], string> = {
  issue: 'Issued',
  debit: 'Spent',
  credit: 'Credited back',
  adjustment: 'Adjusted',
}
