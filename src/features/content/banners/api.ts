/**
 * API client for Content Banners module
 * Wraps the base API client with type-safe methods
 */

import { api } from '../../../api/client'
import type {
  BannerWithRelations,
  CreateBannerDto,
  UpdateBannerDto,
  ListBannersParams,
  ListBannersResponse,
  BannerStatsDto,
  BulkUpdateBannersDto,
  BulkUpdateResponse,
  BannerStatsSummary,
} from './types'

const BASE_PATH = '/content/banners'

/**
 * Every banner endpoint answers `{ success, data }`.
 *
 * The list functions below already read `.data` because their response type
 * names it. The single-entity ones did not: they typed the call as the banner
 * itself, so what came back was the envelope. `banner.name` was undefined,
 * `banner.created_at` was undefined — which is why the edit form opened blank
 * with "Invalid Date" and an "Inactive" chip on a banner that was active.
 *
 * Unwrapped here, once, so every hook and form past this line gets the entity.
 */
interface Envelope<T> {
  success?: boolean
  data: T
}

function unwrap<T>(response: Envelope<T> | T): T {
  if (response && typeof response === 'object' && 'data' in (response as Envelope<T>)) {
    return (response as Envelope<T>).data
  }
  // Tolerates an endpoint that answers the entity directly, so this cannot
  // break if the envelope is ever dropped.
  return response as T
}


// ── List & Get ───────────────────────────────────────────────────────────────

export async function listBanners(params?: ListBannersParams, signal?: AbortSignal): Promise<ListBannersResponse> {
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

  return api.get<ListBannersResponse>(BASE_PATH, query, signal)
}

export async function getBannerById(id: number, signal?: AbortSignal): Promise<BannerWithRelations> {
  return unwrap(await api.get<Envelope<BannerWithRelations>>(`${BASE_PATH}/${id}`, undefined, signal))
}

export async function getBannersByPlacement(
  placement: string,
  audience: string = 'all',
  signal?: AbortSignal
): Promise<BannerWithRelations[]> {
  const response = await api.get<{ data: BannerWithRelations[] }>(
    `${BASE_PATH}/placement/${placement}`,
    { audience },
    signal
  )
  return response.data
}

// ── Create & Update ──────────────────────────────────────────────────────────

export async function createBanner(data: CreateBannerDto): Promise<BannerWithRelations> {
  return unwrap(await api.post<Envelope<BannerWithRelations>>(BASE_PATH, data))
}

export async function updateBanner(id: number, data: UpdateBannerDto): Promise<BannerWithRelations> {
  return unwrap(await api.put<Envelope<BannerWithRelations>>(`${BASE_PATH}/${id}`, data))
}

export async function deleteBanner(id: number): Promise<void> {
  return api.delete<void>(`${BASE_PATH}/${id}`)
}

export async function duplicateBanner(id: number): Promise<BannerWithRelations> {
  return unwrap(await api.post<Envelope<BannerWithRelations>>(`${BASE_PATH}/${id}/duplicate`))
}

// ── Workflow Actions ─────────────────────────────────────────────────────────

export async function activateBanner(id: number): Promise<BannerWithRelations> {
  return unwrap(await api.post<Envelope<BannerWithRelations>>(`${BASE_PATH}/${id}/activate`, {}))
}

export async function deactivateBanner(id: number): Promise<BannerWithRelations> {
  return unwrap(await api.post<Envelope<BannerWithRelations>>(`${BASE_PATH}/${id}/deactivate`, {}))
}

// ── Stats Tracking ───────────────────────────────────────────────────────────

export async function updateBannerStats(id: number, stats: BannerStatsDto): Promise<void> {
  return api.post<void>(`${BASE_PATH}/${id}/stats`, stats)
}

export async function trackImpression(id: number): Promise<void> {
  return api.post<void>(`${BASE_PATH}/${id}/track/impression`, {})
}

export async function trackClick(id: number): Promise<void> {
  return api.post<void>(`${BASE_PATH}/${id}/track/click`, {})
}

export async function getStatsSummary(params?: ListBannersParams): Promise<BannerStatsSummary> {
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

  const response = await api.get<{ data: BannerStatsSummary }>(`${BASE_PATH}/stats/summary`, query)
  return response.data
}

// ── Bulk Operations ──────────────────────────────────────────────────────────

export async function bulkActivate(data: BulkUpdateBannersDto): Promise<BulkUpdateResponse> {
  const response = await api.post<{ data: BulkUpdateResponse }>(`${BASE_PATH}/bulk-activate`, data)
  return response.data
}

export async function bulkDeactivate(data: BulkUpdateBannersDto): Promise<BulkUpdateResponse> {
  const response = await api.post<{ data: BulkUpdateResponse }>(`${BASE_PATH}/bulk-deactivate`, data)
  return response.data
}
