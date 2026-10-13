/**
 * API client for Navigation module (CMS Menus)
 * Wraps the base API client with type-safe methods
 */

import { api } from '../../api/client'
import type {
  Menu,
  MenuWithItems,
  MenuItemWithMedia,
  CreateMenuDto,
  UpdateMenuDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  BulkReorderMenuItemsDto,
  ListMenusParams,
  ListMenuItemsParams,
  ListMenusResponse,
  ListMenuItemsResponse,
} from './types'

const MENUS_PATH = '/cms/menus'
const MENU_ITEMS_PATH = '/cms/menu-items'

// ══════════════════════════════════════════════════════════════════════════════
// MENUS API
// ══════════════════════════════════════════════════════════════════════════════

export async function listMenus(
  params?: ListMenusParams,
  signal?: AbortSignal
): Promise<ListMenusResponse> {
  const query: Record<string, string | number | boolean | undefined> = {}

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value
      }
    })
  }

  return api.get<ListMenusResponse>(MENUS_PATH, query, signal)
}

export async function getMenuById(id: number, signal?: AbortSignal): Promise<Menu> {
  return api.get<Menu>(`${MENUS_PATH}/${id}`, undefined, signal)
}

export async function getMenuBySlug(slug: string, signal?: AbortSignal): Promise<Menu> {
  return api.get<Menu>(`${MENUS_PATH}/slug/${slug}`, undefined, signal)
}

export async function getMenuWithItems(id: number, signal?: AbortSignal): Promise<MenuWithItems> {
  return api.get<MenuWithItems>(`${MENUS_PATH}/${id}/items`, undefined, signal)
}

export async function createMenu(data: CreateMenuDto): Promise<Menu> {
  return api.post<Menu>(MENUS_PATH, data)
}

export async function updateMenu(id: number, data: UpdateMenuDto): Promise<Menu> {
  return api.put<Menu>(`${MENUS_PATH}/${id}`, data)
}

export async function deleteMenu(id: number): Promise<void> {
  return api.delete<void>(`${MENUS_PATH}/${id}`)
}

// ══════════════════════════════════════════════════════════════════════════════
// MENU ITEMS API
// ══════════════════════════════════════════════════════════════════════════════

export async function listMenuItems(
  params?: ListMenuItemsParams,
  signal?: AbortSignal
): Promise<ListMenuItemsResponse> {
  const query: Record<string, string | number | boolean | undefined> = {}

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value
      }
    })
  }

  return api.get<ListMenuItemsResponse>(MENU_ITEMS_PATH, query, signal)
}

export async function getMenuItemById(id: number, signal?: AbortSignal): Promise<MenuItemWithMedia> {
  return api.get<MenuItemWithMedia>(`${MENU_ITEMS_PATH}/${id}`, undefined, signal)
}

export async function createMenuItem(data: CreateMenuItemDto): Promise<MenuItemWithMedia> {
  return api.post<MenuItemWithMedia>(MENU_ITEMS_PATH, data)
}

export async function updateMenuItem(id: number, data: UpdateMenuItemDto): Promise<MenuItemWithMedia> {
  return api.put<MenuItemWithMedia>(`${MENU_ITEMS_PATH}/${id}`, data)
}

export async function deleteMenuItem(id: number): Promise<void> {
  return api.delete<void>(`${MENU_ITEMS_PATH}/${id}`)
}

export async function bulkReorderMenuItems(data: BulkReorderMenuItemsDto): Promise<void> {
  return api.post<void>(`${MENU_ITEMS_PATH}/bulk-reorder`, data)
}

