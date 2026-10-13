/**
 * Frontend types for Content Banners module
 * Mirrors the backend API response shapes
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type BannerPlacement =
  | 'announcement_bar'
  | 'home_hero'
  | 'home_carousel'
  | 'category_top'
  | 'pdp_strip'
  | 'cart_drawer'
  | 'checkout'
  | 'popup'
  | 'footer'

export type BannerAudience = 'all' | 'new_visitors' | 'returning' | 'logged_in' | 'guests'

export type BannerStatus = 'scheduled' | 'active' | 'expired' | 'inactive'

export type LinkType = 'none' | 'url' | 'page' | 'category' | 'collection' | 'product' | 'article'

// ── Banner Models ────────────────────────────────────────────────────────────

export interface BannerListItem {
  id: number
  name: string
  placement: BannerPlacement
  title: string | null
  audience: BannerAudience
  starts_at: string | null
  ends_at: string | null
  priority: number
  is_active: boolean
  impression_count: number
  click_count: number
  ctr: number | null
  creator_name: string | null
  created_at: string
  updated_at: string
  status: BannerStatus
}

export interface Banner {
  id: number
  name: string
  placement: BannerPlacement
  title: string | null
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_link_type: LinkType
  cta_link_ref_id: number | null
  cta_url: string | null
  desktop_media_id: number | null
  mobile_media_id: number | null
  poster_media_id: number | null
  background_hex: string | null
  text_hex: string | null
  audience: BannerAudience
  starts_at: string | null
  ends_at: string | null
  priority: number
  is_active: boolean
  is_dismissible: boolean
  impression_count: number
  click_count: number
  created_by_admin_id: number | null
  created_at: string
  updated_at: string
}

export interface BannerWithRelations extends Banner {
  creator: {
    id: number
    name: string
    email: string
  } | null
  desktop_media: {
    id: number
    url: string
    alt_text: string | null
    /** The desktop slot holds either, so the form has to know which. */
    media_type: 'image' | 'video'
    duration_ms: number | null
    size_bytes: number | null
    /** The frame taken out of a video on upload. Null for an image. */
    auto_poster_url: string | null
  } | null
  mobile_media: {
    id: number
    url: string
    alt_text: string | null
    media_type: 'image' | 'video'
  } | null
  /** A poster chosen by hand, which wins over the auto-extracted frame. */
  poster_media: {
    id: number
    url: string
    alt_text: string | null
  } | null
}

// ── API Request DTOs ─────────────────────────────────────────────────────────

export interface CreateBannerDto {
  name: string
  placement: BannerPlacement
  title?: string
  subtitle?: string
  body?: string
  cta_label?: string
  cta_link_type?: LinkType
  cta_link_ref_id?: number
  cta_url?: string
  desktop_media_id?: number
  mobile_media_id?: number
  poster_media_id?: number | null
  background_hex?: string
  text_hex?: string
  audience?: BannerAudience
  starts_at?: string
  ends_at?: string
  priority?: number
  is_active?: boolean
  is_dismissible?: boolean
}

export interface UpdateBannerDto {
  name?: string
  placement?: BannerPlacement
  title?: string
  subtitle?: string
  body?: string
  cta_label?: string
  cta_link_type?: LinkType
  cta_link_ref_id?: number
  cta_url?: string
  /**
   * Nullable on update, and that matters: the API reads an omitted key as
   * "leave it alone", so a media slot the author cleared has to travel as an
   * explicit null or the picture simply comes back on the next load.
   */
  desktop_media_id?: number | null
  mobile_media_id?: number | null
  poster_media_id?: number | null
  background_hex?: string
  text_hex?: string
  audience?: BannerAudience
  starts_at?: string
  ends_at?: string
  priority?: number
  is_active?: boolean
  is_dismissible?: boolean
}

export interface BannerStatsDto {
  banner_id: number
  impressions?: number
  clicks?: number
}

export interface BulkUpdateBannersDto {
  ids: number[]
}

// ── API Query Params ─────────────────────────────────────────────────────────

export interface ListBannersParams {
  page?: number
  limit?: number
  sort_by?: 'name' | 'placement' | 'priority' | 'created_at' | 'updated_at'
  sort_order?: 'asc' | 'desc'
  search?: string
  placement?: BannerPlacement | BannerPlacement[]
  audience?: BannerAudience | BannerAudience[]
  is_active?: boolean
  status?: BannerStatus
  creator_id?: number
  starts_after?: string
  starts_before?: string
  ends_after?: string
  ends_before?: string
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ListBannersResponse {
  data: BannerListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface BulkUpdateResponse {
  updated_count: number
}

export interface BannerStatsSummary {
  total_banners: number
  active_banners: number
  total_impressions: number
  total_clicks: number
  average_ctr: number
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  announcement_bar: 'Announcement Bar',
  home_hero: 'Home Hero',
  home_carousel: 'Home Carousel',
  category_top: 'Category Top',
  pdp_strip: 'Product Page Strip',
  cart_drawer: 'Cart Drawer',
  checkout: 'Checkout',
  popup: 'Popup',
  footer: 'Footer',
}

export const AUDIENCE_LABELS: Record<BannerAudience, string> = {
  all: 'All Visitors',
  new_visitors: 'New Visitors',
  returning: 'Returning Visitors',
  logged_in: 'Logged In Users',
  guests: 'Guest Users',
}

export const STATUS_LABELS: Record<BannerStatus, string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  expired: 'Expired',
  inactive: 'Inactive',
}

export const STATUS_COLORS: Record<BannerStatus, string> = {
  scheduled: '#1976D2',
  active: '#2E7D32',
  expired: '#757575',
  inactive: '#616161',
}

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  none: 'No Link',
  url: 'URL',
  page: 'Page',
  category: 'Category',
  collection: 'Collection',
  product: 'Product',
  article: 'Article',
}
