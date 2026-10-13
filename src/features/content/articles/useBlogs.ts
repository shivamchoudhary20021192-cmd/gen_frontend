import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { articleKeys } from './useArticles'

/**
 * Blogs — the publications articles are filed under.
 *
 * A shop runs one or more ("Journal", "News", "Guides"); every article belongs
 * to exactly one, and each has its own page on the storefront.
 */

export interface Blog {
  id: number
  slug: string
  title: string
  description: string | null
  is_active: boolean
  /** Comments: off, held for approval, or published straight away. */
  comments_policy: 'disabled' | 'moderated' | 'published'
  article_count: number
  published_count: number
  last_published_at: string | null
  created_at: string
}

export interface BlogInput {
  title: string
  slug?: string
  description?: string | null
  is_active?: boolean
  comments_policy?: 'disabled' | 'moderated' | 'published'
}

const PATH = '/content/blogs'

export const blogKeys = {
  all: ['blogs'] as const,
  list: () => ['blogs', 'list'] as const,
}

export function useBlogs() {
  return useQuery({
    queryKey: blogKeys.list(),
    queryFn: () => api.get<{ blogs: Blog[] }>(PATH),
    // A shop has two or three of these and they rarely change; refetching on
    // every mount costs a request per screen for a list of three.
    staleTime: 10 * 60 * 1000,
  })
}

/** Both caches are invalidated: moving or deleting changes article counts. */
function useBlogMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.all })
      void queryClient.invalidateQueries({ queryKey: articleKeys.all })
    },
  })
}

export function useCreateBlog() {
  return useBlogMutation((input: BlogInput) => api.post<{ blog: Blog }>(PATH, input))
}

export function useUpdateBlog() {
  return useBlogMutation(({ id, input }: { id: number; input: BlogInput }) =>
    api.patch<{ blog: Blog }>(`${PATH}/${id}`, input),
  )
}

/**
 * Deletes a blog, moving its articles first when `reassignTo` is given.
 *
 * The move and the delete are one request because they are one decision: the
 * API runs them in a single transaction, so there is no state where the
 * articles have moved but the blog survived, or worse.
 */
export function useDeleteBlog() {
  return useBlogMutation(({ id, reassignTo }: { id: number; reassignTo?: number }) =>
    api.delete<{ deleted: boolean; articles_moved: number }>(
      reassignTo ? `${PATH}/${id}?reassign_to=${reassignTo}` : `${PATH}/${id}`,
    ),
  )
}
