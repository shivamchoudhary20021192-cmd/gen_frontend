/**
 * Utility functions for FAQs module
 */

import type { EntityType, FAQListItem, FAQ } from './types'
import { ENTITY_TYPE_LABELS } from './types'

// ── Label Getters ────────────────────────────────────────────────────────────

export function getEntityTypeLabel(entityType: EntityType): string {
  return ENTITY_TYPE_LABELS[entityType] || entityType
}

// ── Date Formatting ──────────────────────────────────────────────────────────

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

// ── Number Formatting ────────────────────────────────────────────────────────

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

// ── Slug Generation ──────────────────────────────────────────────────────────

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateQuestion(question: string): string | null {
  if (!question || !question.trim()) {
    return 'Question is required'
  }

  if (question.length > 500) {
    return 'Question must be 500 characters or less'
  }

  return null
}

export function validateAnswer(answer: string): string | null {
  if (!answer || !answer.trim()) {
    return 'Answer is required'
  }

  return null
}

export function validateSlug(slug: string): string | null {
  if (!slug || !slug.trim()) {
    return 'Slug is required'
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Slug can only contain lowercase letters, numbers, and hyphens'
  }

  if (slug.length > 140) {
    return 'Slug must be 140 characters or less'
  }

  return null
}

export function validateEntityRelation(
  entityType: EntityType | null,
  entityId: number | null
): string | null {
  if (entityType && !entityId) {
    return 'Entity ID is required when entity type is specified'
  }

  if (!entityType && entityId) {
    return 'Entity type is required when entity ID is specified'
  }

  return null
}

// ── Filtering ────────────────────────────────────────────────────────────────

export function filterFAQsBySearch(faqs: FAQListItem[], search: string): FAQListItem[] {
  if (!search) return faqs

  const searchLower = search.toLowerCase()
  return faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchLower) ||
      faq.answer.toLowerCase().includes(searchLower) ||
      faq.group_name?.toLowerCase().includes(searchLower)
  )
}

export function filterFAQsByGroup(faqs: FAQListItem[], groupId: number | null): FAQListItem[] {
  if (groupId === null) return faqs
  return faqs.filter((faq) => faq.group_id === groupId)
}

export function filterFAQsByPublished(faqs: FAQListItem[], isPublished: boolean | null): FAQListItem[] {
  if (isPublished === null) return faqs
  return faqs.filter((faq) => faq.is_published === isPublished)
}

export function filterFAQsByEntityType(faqs: FAQListItem[], entityType: EntityType | null): FAQListItem[] {
  if (!entityType) return faqs
  return faqs.filter((faq) => faq.entity_type === entityType)
}

// ── Sorting ──────────────────────────────────────────────────────────────────

export function sortFAQs(
  faqs: FAQListItem[],
  sortBy: keyof FAQListItem,
  sortOrder: 'asc' | 'desc'
): FAQListItem[] {
  return [...faqs].sort((a, b) => {
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

// ── Status Helpers ───────────────────────────────────────────────────────────

export function getPublishedStatusLabel(isPublished: boolean): string {
  return isPublished ? 'Published' : 'Draft'
}

export function getPublishedStatusColor(isPublished: boolean): string {
  return isPublished ? '#2E7D32' : '#757575'
}

export function getIndexableLabel(isIndexable: boolean): string {
  return isIndexable ? 'Indexed' : 'Not Indexed'
}

// ── Entity Display ───────────────────────────────────────────────────────────

export function formatEntityReference(entityType: EntityType | null, entityId: number | null): string {
  if (!entityType || !entityId) return 'General'
  return `${getEntityTypeLabel(entityType)} #${entityId}`
}

export function hasEntityReference(faq: Pick<FAQ, 'entity_type' | 'entity_id'>): boolean {
  return !!faq.entity_type && !!faq.entity_id
}

// ── Text Helpers ─────────────────────────────────────────────────────────────

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

export function getAnswerPreview(answer: string, maxLength: number = 100): string {
  const plainText = stripHtmlTags(answer)
  return truncateText(plainText, maxLength)
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

// ── Sort Order Management ────────────────────────────────────────────────────

export function reorderItems<T extends { id: number; sort_order: number }>(
  items: T[],
  fromIndex: number,
  toIndex: number
): Array<{ id: number; sort_order: number }> {
  const reordered = [...items]
  const [removed] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, removed)

  return reordered.map((item, index) => ({
    id: item.id,
    sort_order: index * 10, // Use increments of 10 for future insertions
  }))
}
