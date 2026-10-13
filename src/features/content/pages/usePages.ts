/**
 * React Query hooks for Content Pages module
 * Handles data fetching, caching, and mutations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as pagesApi from './api'
import type {
  BulkUpdatePagesDto,
  CreatePageDto,
  CreateSectionDto,
  ListPagesParams,
  PublishPageDto,
  ReorderSectionsDto,
  UpdatePageDto,
  UpdateSectionDto,
} from './types'

// ── Query Keys ───────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ['content', 'pages'] as const,
  lists: () => [...pageKeys.all, 'list'] as const,
  list: (params: ListPagesParams) => [...pageKeys.lists(), params] as const,
  details: () => [...pageKeys.all, 'detail'] as const,
  detail: (id: number) => [...pageKeys.details(), id] as const,
  detailBySlug: (slug: string, locale: string) => [...pageKeys.details(), 'slug', slug, locale] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function usePageList(params: ListPagesParams = {}) {
  return useQuery({
    queryKey: pageKeys.list(params),
    queryFn: ({ signal }) => pagesApi.listPages(params, signal),
    placeholderData: (previous) => previous,
  })
}

export function usePage(id: number | undefined) {
  return useQuery({
    queryKey: pageKeys.detail(id ?? 0),
    queryFn: ({ signal }) => pagesApi.getPageById(id!, signal),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function usePageBySlug(slug: string | undefined, locale = 'en-IN') {
  return useQuery({
    queryKey: pageKeys.detailBySlug(slug ?? '', locale),
    queryFn: ({ signal }) => pagesApi.getPageBySlug(slug!, locale, signal),
    enabled: typeof slug === 'string' && slug.length > 0,
  })
}

// ── Mutations: CRUD ──────────────────────────────────────────────────────────

export function useCreatePage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePageDto) => pagesApi.createPage(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

export function useUpdatePage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePageDto) => pagesApi.updatePage(id, data),
    onSuccess: (updatedPage) => {
      // Update the detail cache
      queryClient.setQueryData(pageKeys.detail(id), updatedPage)
      // Invalidate list to reflect changes
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

export function useDeletePage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pagesApi.deletePage(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageKeys.all })
    },
  })
}

export function useDuplicatePage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pagesApi.duplicatePage(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

// ── Mutations: Workflow Actions ──────────────────────────────────────────────

export function usePublishPage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data?: PublishPageDto) => pagesApi.publishPage(id, data),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(id), updatedPage)
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

export function useUnpublishPage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => pagesApi.unpublishPage(id),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(id), updatedPage)
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

export function useArchivePage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => pagesApi.archivePage(id),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(id), updatedPage)
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

export function useRestorePage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => pagesApi.restorePage(id),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(id), updatedPage)
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

export function useMarkPageAsReviewed(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => pagesApi.markPageAsReviewed(id),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(id), updatedPage)
      void queryClient.invalidateQueries({ queryKey: pageKeys.lists() })
    },
  })
}

// ── Mutations: Section Management ────────────────────────────────────────────

export function useAddSection(pageId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSectionDto) => pagesApi.addSection(pageId, data),
    onSuccess: (response) => {
      // Update detail cache with the full page including new section
      queryClient.setQueryData(pageKeys.detail(pageId), response.page)
    },
  })
}

export function useUpdateSection(pageId: number, sectionId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSectionDto) => pagesApi.updateSection(pageId, sectionId, data),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(pageId), updatedPage)
    },
  })
}

export function useDeleteSection(pageId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: number) => pagesApi.deleteSection(pageId, sectionId),
    onSuccess: () => {
      // Refetch the page to get updated sections
      void queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) })
    },
  })
}

export function useReorderSections(pageId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReorderSectionsDto) => pagesApi.reorderSections(pageId, data),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(pageId), updatedPage)
    },
  })
}

// ── Mutations: Bulk Operations ───────────────────────────────────────────────

export function useBulkUpdatePages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: BulkUpdatePagesDto) => pagesApi.bulkUpdatePages(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageKeys.all })
    },
  })
}
