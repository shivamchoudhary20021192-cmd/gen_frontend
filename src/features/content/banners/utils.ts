/**
 * Utility functions for Banners module
 */

import type {
  BannerPlacement,
  BannerAudience,
  BannerStatus,
  LinkType,
  BannerListItem,
  Banner,
} from './types'
import {
  PLACEMENT_LABELS,
  AUDIENCE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  LINK_TYPE_LABELS,
} from './types'

// ── Label Getters ────────────────────────────────────────────────────────────

export function getPlacementLabel(placement: BannerPlacement): string {
  return PLACEMENT_LABELS[placement] || placement
}

export function getAudienceLabel(audience: BannerAudience): string {
  return AUDIENCE_LABELS[audience] || audience
}

export function getStatusLabel(status: BannerStatus): string {
  return STATUS_LABELS[status] || status
}

export function getStatusColor(status: BannerStatus): string {
  return STATUS_COLORS[status] || '#757575'
}

export function getLinkTypeLabel(linkType: LinkType): string {
  return LINK_TYPE_LABELS[linkType] || linkType
}

// ── Status Computation ───────────────────────────────────────────────────────

export function computeBannerStatus(banner: Pick<Banner, 'is_active' | 'starts_at' | 'ends_at'>): BannerStatus {
  if (!banner.is_active) return 'inactive'

  const now = new Date()
  const startsAt = banner.starts_at ? new Date(banner.starts_at) : null
  const endsAt = banner.ends_at ? new Date(banner.ends_at) : null

  if (startsAt && startsAt > now) return 'scheduled'
  if (endsAt && endsAt <= now) return 'expired'
  return 'active'
}

// ── Date Formatting ──────────────────────────────────────────────────────────

export function formatBannerDateRange(starts_at: string | null, ends_at: string | null): string {
  if (!starts_at && !ends_at) return 'Always active'
  if (starts_at && !ends_at) return `From ${formatDate(starts_at)}`
  if (!starts_at && ends_at) return `Until ${formatDate(ends_at)}`
  return `${formatDate(starts_at!)} - ${formatDate(ends_at!)}`
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ── Stats Formatting ─────────────────────────────────────────────────────────

/**
 * Both of these take `unknown` rather than `number` on purpose.
 *
 * The types said number and the API sent "3.03" — a DECIMAL column arrives as a
 * string through mysql2 — so `.toFixed` threw and took the entire admin down to
 * a white screen. The API has been fixed to send a number, but a formatter is
 * the wrong place to find out that it did not: it runs during render, where an
 * exception unmounts the tree rather than showing a bad value in one cell.
 */
export function formatCTR(ctr: unknown): string {
  const value = typeof ctr === 'number' ? ctr : Number(ctr)
  if (ctr === null || ctr === undefined || !Number.isFinite(value)) return 'N/A'
  return `${value.toFixed(2)}%`
}

export function formatNumber(num: unknown): string {
  const value = typeof num === 'number' ? num : Number(num)
  if (!Number.isFinite(value)) return '0'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

// ── Validation ───────────────────────────────────────────────────────────────

export function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(hex)
}

export function validateDateRange(starts_at: string | null, ends_at: string | null): string | null {
  if (!starts_at || !ends_at) return null

  const start = new Date(starts_at)
  const end = new Date(ends_at)

  if (end <= start) {
    return 'End date must be after start date'
  }

  return null
}

// ── Filtering ────────────────────────────────────────────────────────────────

export function filterBannersBySearch(banners: BannerListItem[], search: string): BannerListItem[] {
  if (!search) return banners

  const searchLower = search.toLowerCase()
  return banners.filter(
    (banner) =>
      banner.name.toLowerCase().includes(searchLower) ||
      banner.title?.toLowerCase().includes(searchLower) ||
      getPlacementLabel(banner.placement).toLowerCase().includes(searchLower)
  )
}

export function filterBannersByStatus(banners: BannerListItem[], status: BannerStatus | null): BannerListItem[] {
  if (!status) return banners
  return banners.filter((banner) => banner.status === status)
}

export function filterBannersByPlacement(
  banners: BannerListItem[],
  placement: BannerPlacement | null
): BannerListItem[] {
  if (!placement) return banners
  return banners.filter((banner) => banner.placement === placement)
}

// ── Sorting ──────────────────────────────────────────────────────────────────

export function sortBanners(
  banners: BannerListItem[],
  sortBy: keyof BannerListItem,
  sortOrder: 'asc' | 'desc'
): BannerListItem[] {
  return [...banners].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]

    if (aVal === null || aVal === undefined) return sortOrder === 'asc' ? 1 : -1
    if (bVal === null || bVal === undefined) return sortOrder === 'asc' ? -1 : 1

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })
}

// ── CTA Helpers ──────────────────────────────────────────────────────────────

export function hasCTA(banner: Pick<Banner, 'cta_label' | 'cta_link_type'>): boolean {
  return !!banner.cta_label && banner.cta_link_type !== 'none'
}

export function getCTAValidationError(
  cta_label: string | null,
  cta_link_type: LinkType,
  cta_url: string | null,
  cta_link_ref_id: number | null
): string | null {
  if (!cta_label) return null

  if (cta_link_type === 'none') {
    return 'CTA label requires a link type'
  }

  if (cta_link_type === 'url' && !cta_url) {
    return 'URL link type requires a URL'
  }

  // 'none' already returned above, so only the ref-id link types reach here.
  if (cta_link_type !== 'url' && !cta_link_ref_id) {
    return `${getLinkTypeLabel(cta_link_type)} link type requires a reference ID`
  }

  return null
}

// ── Media Helpers ────────────────────────────────────────────────────────────

export function hasMedia(banner: Pick<Banner, 'desktop_media_id' | 'mobile_media_id'>): boolean {
  return !!banner.desktop_media_id || !!banner.mobile_media_id
}

export function getMediaDescription(
  desktop_media_id: number | null,
  mobile_media_id: number | null
): string {
  if (desktop_media_id && mobile_media_id) return 'Desktop & Mobile'
  if (desktop_media_id) return 'Desktop only'
  if (mobile_media_id) return 'Mobile only'
  return 'No media'
}

// ── Array Helpers ────────────────────────────────────────────────────────────

export function toggleArrayItem<T>(array: T[], item: T): T[] {
  const index = array.indexOf(item)
  if (index === -1) {
    return [...array, item]
  }
  return array.filter((_, i) => i !== index)
}

export function isAllSelected<T>(items: T[], selectedItems: T[]): boolean {
  return items.length > 0 && items.every((item) => selectedItems.includes(item))
}

export function toggleSelectAll<T>(items: T[], selectedItems: T[]): T[] {
  return isAllSelected(items, selectedItems) ? [] : [...items]
}
