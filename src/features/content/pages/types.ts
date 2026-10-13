/**
 * Frontend types for Content Pages module
 * Mirrors the backend API response shapes
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type PageType =
  | 'home'
  | 'standard'
  | 'landing'
  | 'policy'
  | 'about'
  | 'support'
  | 'concern'
  | 'ingredient_library'
  | 'custom'

export type PageStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'

export type SectionType =
  | 'announcement_bar'
  | 'hero'
  | 'trust_strip'
  | 'two_product_routine'
  | 'ingredient_story'
  | 'texture_proof'
  | 'evidence_results'
  | 'reviews_ugc'
  | 'education_articles'
  | 'founder_note'
  | 'optin'
  | 'faq'
  | 'rich_text'
  | 'image_with_text'
  | 'product_grid'
  | 'collection_banner'
  | 'comparison_table'
  | 'support_panel'

export type PaddingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl'

// ── Page Models ──────────────────────────────────────────────────────────────

export interface PageListItem {
  id: number
  public_id: string
  slug: string
  title: string
  page_type: PageType
  status: PageStatus
  locale: string
  is_indexable: boolean
  show_in_sitemap: boolean
  section_count: number
  author_name: string | null
  published_at: string | null
  scheduled_at: string | null
  unpublish_at: string | null
  created_at: string
  updated_at: string
}

export interface Page {
  id: number
  public_id: string
  slug: string
  title: string
  subtitle: string | null
  page_type: PageType
  template: string
  locale: string
  body_html: string | null
  body_json: Record<string, unknown> | null
  hero_media_id: number | null
  status: PageStatus
  scheduled_at: string | null
  unpublish_at: string | null
  requires_legal_review: boolean
  review_due_at: string | null
  reviewed_at: string | null
  reviewed_by: number | null
  is_indexable: boolean
  show_in_sitemap: boolean
  canonical_url: string | null
  meta_title: string | null
  meta_description: string | null
  parent_id: number | null
  full_path: string
  level: number
  current_version: number
  author_id: number
  published_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PageWithRelations extends Page {
  sections: PageSection[]
  author: {
    id: number
    name: string
    email: string
  }
  reviewer: {
    id: number
    name: string
    email: string
  } | null
  hero_media: {
    id: number
    url: string
    alt_text: string | null
  } | null
  parent: {
    id: number
    title: string
    slug: string
  } | null
}

// ── Section Models ───────────────────────────────────────────────────────────

export interface PageSection {
  id: number
  page_id: number
  section_key: SectionType
  name: string | null
  sort_order: number
  is_enabled: boolean
  settings: Record<string, unknown> | null
  background: string | null
  padding_top: PaddingSize | null
  padding_bottom: PaddingSize | null
  visible_from: string | null
  visible_until: string | null
  created_at: string
  updated_at: string
  blocks?: SectionBlock[]
}

export interface SectionBlock {
  id: number
  section_id: number
  block_key: string
  sort_order: number
  content: Record<string, unknown>
  media_id: number | null
  created_at: string
  updated_at: string
}

// ── API Request DTOs ─────────────────────────────────────────────────────────

export interface CreatePageDto {
  slug?: string
  title: string
  subtitle?: string
  page_type: PageType
  template?: string
  locale?: string
  body_html?: string
  body_json?: Record<string, unknown>
  hero_media_id?: number
  status?: PageStatus
  scheduled_at?: string
  unpublish_at?: string
  requires_legal_review?: boolean
  review_due_at?: string
  is_indexable?: boolean
  show_in_sitemap?: boolean
  canonical_url?: string
  meta_title?: string
  meta_description?: string
  parent_id?: number
}

export interface UpdatePageDto {
  slug?: string
  title?: string
  subtitle?: string
  page_type?: PageType
  template?: string
  locale?: string
  body_html?: string
  body_json?: Record<string, unknown>
  hero_media_id?: number
  status?: PageStatus
  scheduled_at?: string
  unpublish_at?: string
  requires_legal_review?: boolean
  review_due_at?: string
  is_indexable?: boolean
  show_in_sitemap?: boolean
  canonical_url?: string
  meta_title?: string
  meta_description?: string
  parent_id?: number
}

export interface PublishPageDto {
  scheduled_at?: string
  unpublish_at?: string
}

export interface CreateSectionDto {
  section_key: SectionType
  name?: string
  sort_order?: number
  is_enabled?: boolean
  settings?: Record<string, unknown>
  background?: string
  padding_top?: PaddingSize
  padding_bottom?: PaddingSize
  visible_from?: string
  visible_until?: string
}

export interface UpdateSectionDto {
  section_key?: SectionType
  name?: string
  sort_order?: number
  is_enabled?: boolean
  settings?: Record<string, unknown>
  background?: string
  padding_top?: PaddingSize
  padding_bottom?: PaddingSize
  visible_from?: string
  visible_until?: string
}

export interface ReorderSectionsDto {
  sections: Array<{
    id: number
    sort_order: number
  }>
}

export interface BulkUpdatePagesDto {
  ids: number[]
  status: PageStatus
}

// ── API Query Params ─────────────────────────────────────────────────────────

export interface ListPagesParams {
  page?: number
  limit?: number
  sort_by?: 'title' | 'status' | 'updated_at' | 'created_at'
  sort_order?: 'asc' | 'desc'
  search?: string
  status?: PageStatus | PageStatus[]
  page_type?: PageType | PageType[]
  author_id?: number
  requires_legal_review?: boolean
  is_indexable?: boolean
  created_after?: string
  created_before?: string
  published_after?: string
  published_before?: string
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ListPagesResponse {
  data: PageListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface AddSectionResponse {
  section_id: number
  page: PageWithRelations
}

export interface BulkUpdateResponse {
  success: boolean
  updated_count: number
  total_count: number
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  home: 'Home',
  standard: 'Standard',
  landing: 'Landing',
  policy: 'Policy',
  about: 'About',
  support: 'Support',
  concern: 'Concern',
  ingredient_library: 'Ingredient Library',
  custom: 'Custom',
}

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

export const PAGE_STATUS_COLORS: Record<PageStatus, string> = {
  draft: '#757575',
  in_review: '#F57C00',
  scheduled: '#1976D2',
  published: '#2E7D32',
  archived: '#616161',
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  announcement_bar: 'Announcement Bar',
  hero: 'Hero',
  trust_strip: 'Trust Strip',
  two_product_routine: 'Two Product Routine',
  ingredient_story: 'Ingredient Story',
  texture_proof: 'Texture Proof',
  evidence_results: 'Evidence & Results',
  reviews_ugc: 'Reviews & UGC',
  education_articles: 'Education Articles',
  founder_note: 'Founder Note',
  optin: 'Email Opt-in',
  faq: 'FAQ',
  rich_text: 'Rich Text',
  image_with_text: 'Image with Text',
  product_grid: 'Product Grid',
  collection_banner: 'Collection Banner',
  comparison_table: 'Comparison Table',
  support_panel: 'Support Panel',
}

export const PADDING_SIZE_LABELS: Record<PaddingSize, string> = {
  none: 'None',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
}

// ── Valid Status Transitions ─────────────────────────────────────────────────

export const VALID_STATUS_TRANSITIONS: Record<PageStatus, PageStatus[]> = {
  draft: ['in_review', 'published', 'archived'],
  in_review: ['draft', 'published', 'archived'],
  scheduled: ['draft', 'published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
}
