import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Media, MediaFolder, Pagination } from '../../api/types'

export interface MediaListParams {
  page?: number
  limit?: number
  q?: string
  folder_id?: number
  media_type?: string
  status?: string
  unused?: boolean
  sort?: string
}

interface MediaListResponse {
  media: Media[]
  pagination: Pagination
}

export const mediaKeys = {
  all: ['media'] as const,
  list: (params: MediaListParams) => ['media', 'list', params] as const,
  detail: (id: number) => ['media', 'detail', id] as const,
  folders: ['media', 'folders'] as const,
}

export function useMediaList(params: MediaListParams, enabled = true) {
  return useQuery({
    queryKey: mediaKeys.list(params),
    queryFn: ({ signal }) => api.get<MediaListResponse>('/media', { ...params }, signal),
    enabled,
    /**
     * Variants are generated after the upload response returns, so a freshly
     * uploaded tile arrives as `processing`. Poll only while something is
     * actually in flight — an idle library must not sit there refetching.
     */
    refetchInterval: (query) => {
      const data = query.state.data as MediaListResponse | undefined
      const busy = data?.media.some((m) => m.status === 'processing' || m.status === 'uploading')
      return busy ? 1500 : false
    },
    placeholderData: (previous) => previous,
  })
}

/** A single library item, for showing an image the form only knows by id. */
export function useMediaItem(id: number | null | undefined) {
  return useQuery({
    queryKey: mediaKeys.detail(id ?? 0),
    queryFn: () => api.get<{ media: Media }>(`/media/${id}`),
    enabled: typeof id === 'number' && id > 0,
    staleTime: 5 * 60_000,
  })
}

export function useMediaFolders() {
  return useQuery({
    queryKey: mediaKeys.folders,
    queryFn: () => api.get<{ folders: MediaFolder[] }>('/media/folders'),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Media> }) =>
      api.patch<{ media: Media }>(`/media/${id}`, { media: patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
    },
  })
}

export function useDeleteMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/media/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
    },
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; parent_id?: number | null }) =>
      api.post<{ folder: MediaFolder }>('/media/folders', { folder: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.folders })
    },
  })
}
