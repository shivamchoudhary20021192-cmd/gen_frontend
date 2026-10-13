import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { Pagination } from '../../../api/types'

/**
 * The Journal.
 *
 * Publishing is a separate endpoint from saving, and that separation is kept
 * here rather than collapsed into one "save with status" mutation: the API
 * refuses to publish an article with no excerpt or body, and a UI that sets a
 * status field would hide that refusal behind a generic save error.
 */

export type ArticleStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'

export interface ArticleCategory {
  id: number
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  article_count: number
}

export interface ArticleListItem {
  id: number
  public_id: string
  slug: string
  title: string
  subtitle: string | null
  excerpt: string | null
  cover: string | null
  cover_alt: string | null
  /** Which publication this article is filed under. */
  blog: { id: number; slug: string; title: string }
  category: { id: number; name: string | null; slug: string | null } | null
  author: { name: string | null; title: string | null }
  medically_reviewed_by: string | null
  reviewed_at: string | null
  next_review_due: string | null
  read_time_minutes: number | null
  status: ArticleStatus
  is_featured: boolean
  is_indexable: boolean
  published_at: string | null
  scheduled_at: string | null
  view_count: number
  created_at: string
  updated_at: string
}

export interface ArticleDetail extends ArticleListItem {
  blog_id: number
  category_id: number | null
  cover_media_id: number | null
  author_media_id: number | null
  author_image: string | null
  body_html: string | null
  seo: { meta_title: string | null; meta_description: string | null }
}

export interface ArticleProduct {
  id: number
  slug: string
  name: string
  price: number | null
  image: string | null
}

export interface ArticleListResponse {
  articles: ArticleListItem[]
  pagination: Pagination
  /** Per-status totals for the tab strip, from one query rather than one per tab. */
  counts: Record<string, number>
}

export interface ArticleDetailResponse {
  article: ArticleDetail
  products: ArticleProduct[]
}

export interface ArticleInput {
  title: string
  /** Moving an article to another blog is an ordinary edit of this field. */
  blog_id?: number
  slug?: string
  subtitle?: string | null
  excerpt?: string | null
  body_html?: string | null
  category_id?: number | null
  cover_media_id?: number | null
  author_name?: string | null
  author_title?: string | null
  medically_reviewed_by?: string | null
  reviewed_at?: string | null
  next_review_due?: string | null
  read_time_minutes?: number | null
  is_featured?: boolean
  is_indexable?: boolean
  product_ids?: number[]
}

export interface ArticleFilters {
  page?: number
  limit?: number
  q?: string
  status?: ArticleStatus | ''
  category_id?: number | ''
  blog_id?: number | ''
  review_due?: boolean
}

const PATH = '/content/articles'

function params(filters: ArticleFilters): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  if (filters.page) query.page = filters.page
  if (filters.limit) query.limit = filters.limit
  if (filters.q) query.q = filters.q
  if (filters.status) query.status = filters.status
  if (filters.category_id) query.category_id = filters.category_id
  if (filters.blog_id) query.blog_id = filters.blog_id
  if (filters.review_due) query.review_due = 'true'
  return query
}

export const articleKeys = {
  all: ['articles'] as const,
  list: (filters: ArticleFilters) => ['articles', 'list', filters] as const,
  detail: (id: number) => ['articles', 'detail', id] as const,
  categories: ['articles', 'categories'] as const,
}

export function useArticles(filters: ArticleFilters) {
  return useQuery({
    queryKey: articleKeys.list(filters),
    queryFn: () => api.get<ArticleListResponse>(PATH, params(filters)),
    staleTime: 30 * 1000,
  })
}

export function useArticle(id: number | undefined) {
  return useQuery({
    queryKey: articleKeys.detail(id ?? 0),
    queryFn: () => api.get<ArticleDetailResponse>(`${PATH}/${id}`),
    enabled: Boolean(id),
  })
}

export function useArticleCategories() {
  return useQuery({
    queryKey: articleKeys.categories,
    queryFn: () => api.get<{ categories: ArticleCategory[] }>(`${PATH}/categories`),
    // Categories are seeded and rarely change; refetching them on every mount
    // costs a request per screen for a list of six.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Anything that writes an article changes what the blogs list says.
 *
 * Counts, the published tally and the last-published date all live on the blog
 * row, and that list is cached for ten minutes because a shop has three of
 * them. Without this, moving an article between blogs leaves the Manage blogs
 * dialog — and the delete-with-reassign it drives — reading yesterday's counts.
 *
 * The key is written out rather than imported from useBlogs, which imports
 * articleKeys from here; a shared two-word literal is cheaper than a cycle.
 */
function invalidateArticleAndBlogs(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: articleKeys.all })
  void queryClient.invalidateQueries({ queryKey: ['blogs'] })
}

export function useCreateArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ArticleInput) =>
      api.post<ArticleDetailResponse>(PATH, input, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      invalidateArticleAndBlogs(queryClient)
    },
  })
}

export function useUpdateArticle(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ArticleInput) => api.patch<ArticleDetailResponse>(`${PATH}/${id}`, input),
    onSuccess: () => {
      invalidateArticleAndBlogs(queryClient)
    },
  })
}

/**
 * publish / unpublish / archive.
 *
 * One hook taking the action rather than three near-identical ones: they share
 * a URL shape, a response and an invalidation, and the only thing that differs
 * is the word.
 */
export function useArticleAction(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'publish' | 'unpublish' | 'archive') =>
      api.post<ArticleDetailResponse>(`${PATH}/${id}/${action}`),
    onSuccess: () => {
      invalidateArticleAndBlogs(queryClient)
    },
  })
}

export function useDeleteArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<{ deleted: boolean }>(`${PATH}/${id}`),
    onSuccess: () => {
      invalidateArticleAndBlogs(queryClient)
    },
  })
}
