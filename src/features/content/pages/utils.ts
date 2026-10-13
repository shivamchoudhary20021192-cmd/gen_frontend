/**
 * Utility functions for Content Pages module
 */

import type { PageStatus, PageType } from './types'
import {
  PAGE_STATUS_COLORS,
  PAGE_STATUS_LABELS,
  PAGE_TYPE_LABELS,
  VALID_STATUS_TRANSITIONS,
} from './types'

// ── Status & Type Helpers ────────────────────────────────────────────────────

export function getPageTypeLabel(type: PageType): string {
  return PAGE_TYPE_LABELS[type] || type
}

export function getPageStatusLabel(status: PageStatus): string {
  return PAGE_STATUS_LABELS[status] || status
}

export function getPageStatusColor(status: PageStatus): string {
  return PAGE_STATUS_COLORS[status] || '#757575'
}

export function canTransitionTo(currentStatus: PageStatus, targetStatus: PageStatus): boolean {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || []
  return allowedTransitions.includes(targetStatus)
}

export function getAvailableActions(status: PageStatus): Array<{
  action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'review'
  label: string
}> {
  const actions: Array<{ action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'review'; label: string }> = []

  switch (status) {
    case 'draft':
      actions.push({ action: 'publish', label: 'Publish' })
      actions.push({ action: 'archive', label: 'Archive' })
      break
    case 'in_review':
      actions.push({ action: 'review', label: 'Mark as Reviewed' })
      actions.push({ action: 'publish', label: 'Publish' })
      actions.push({ action: 'archive', label: 'Archive' })
      break
    case 'scheduled':
      actions.push({ action: 'publish', label: 'Publish Now' })
      actions.push({ action: 'archive', label: 'Archive' })
      break
    case 'published':
      actions.push({ action: 'unpublish', label: 'Unpublish' })
      actions.push({ action: 'archive', label: 'Archive' })
      break
    case 'archived':
      actions.push({ action: 'restore', label: 'Restore' })
      break
  }

  return actions
}

// ── Date & Time Helpers ──────────────────────────────────────────────────────

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return dateStr
  }
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
  } catch {
    return dateStr
  }
}

export function isScheduledInFuture(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return false
  try {
    const scheduled = new Date(scheduledAt)
    const now = new Date()
    return scheduled > now
  } catch {
    return false
  }
}

export function isExpired(unpublishAt: string | null | undefined): boolean {
  if (!unpublishAt) return false
  try {
    const unpublish = new Date(unpublishAt)
    const now = new Date()
    return unpublish < now
  } catch {
    return false
  }
}

// ── Slug Helpers ─────────────────────────────────────────────────────────────

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Trim hyphens from start/end
}

export function validateSlug(slug: string): boolean {
  // Valid slug: lowercase alphanumeric, hyphens, no spaces
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

// ── URL Helpers ──────────────────────────────────────────────────────────────

export function buildFullPath(parentPath: string | null, slug: string): string {
  if (!parentPath) return `/${slug}`
  return `${parentPath}/${slug}`
}

export function getPreviewUrl(page: { full_path: string; locale: string }): string {
  // This would be configured based on your storefront URL
  const STOREFRONT_BASE = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3000'
  return `${STOREFRONT_BASE}${page.full_path}`
}

// ── Validation Helpers ───────────────────────────────────────────────────────

export function canPublish(page: {
  status: PageStatus
  requires_legal_review: boolean
  reviewed_at: string | null
}): { allowed: boolean; reason?: string } {
  if (page.requires_legal_review && !page.reviewed_at) {
    return {
      allowed: false,
      reason: 'This page requires legal review before publishing',
    }
  }

  const validStatuses: PageStatus[] = ['draft', 'in_review', 'scheduled']
  if (!validStatuses.includes(page.status)) {
    return {
      allowed: false,
      reason: `Cannot publish a page with status "${page.status}"`,
    }
  }

  return { allowed: true }
}

export function canDelete(status: PageStatus): { allowed: boolean; reason?: string } {
  if (status === 'published') {
    return {
      allowed: false,
      reason: 'Cannot delete a published page. Archive it first.',
    }
  }
  return { allowed: true }
}

// ── Search & Filter Helpers ──────────────────────────────────────────────────

export function highlightSearchText(text: string, search: string): string {
  if (!search) return text
  const regex = new RegExp(`(${search})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

export function matchesSearch(text: string, search: string): boolean {
  if (!search) return true
  return text.toLowerCase().includes(search.toLowerCase())
}

// ── Form Helpers ─────────────────────────────────────────────────────────────

export function getEmptyPageForm(pageType: PageType = 'standard') {
  return {
    title: '',
    subtitle: '',
    page_type: pageType,
    template: 'default',
    locale: 'en-IN',
    body_html: '',
    status: 'draft' as PageStatus,
    is_indexable: true,
    show_in_sitemap: true,
    requires_legal_review: false,
  }
}

export function cleanFormData<T extends Record<string, unknown>>(data: T): T {
  const cleaned = { ...data }
  // Remove undefined values
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key]
    }
  })
  return cleaned
}

// ── Section Helpers ──────────────────────────────────────────────────────────

export function getNextSortOrder(sections: Array<{ sort_order: number }>): number {
  if (sections.length === 0) return 0
  const maxOrder = Math.max(...sections.map((s) => s.sort_order))
  return maxOrder + 1
}

export function reorderSectionsList<T extends { id: number; sort_order: number }>(
  sections: T[],
  sourceIndex: number,
  destinationIndex: number,
): T[] {
  const result = Array.from(sections)
  const [removed] = result.splice(sourceIndex, 1)
  result.splice(destinationIndex, 0, removed)

  // Update sort_order to match new positions
  return result.map((section, index) => ({
    ...section,
    sort_order: index,
  }))
}
