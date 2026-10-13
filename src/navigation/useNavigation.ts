import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export interface MenuBadge {
  key: string
  count: number
  variant: 'default' | 'info' | 'warning' | 'error' | 'success'
}

export interface MenuNode {
  id: number
  key: string
  title: string
  subtitle: string | null
  hover_description: string | null
  icon: string | null
  icon_color: string | null
  icon_type: 'material' | 'custom' | 'emoji'
  route: string | null
  active_match: string[]
  section: string | null
  group_key: string | null
  badge: MenuBadge | null
  status: 'available' | 'coming_soon'
  is_external: boolean
  opens_new_tab: boolean
  keyboard_shortcut: string | null
  divider_after: boolean
  show_in_collapsed: boolean
  is_pinnable: boolean
  analytics_key: string | null
  metadata: Record<string, any> | null
  children: MenuNode[]
}

export interface MenuSection {
  section: string
  items: MenuNode[]
}

interface MenuResponse {
  sections: MenuSection[]
  flat: { key: string; route: string | null; status: string }[]
  generated_at: string
}

export const navigationKeys = {
  menu: ['menu-navigation'] as const,
  items: ['menu-items'] as const,
}

/**
 * The sidebar comes from the server, already scoped to this admin's
 * permissions. Badge counts go stale quickly (open tickets, low stock), so it
 * refetches on an interval and when the tab regains focus — this is one of the
 * few queries where refetchOnWindowFocus genuinely earns its keep.
 */
export function useNavigation() {
  return useQuery({
    queryKey: navigationKeys.menu,
    queryFn: () => api.get<MenuResponse>('/menu-navigation'),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
}

export interface MenuItemAdmin {
  id: number
  parent_id: number | null
  key: string
  title: string
  subtitle: string | null
  icon: string | null
  route: string | null
  section: string | null
  badge_key: string | null
  sort_order: number
  status: 'available' | 'coming_soon' | 'hidden'
  is_active: boolean
  requires_super_admin: boolean
  is_system: boolean
  permissions: string[]
}

/** Super-admin view of every row, including hidden ones. */
export function useMenuItems(enabled = true) {
  return useQuery({
    queryKey: navigationKeys.items,
    queryFn: () => api.get<{ menu_items: MenuItemAdmin[] }>('/menu-items'),
    enabled,
  })
}
