import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

/**
 * Creators — the models, founders and artists whose looks appear on a product.
 *
 * A library rather than rows on each product: one person cast for a campaign
 * turns up on the serum, the sunscreen and a journal article, and when she
 * changes her handle it is corrected in one place rather than eleven.
 */

export interface Creator {
  id: number
  public_id: string
  slug: string
  name: string
  handle: string | null
  role: string | null
  bio: string | null
  portrait: string | null
  portrait_alt: string | null
  portrait_media_id: number | null
  instagram_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  website_url: string | null
  is_active: boolean
  /** May this person be named on the site at all. */
  is_identity_public: boolean
  sort_order: number
  /** How many story blocks feature this person. */
  block_count: number
  created_at: string
  updated_at: string
}

export interface CreatorInput {
  name: string
  handle?: string | null
  role?: string | null
  bio?: string | null
  portrait_media_id?: number | null
  instagram_url?: string | null
  youtube_url?: string | null
  tiktok_url?: string | null
  website_url?: string | null
  is_active?: boolean
  is_identity_public?: boolean
  sort_order?: number
}

const PATH = '/creators'

export const creatorKeys = {
  all: ['creators'] as const,
  list: (search: string) => ['creators', 'list', search] as const,
  one: (id: number) => ['creators', id] as const,
}

export function useCreators(search = '') {
  return useQuery({
    queryKey: creatorKeys.list(search),
    queryFn: () => api.get<{ creators: Creator[] }>(PATH, search ? { q: search } : undefined),
    // A shop casts a handful of people; this list does not need refetching on
    // every mount of every screen that offers the picker.
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreator(id: number | undefined) {
  return useQuery({
    queryKey: creatorKeys.one(id ?? 0),
    queryFn: () => api.get<{ creator: Creator }>(`${PATH}/${id}`),
    enabled: typeof id === 'number' && id > 0,
  })
}

function useCreatorMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creatorKeys.all })
    },
  })
}

export function useCreateCreator() {
  return useCreatorMutation((input: CreatorInput) =>
    api.post<{ creator: Creator }>(PATH, input, { idempotencyKey: crypto.randomUUID() }),
  )
}

export function useUpdateCreator() {
  return useCreatorMutation(({ id, input }: { id: number; input: Partial<CreatorInput> }) =>
    api.patch<{ creator: Creator }>(`${PATH}/${id}`, input),
  )
}

export function useDeleteCreator() {
  return useCreatorMutation((id: number) =>
    api.delete<{ deleted: boolean; featured_in_blocks: number }>(`${PATH}/${id}`),
  )
}
