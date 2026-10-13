/**
 * API client for Content Pages module
 * Wraps the base API client with type-safe methods
 */

import { api } from '../../../api/client'
import type {
  AddSectionResponse,
  BulkUpdatePagesDto,
  BulkUpdateResponse,
  CreatePageDto,
  CreateSectionDto,
  ListPagesParams,
  ListPagesResponse,
  PageWithRelations,
  PublishPageDto,
  ReorderSectionsDto,
  UpdatePageDto,
  UpdateSectionDto,
} from './types'

const BASE_PATH = '/content/pages'

// ── List & Get ───────────────────────────────────────────────────────────────

export async function listPages(params?: ListPagesParams, signal?: AbortSignal): Promise<ListPagesResponse> {
  // Convert array params to comma-separated strings
  const query: Record<string, string | number | boolean | undefined> = {}
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return
      if (Array.isArray(value)) {
        query[key] = value.join(',')
      } else {
        query[key] = value
      }
    })
  }

  return api.get<ListPagesResponse>(BASE_PATH, query, signal)
}

export async function getPageById(id: number, signal?: AbortSignal): Promise<PageWithRelations> {
  return api.get<PageWithRelations>(`${BASE_PATH}/${id}`, undefined, signal)
}

export async function getPageBySlug(
  slug: string,
  locale = 'en-IN',
  signal?: AbortSignal,
): Promise<PageWithRelations> {
  return api.get<PageWithRelations>(`${BASE_PATH}/slug/${slug}`, { locale }, signal)
}

// ── Create & Update ──────────────────────────────────────────────────────────

export async function createPage(data: CreatePageDto): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(BASE_PATH, data)
}

export async function updatePage(id: number, data: UpdatePageDto): Promise<PageWithRelations> {
  return api.put<PageWithRelations>(`${BASE_PATH}/${id}`, data)
}

export async function deletePage(id: number): Promise<void> {
  return api.delete<void>(`${BASE_PATH}/${id}`)
}

export async function duplicatePage(id: number): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(`${BASE_PATH}/${id}/duplicate`)
}

// ── Workflow Actions ─────────────────────────────────────────────────────────

export async function publishPage(id: number, data?: PublishPageDto): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(`${BASE_PATH}/${id}/publish`, data ?? {})
}

export async function unpublishPage(id: number): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(`${BASE_PATH}/${id}/unpublish`, {})
}

export async function archivePage(id: number): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(`${BASE_PATH}/${id}/archive`, {})
}

export async function restorePage(id: number): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(`${BASE_PATH}/${id}/restore`, {})
}

export async function markPageAsReviewed(id: number): Promise<PageWithRelations> {
  return api.post<PageWithRelations>(`${BASE_PATH}/${id}/review`, {})
}

// ── Section Management ───────────────────────────────────────────────────────

export async function addSection(pageId: number, data: CreateSectionDto): Promise<AddSectionResponse> {
  return api.post<AddSectionResponse>(`${BASE_PATH}/${pageId}/sections`, data)
}

export async function updateSection(
  pageId: number,
  sectionId: number,
  data: UpdateSectionDto,
): Promise<PageWithRelations> {
  return api.put<PageWithRelations>(`${BASE_PATH}/${pageId}/sections/${sectionId}`, data)
}

export async function deleteSection(pageId: number, sectionId: number): Promise<void> {
  return api.delete<void>(`${BASE_PATH}/${pageId}/sections/${sectionId}`)
}

export async function reorderSections(pageId: number, data: ReorderSectionsDto): Promise<PageWithRelations> {
  return api.put<PageWithRelations>(`${BASE_PATH}/${pageId}/sections/reorder`, data)
}

// ── Bulk Operations ──────────────────────────────────────────────────────────

export async function bulkUpdatePages(data: BulkUpdatePagesDto): Promise<BulkUpdateResponse> {
  return api.post<BulkUpdateResponse>(`${BASE_PATH}/bulk-update`, data)
}
