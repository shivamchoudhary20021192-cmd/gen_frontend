import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { navigationKeys, type MenuItemAdmin } from '../../navigation/useNavigation'

export interface MenuItemPatch {
  title?: string
  subtitle?: string | null
  icon?: string | null
  section?: string | null
  sort_order?: number
  status?: 'available' | 'coming_soon' | 'hidden'
  is_active?: boolean
  permission_slugs?: string[]
}

export interface PermissionOption {
  id: number
  slug: string
  action: string
  name: string
  description: string | null
  is_dangerous: boolean
}

/**
 * Every menu mutation invalidates BOTH caches: the admin table it just changed
 * and the sidebar the change is meant to be visible in. Without the second
 * invalidation you rename an item, the table updates, and the sidebar keeps the
 * old label until the 5-minute refetch — which reads as a broken save.
 */
function useMenuMutation<TArgs>(fn: (args: TArgs) => Promise<{ menu_items: MenuItemAdmin[] }>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(navigationKeys.items, data)
      void queryClient.invalidateQueries({ queryKey: navigationKeys.menu })
    },
  })
}

export function useUpdateMenuItem() {
  return useMenuMutation<{ id: number; patch: MenuItemPatch }>(({ id, patch }) =>
    api.patch<{ menu_items: MenuItemAdmin[] }>(`/menu-items/${id}`, { menu_item: patch }),
  )
}

export function useReorderMenuItems() {
  return useMenuMutation<{ id: number; sort_order: number }[]>((items) =>
    api.post<{ menu_items: MenuItemAdmin[] }>('/menu-items/reorder', { items }),
  )
}

export function usePermissionOptions(enabled = true) {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () =>
      api.get<{ permissions: Record<string, PermissionOption[]>; total: number }>('/permissions'),
    staleTime: 10 * 60_000,
    enabled,
  })
}
