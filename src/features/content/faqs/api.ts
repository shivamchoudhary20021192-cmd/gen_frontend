/**
 * API client for FAQs module
 * Wraps the base API client with type-safe methods
 */

import { api } from '../../../api/client'
import type {
  FAQGroup,
  FAQWithRelations,
  CreateFAQGroupDto,
  UpdateFAQGroupDto,
  CreateFAQDto,
  UpdateFAQDto,
  ListFAQGroupsParams,
  ListFAQsParams,
  ListFAQGroupsResponse,
  ListFAQsResponse,
  BulkUpdateSortOrderDto,
} from './types'

const FAQ_GROUPS_PATH = '/content/faq-groups'
const FAQS_PATH = '/content/faqs'

// ══════════════════════════════════════════════════════════════════════════════
// FAQ GROUPS API
// ══════════════════════════════════════════════════════════════════════════════

export async function listFAQGroups(
  params?: ListFAQGroupsParams,
  signal?: AbortSignal
): Promise<ListFAQGroupsResponse> {
  const query: Record<string, string | number | boolean | undefined> = {}

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value
      }
    })
  }

  return api.get<ListFAQGroupsResponse>(FAQ_GROUPS_PATH, query, signal)
}

export async function getFAQGroupById(id: number, signal?: AbortSignal): Promise<FAQGroup> {
  return api.get<FAQGroup>(`${FAQ_GROUPS_PATH}/${id}`, undefined, signal)
}

export async function getFAQGroupBySlug(slug: string, signal?: AbortSignal): Promise<FAQGroup> {
  return api.get<FAQGroup>(`${FAQ_GROUPS_PATH}/slug/${slug}`, undefined, signal)
}

export async function createFAQGroup(data: CreateFAQGroupDto): Promise<FAQGroup> {
  return api.post<FAQGroup>(FAQ_GROUPS_PATH, data)
}

export async function updateFAQGroup(id: number, data: UpdateFAQGroupDto): Promise<FAQGroup> {
  return api.put<FAQGroup>(`${FAQ_GROUPS_PATH}/${id}`, data)
}

export async function deleteFAQGroup(id: number): Promise<void> {
  return api.delete<void>(`${FAQ_GROUPS_PATH}/${id}`)
}

// ══════════════════════════════════════════════════════════════════════════════
// FAQS API
// ══════════════════════════════════════════════════════════════════════════════

export async function listFAQs(params?: ListFAQsParams, signal?: AbortSignal): Promise<ListFAQsResponse> {
  const query: Record<string, string | number | boolean | undefined> = {}

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value
      }
    })
  }

  return api.get<ListFAQsResponse>(FAQS_PATH, query, signal)
}

export async function getFAQById(id: number, signal?: AbortSignal): Promise<FAQWithRelations> {
  return api.get<FAQWithRelations>(`${FAQS_PATH}/${id}`, undefined, signal)
}

export async function createFAQ(data: CreateFAQDto): Promise<FAQWithRelations> {
  return api.post<FAQWithRelations>(FAQS_PATH, data)
}

export async function updateFAQ(id: number, data: UpdateFAQDto): Promise<FAQWithRelations> {
  return api.put<FAQWithRelations>(`${FAQS_PATH}/${id}`, data)
}

export async function deleteFAQ(id: number): Promise<void> {
  return api.delete<void>(`${FAQS_PATH}/${id}`)
}

// ── FAQ Workflow Actions ─────────────────────────────────────────────────────

export async function markFAQHelpful(id: number): Promise<FAQWithRelations> {
  return api.post<FAQWithRelations>(`${FAQS_PATH}/${id}/helpful`, {})
}

export async function publishFAQ(id: number): Promise<FAQWithRelations> {
  return api.post<FAQWithRelations>(`${FAQS_PATH}/${id}/publish`, {})
}

export async function unpublishFAQ(id: number): Promise<FAQWithRelations> {
  return api.post<FAQWithRelations>(`${FAQS_PATH}/${id}/unpublish`, {})
}

export async function bulkUpdateFAQSortOrder(data: BulkUpdateSortOrderDto): Promise<void> {
  return api.post<void>(`${FAQS_PATH}/bulk-sort`, data)
}
