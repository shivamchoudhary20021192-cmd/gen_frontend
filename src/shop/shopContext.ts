import { createContext } from 'react'
import type { Membership, ShopSummary } from './types'

export interface ShopState {
  /** Null while loading, or for someone on no store's staff yet. */
  summary: ShopSummary | null
  memberships: Membership[]
  loading: boolean
  /** Moves the session to another store and reloads the admin into it. */
  switchTo(shopId: number): Promise<void>
  refresh(): void
}

export const ShopContext = createContext<ShopState | null>(null)

export const shopKeys = {
  current: ['shop', 'current'] as const,
  memberships: ['shop', 'memberships'] as const,
}
