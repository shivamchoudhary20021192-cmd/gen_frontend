import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { api } from '../api/client'
import { configureMoney } from '../lib/format'
import { ShopContext, shopKeys, type ShopState } from './shopContext'
import type { Membership, ShopSummary } from './types'

/**
 * The store the admin is working in: its name, currency, plan and status, and
 * the other stores this person can switch to. Everything money-shaped in the
 * admin formats in the store's currency once this has loaded.
 */
export function ShopProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const current = useQuery({
    queryKey: shopKeys.current,
    queryFn: () => api.get<ShopSummary>('/shop'),
    staleTime: 60_000,
  })
  const memberships = useQuery({
    queryKey: shopKeys.memberships,
    queryFn: () => api.get<{ shops: Membership[] }>('/auth/shops'),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    const shop = current.data?.shop
    if (shop) configureMoney(shop.currency, shop.locale)
  }, [current.data])

  const switchTo = useCallback(async (shopId: number) => {
    await api.post('/auth/switch-shop', { shop: shopId })
    // Every cached answer belonged to the old store. A full reload is the
    // simplest way to be certain nothing of it survives on screen.
    queryClient.clear()
    window.location.assign(`${import.meta.env.BASE_URL}dashboard`)
  }, [queryClient])

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['shop'] })
  }, [queryClient])

  const value = useMemo<ShopState>(
    () => ({
      summary: current.data ?? null,
      memberships: memberships.data?.shops ?? [],
      loading: current.isLoading,
      switchTo,
      refresh,
    }),
    [current.data, current.isLoading, memberships.data, switchTo, refresh],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}
