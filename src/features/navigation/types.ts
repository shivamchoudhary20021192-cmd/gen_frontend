/**
 * Frontend types for Navigation module (CMS Menus)
 * Mirrors the backend API response shapes
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type LinkType = 
  | 'url'
  | 'page'
  | 'category'
  | 'collection'
  | 'product'
  | 'article'
  | 'policy'
  | 'ingredient'
  | 'routine'
  | 'none'

// ── Menu Models ──────────────────────────────────────────────────────────────

export interface Menu {
  id: number
  slug: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuListItem {
  id: number
  slug: string
  name: string
  is_active: boolean
  item_count: number
  created_at: string
  updated_at: string
}

export interface MenuWithItems extends Menu {
  items: MenuItemTreeNode[]
}

// ── Menu Item Models ─────────────────────────────────────────────────────────

export interface MenuItem {
  id: number
  menu_id: number
  parent_id: number | null
  label: string
  link_type: LinkType
  link_ref_id: number | null
  url: string | null
  icon_media_id: number | null
  image_media_id: number | null
  badge_label: string | null
  description: string | null
  sort_order: number
  opens_new_tab: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuItemWithMedia extends MenuItem {
  icon_url: string | null
  image_url: string | null
}

export interface MenuItemTreeNode extends MenuItemWithMedia {
  children: MenuItemTreeNode[]
}

// ── API Request DTOs ─────────────────────────────────────────────────────────

export interface CreateMenuDto {
  slug?: string
  name: string
  is_active?: boolean
}

export interface UpdateMenuDto {
  slug?: string
  name?: string
  is_active?: boolean
}

export interface CreateMenuItemDto {
  menu_id: number
  parent_id?: number | null
  label: string
  link_type: LinkType
  link_ref_id?: number | null
  url?: string | null
  icon_media_id?: number | null
  image_media_id?: number | null
  badge_label?: string | null
  description?: string | null
  sort_order?: number
  opens_new_tab?: boolean
  is_active?: boolean
}

export interface UpdateMenuItemDto {
  parent_id?: number | null
  label?: string
  link_type?: LinkType
  link_ref_id?: number | null
  url?: string | null
  icon_media_id?: number | null
  image_media_id?: number | null
  badge_label?: string | null
  description?: string | null
  sort_order?: number
  opens_new_tab?: boolean
  is_active?: boolean
}

export interface BulkReorderMenuItemsDto {
  updates: Array<{
    id: number
    parent_id: number | null
    sort_order: number
  }>
}

// ── API Query Params ─────────────────────────────────────────────────────────

export interface ListMenusParams {
  is_active?: boolean
}

export interface ListMenuItemsParams {
  menu_id?: number
  parent_id?: number | 'root'
  link_type?: LinkType
  is_active?: boolean
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ListMenusResponse {
  data: MenuListItem[]
}

export interface ListMenuItemsResponse {
  data: MenuItemWithMedia[]
}

// ── Constants ────────────────────────────────────────────────────────────────

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  url: 'External URL',
  page: 'CMS Page',
  category: 'Category',
  collection: 'Collection',
  product: 'Product',
  article: 'Article',
  policy: 'Policy Page',
  ingredient: 'Ingredient',
  routine: 'Routine',
  none: 'Non-clickable (parent only)',
}

export const LINK_TYPE_OPTIONS = Object.entries(LINK_TYPE_LABELS).map(([value, label]) => ({
  value: value as LinkType,
  label,
}))

// ── Helper Types for Drag & Drop ────────────────────────────────────────────

export interface FlatMenuItem {
  id: number
  parent_id: number | null
  sort_order: number
  level: number
}

export interface DragDropResult {
  draggedId: number
  newParentId: number | null
  newSortOrder: number
}

