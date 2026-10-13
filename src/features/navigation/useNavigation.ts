/**
 * React Query hooks for Navigation module (CMS Menus)
 * Handles data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import type {
  Menu,
  MenuWithItems,
  MenuItemWithMedia,
  ListMenusParams,
  ListMenuItemsParams,
  ListMenusResponse,
  ListMenuItemsResponse,
  CreateMenuDto,
  UpdateMenuDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  BulkReorderMenuItemsDto,
} from './types'
import * as navigationApi from './api'

// ── Query Keys ───────────────────────────────────────────────────────────────

export const navigationKeys = {
  // Menus
  allMenus: ['cms-menus'] as const,
  menuLists: () => [...navigationKeys.allMenus, 'list'] as const,
  menuList: (params?: ListMenusParams) => [...navigationKeys.menuLists(), params] as const,
  menuDetails: () => [...navigationKeys.allMenus, 'detail'] as const,
  menuDetail: (id: number) => [...navigationKeys.menuDetails(), id] as const,
  menuBySlug: (slug: string) => [...navigationKeys.allMenus, 'slug', slug] as const,
  menuWithItems: (id: number) => [...navigationKeys.allMenus, 'with-items', id] as const,

  // Menu Items
  allMenuItems: ['cms-menu-items'] as const,
  menuItemLists: () => [...navigationKeys.allMenuItems, 'list'] as const,
  menuItemList: (params?: ListMenuItemsParams) => [...navigationKeys.menuItemLists(), params] as const,
  menuItemDetails: () => [...navigationKeys.allMenuItems, 'detail'] as const,
  menuItemDetail: (id: number) => [...navigationKeys.menuItemDetails(), id] as const,
}

// ══════════════════════════════════════════════════════════════════════════════
// MENUS HOOKS
// ══════════════════════════════════════════════════════════════════════════════

export function useMenus(
  params?: ListMenusParams,
  options?: UseQueryOptions<ListMenusResponse>
) {
  return useQuery({
    queryKey: navigationKeys.menuList(params),
    queryFn: ({ signal }) => navigationApi.listMenus(params, signal),
    ...options,
  })
}

export function useMenu(id: number, options?: UseQueryOptions<Menu>) {
  return useQuery({
    queryKey: navigationKeys.menuDetail(id),
    queryFn: ({ signal }) => navigationApi.getMenuById(id, signal),
    enabled: id > 0,
    ...options,
  })
}

export function useMenuBySlug(slug: string, options?: UseQueryOptions<Menu>) {
  return useQuery({
    queryKey: navigationKeys.menuBySlug(slug),
    queryFn: ({ signal }) => navigationApi.getMenuBySlug(slug, signal),
    enabled: !!slug,
    ...options,
  })
}

export function useMenuWithItems(id: number, options?: UseQueryOptions<MenuWithItems>) {
  return useQuery({
    queryKey: navigationKeys.menuWithItems(id),
    queryFn: ({ signal }) => navigationApi.getMenuWithItems(id, signal),
    enabled: id > 0,
    ...options,
  })
}

export function useCreateMenu() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMenuDto) => navigationApi.createMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuLists() })
    },
  })
}

export function useUpdateMenu() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMenuDto }) =>
      navigationApi.updateMenu(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuLists() })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuWithItems(variables.id) })
    },
  })
}

export function useDeleteMenu() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => navigationApi.deleteMenu(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuLists() })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuItemLists() })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// MENU ITEMS HOOKS
// ══════════════════════════════════════════════════════════════════════════════

export function useMenuItems(
  params?: ListMenuItemsParams,
  options?: UseQueryOptions<ListMenuItemsResponse>
) {
  return useQuery({
    queryKey: navigationKeys.menuItemList(params),
    queryFn: ({ signal }) => navigationApi.listMenuItems(params, signal),
    ...options,
  })
}

export function useMenuItem(id: number, options?: UseQueryOptions<MenuItemWithMedia>) {
  return useQuery({
    queryKey: navigationKeys.menuItemDetail(id),
    queryFn: ({ signal }) => navigationApi.getMenuItemById(id, signal),
    enabled: id > 0,
    ...options,
  })
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMenuItemDto) => navigationApi.createMenuItem(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuItemLists() })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuWithItems(data.menu_id) })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuLists() })
    },
  })
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMenuItemDto }) =>
      navigationApi.updateMenuItem(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuItemLists() })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuItemDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuWithItems(data.menu_id) })
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuLists() })
    },
  })
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => navigationApi.deleteMenuItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuItemLists() })
      queryClient.invalidateQueries({ queryKey: navigationKeys.allMenus })
    },
  })
}

export function useBulkReorderMenuItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkReorderMenuItemsDto) => navigationApi.bulkReorderMenuItems(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: navigationKeys.menuItemLists() })
      queryClient.invalidateQueries({ queryKey: navigationKeys.allMenus })
    },
  })
}

