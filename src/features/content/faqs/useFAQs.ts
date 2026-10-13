/**
 * React Query hooks for FAQs module
 * Handles data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import type {
  FAQGroup,
  FAQWithRelations,
  ListFAQGroupsParams,
  ListFAQsParams,
  ListFAQGroupsResponse,
  ListFAQsResponse,
  CreateFAQGroupDto,
  UpdateFAQGroupDto,
  CreateFAQDto,
  UpdateFAQDto,
  BulkUpdateSortOrderDto,
} from './types'
import * as faqsApi from './api'

// ── Query Keys ───────────────────────────────────────────────────────────────

export const faqKeys = {
  // FAQ Groups
  allGroups: ['faq-groups'] as const,
  groupLists: () => [...faqKeys.allGroups, 'list'] as const,
  groupList: (params?: ListFAQGroupsParams) => [...faqKeys.groupLists(), params] as const,
  groupDetails: () => [...faqKeys.allGroups, 'detail'] as const,
  groupDetail: (id: number) => [...faqKeys.groupDetails(), id] as const,
  groupBySlug: (slug: string) => [...faqKeys.allGroups, 'slug', slug] as const,

  // FAQs
  allFAQs: ['faqs'] as const,
  faqLists: () => [...faqKeys.allFAQs, 'list'] as const,
  faqList: (params?: ListFAQsParams) => [...faqKeys.faqLists(), params] as const,
  faqDetails: () => [...faqKeys.allFAQs, 'detail'] as const,
  faqDetail: (id: number) => [...faqKeys.faqDetails(), id] as const,
}

// ══════════════════════════════════════════════════════════════════════════════
// FAQ GROUPS HOOKS
// ══════════════════════════════════════════════════════════════════════════════

export function useFAQGroups(
  params?: ListFAQGroupsParams,
  options?: UseQueryOptions<ListFAQGroupsResponse>
) {
  return useQuery({
    queryKey: faqKeys.groupList(params),
    queryFn: ({ signal }) => faqsApi.listFAQGroups(params, signal),
    ...options,
  })
}

export function useFAQGroup(id: number, options?: UseQueryOptions<FAQGroup>) {
  return useQuery({
    queryKey: faqKeys.groupDetail(id),
    queryFn: ({ signal }) => faqsApi.getFAQGroupById(id, signal),
    enabled: id > 0,
    ...options,
  })
}

export function useFAQGroupBySlug(slug: string, options?: UseQueryOptions<FAQGroup>) {
  return useQuery({
    queryKey: faqKeys.groupBySlug(slug),
    queryFn: ({ signal }) => faqsApi.getFAQGroupBySlug(slug, signal),
    enabled: !!slug,
    ...options,
  })
}

export function useCreateFAQGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateFAQGroupDto) => faqsApi.createFAQGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqKeys.groupLists() })
    },
  })
}

export function useUpdateFAQGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateFAQGroupDto }) =>
      faqsApi.updateFAQGroup(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: faqKeys.groupLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.groupDetail(variables.id) })
    },
  })
}

export function useDeleteFAQGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => faqsApi.deleteFAQGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqKeys.groupLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
    },
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// FAQS HOOKS
// ══════════════════════════════════════════════════════════════════════════════

export function useFAQs(params?: ListFAQsParams, options?: UseQueryOptions<ListFAQsResponse>) {
  return useQuery({
    queryKey: faqKeys.faqList(params),
    queryFn: ({ signal }) => faqsApi.listFAQs(params, signal),
    ...options,
  })
}

export function useFAQ(id: number, options?: UseQueryOptions<FAQWithRelations>) {
  return useQuery({
    queryKey: faqKeys.faqDetail(id),
    queryFn: ({ signal }) => faqsApi.getFAQById(id, signal),
    enabled: id > 0,
    ...options,
  })
}

export function useCreateFAQ() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateFAQDto) => faqsApi.createFAQ(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.groupLists() })
    },
  })
}

export function useUpdateFAQ() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateFAQDto }) =>
      faqsApi.updateFAQ(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.faqDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: faqKeys.groupLists() })
    },
  })
}

export function useDeleteFAQ() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => faqsApi.deleteFAQ(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.groupLists() })
    },
  })
}

export function useMarkFAQHelpful() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => faqsApi.markFAQHelpful(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.faqDetail(id) })
    },
  })
}

export function usePublishFAQ() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => faqsApi.publishFAQ(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.faqDetail(id) })
    },
  })
}

export function useUnpublishFAQ() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => faqsApi.unpublishFAQ(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
      queryClient.invalidateQueries({ queryKey: faqKeys.faqDetail(id) })
    },
  })
}

export function useBulkUpdateFAQSortOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateSortOrderDto) => faqsApi.bulkUpdateFAQSortOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqKeys.faqLists() })
    },
  })
}
