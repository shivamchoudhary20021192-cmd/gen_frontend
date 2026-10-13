/**
 * React Query hooks for Banners module
 * Handles data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import type {
  BannerWithRelations,
  ListBannersParams,
  ListBannersResponse,
  CreateBannerDto,
  UpdateBannerDto,
  BannerStatsDto,
  BulkUpdateBannersDto,
  BannerStatsSummary,
} from './types'
import * as bannersApi from './api'

// ── Query Keys ───────────────────────────────────────────────────────────────

export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => [...bannerKeys.all, 'list'] as const,
  list: (params?: ListBannersParams) => [...bannerKeys.lists(), params] as const,
  details: () => [...bannerKeys.all, 'detail'] as const,
  detail: (id: number) => [...bannerKeys.details(), id] as const,
  byPlacement: (placement: string, audience: string) =>
    [...bannerKeys.all, 'placement', placement, audience] as const,
  stats: () => [...bannerKeys.all, 'stats'] as const,
  statsSummary: (params?: ListBannersParams) => [...bannerKeys.stats(), 'summary', params] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useBanners(params?: ListBannersParams, options?: UseQueryOptions<ListBannersResponse>) {
  return useQuery({
    queryKey: bannerKeys.list(params),
    queryFn: ({ signal }) => bannersApi.listBanners(params, signal),
    ...options,
  })
}

export function useBanner(id: number, options?: UseQueryOptions<BannerWithRelations>) {
  return useQuery({
    queryKey: bannerKeys.detail(id),
    queryFn: ({ signal }) => bannersApi.getBannerById(id, signal),
    enabled: id > 0,
    ...options,
  })
}

export function useBannersByPlacement(
  placement: string,
  audience: string = 'all',
  options?: UseQueryOptions<BannerWithRelations[]>
) {
  return useQuery({
    queryKey: bannerKeys.byPlacement(placement, audience),
    queryFn: ({ signal }) => bannersApi.getBannersByPlacement(placement, audience, signal),
    ...options,
  })
}

export function useBannerStatsSummary(
  params?: ListBannersParams,
  options?: UseQueryOptions<BannerStatsSummary>
) {
  return useQuery({
    queryKey: bannerKeys.statsSummary(params),
    queryFn: () => bannersApi.getStatsSummary(params),
    ...options,
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateBanner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBannerDto) => bannersApi.createBanner(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useUpdateBanner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBannerDto }) =>
      bannersApi.updateBanner(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useDeleteBanner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => bannersApi.deleteBanner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useDuplicateBanner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => bannersApi.duplicateBanner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useActivateBanner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => bannersApi.activateBanner(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useDeactivateBanner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => bannersApi.deactivateBanner(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useUpdateBannerStats() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, stats }: { id: number; stats: BannerStatsDto }) =>
      bannersApi.updateBannerStats(id, stats),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useTrackImpression() {
  return useMutation({
    mutationFn: (id: number) => bannersApi.trackImpression(id),
    // No query invalidation for performance - stats are eventually consistent
  })
}

export function useTrackClick() {
  return useMutation({
    mutationFn: (id: number) => bannersApi.trackClick(id),
    // No query invalidation for performance - stats are eventually consistent
  })
}

export function useBulkActivate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateBannersDto) => bannersApi.bulkActivate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}

export function useBulkDeactivate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateBannersDto) => bannersApi.bulkDeactivate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: bannerKeys.stats() })
    },
  })
}
