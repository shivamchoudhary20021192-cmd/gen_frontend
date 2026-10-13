/**
 * Frontend types for FAQs module
 * Mirrors the backend API response shapes
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type EntityType = 'product' | 'cms_page' | 'collection' | 'category' | 'article'

// ── FAQ Group Models ─────────────────────────────────────────────────────────

export interface FAQGroupListItem {
  id: number
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  faq_count: number
  created_at: string
  updated_at: string
}

export interface FAQGroup {
  id: number
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── FAQ Models ───────────────────────────────────────────────────────────────

export interface FAQListItem {
  id: number
  group_id: number | null
  group_name: string | null
  group_slug: string | null
  entity_type: EntityType | null
  entity_id: number | null
  question: string
  answer: string
  claim_id: number | null
  sort_order: number
  is_published: boolean
  is_indexable: boolean
  helpful_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface FAQ {
  id: number
  group_id: number | null
  entity_type: EntityType | null
  entity_id: number | null
  question: string
  answer: string
  claim_id: number | null
  sort_order: number
  is_published: boolean
  is_indexable: boolean
  helpful_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface FAQWithRelations extends FAQ {
  group: {
    id: number
    slug: string
    name: string
  } | null
}

// ── API Request DTOs ─────────────────────────────────────────────────────────

export interface CreateFAQGroupDto {
  slug?: string
  name: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface UpdateFAQGroupDto {
  slug?: string
  name?: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface CreateFAQDto {
  group_id?: number | null
  entity_type?: EntityType | null
  entity_id?: number | null
  question: string
  answer: string
  claim_id?: number | null
  sort_order?: number
  is_published?: boolean
  is_indexable?: boolean
}

export interface UpdateFAQDto {
  group_id?: number | null
  entity_type?: EntityType | null
  entity_id?: number | null
  question?: string
  answer?: string
  claim_id?: number | null
  sort_order?: number
  is_published?: boolean
  is_indexable?: boolean
}

export interface BulkUpdateSortOrderDto {
  updates: Array<{
    id: number
    sort_order: number
  }>
}

// ── API Query Params ─────────────────────────────────────────────────────────

export interface ListFAQGroupsParams {
  page?: number
  limit?: number
  sort_by?: 'name' | 'sort_order' | 'created_at'
  sort_order?: 'asc' | 'desc'
  search?: string
  is_active?: boolean
}

export interface ListFAQsParams {
  page?: number
  limit?: number
  sort_by?: 'question' | 'group_id' | 'sort_order' | 'helpful_count' | 'created_at' | 'updated_at'
  sort_order?: 'asc' | 'desc'
  search?: string
  group_id?: number
  entity_type?: EntityType
  entity_id?: number
  is_published?: boolean
  is_indexable?: boolean
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ListFAQGroupsResponse {
  data: FAQGroupListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ListFAQsResponse {
  data: FAQListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  product: 'Product',
  cms_page: 'CMS Page',
  collection: 'Collection',
  category: 'Category',
  article: 'Article',
}

export const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({
  value: value as EntityType,
  label,
}))
