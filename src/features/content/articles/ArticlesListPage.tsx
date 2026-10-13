import AddIcon from '@mui/icons-material/Add'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import SearchIcon from '@mui/icons-material/Search'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { PageHeader } from '../../../components/PageHeader'
import { useDebounce } from '../../../hooks/useDebounce'
import { formatRelative } from '../../../lib/format'
import { tokens } from '../../../theme'
import {
  useArticleCategories,
  useArticles,
  type ArticleListItem,
  type ArticleStatus,
} from './useArticles'
import { useBlogs } from './useBlogs'

const PAGE_SIZE = 20

const TABS: { value: ArticleStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_STYLE: Record<ArticleStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: '#EFEFEF', fg: '#5C5C5C', label: 'Draft' },
  in_review: { bg: '#FFF4E0', fg: '#8A5A00', label: 'In review' },
  scheduled: { bg: '#E8EEFF', fg: '#26428A', label: 'Scheduled' },
  published: { bg: '#E3F3E6', fg: '#1B5E20', label: 'Published' },
  archived: { bg: '#F3E8E8', fg: '#7A3030', label: 'Archived' },
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

/** True when a reviewed article's next review date has passed. */
function isReviewOverdue(article: ArticleListItem): boolean {
  if (!article.next_review_due) return false
  return new Date(article.next_review_due) <= new Date()
}

/**
 * The Journal.
 *
 * Skincare writing has a shelf life: a claim reviewed last spring may not hold
 * this one. The list surfaces "review due" as a filter and a marker on the row
 * rather than burying the date inside each article, because nobody opens
 * forty articles to find the three that have gone stale.
 */
export function ArticlesListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<ArticleStatus | ''>('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [reviewDue, setReviewDue] = useState(false)
  // Blogs links here with ?blog_id=, so the filter is seeded from the URL
  // rather than starting blank and quietly ignoring where the person came from.
  const [params] = useSearchParams()
  const [blogId, setBlogId] = useState<number | ''>(() => {
    const fromUrl = Number(params.get('blog_id'))
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : ''
  })
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debouncedSearch || undefined,
      status: tab,
      category_id: categoryId,
      blog_id: blogId,
      review_due: reviewDue,
    }),
    [page, debouncedSearch, tab, categoryId, blogId, reviewDue],
  )

  const { data, isLoading, isFetching, error } = useArticles(filters)
  const categories = useArticleCategories()
  const blogs = useBlogs()
  // The blog column and filter only earn their space once there is more than
  // one publication to tell apart.
  const manyBlogs = (blogs.data?.blogs.length ?? 0) > 1

  const articles = data?.articles ?? []
  const counts = data?.counts ?? {}
  const pagination = data?.pagination

  /** Any filter change resets to page one — page 3 of a new filter is nobody. */
  const change = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const countFor = (value: ArticleStatus | '') =>
    value === ''
      ? Object.values(counts).reduce((total, n) => total + n, 0)
      : (counts[value] ?? 0)

  return (
    <Box>
      <PageHeader
        title="Journal"
        subtitle="Routines, ingredient explainers and what to expect — the long-form side of the shop."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FolderOutlinedIcon />}
              onClick={() => navigate('/content/blogs')}
            >
              Manage blogs
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/content/articles/new')}
            >
              Write an article
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorText(error)}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_event, value) => change(() => setTab(value))}
        sx={{ mb: 2, borderBottom: `1px solid ${tokens.border}` }}
      >
        {TABS.map((item) => (
          <Tab
            key={item.value || 'all'}
            value={item.value}
            label={`${item.label} (${countFor(item.value)})`}
          />
        ))}
      </Tabs>

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
          <TextField
            label="Search"
            size="small"
            placeholder="Search by title or slug"
            value={search}
            onChange={(event) => change(() => setSearch(event.target.value))}
            sx={{ minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            select
            size="small"
            label="Category"
            value={categoryId}
            onChange={(event) =>
              change(() => setCategoryId(event.target.value === '' ? '' : Number(event.target.value)))
            }
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All categories</MenuItem>
            {(categories.data?.categories ?? []).map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>

          {manyBlogs && (
            <TextField
              select
              size="small"
              label="Blog"
              value={blogId}
              onChange={(event) =>
                change(() => setBlogId(event.target.value === '' ? '' : Number(event.target.value)))
              }
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All blogs</MenuItem>
              {(blogs.data?.blogs ?? []).map((blog) => (
                <MenuItem key={blog.id} value={blog.id}>
                  {blog.title}
                </MenuItem>
              ))}
            </TextField>
          )}

          <div>
            <br />
          <Button
            variant={reviewDue ? 'contained' : 'outlined'}
            size="small"
            startIcon={<WarningAmberIcon />}
            onClick={() => change(() => setReviewDue(!reviewDue))}
          >
            Review overdue
          </Button>
          </div>

          {isFetching && <CircularProgress size={18} />}
        </Stack>
      </Card>

      <TableContainer component={Card} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Article</TableCell>
              {manyBlogs && <TableCell>Blog</TableCell>}
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reviewed</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Views</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={manyBlogs ? 7 : 6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && articles.length === 0 && (
              <TableRow>
                <TableCell colSpan={manyBlogs ? 7 : 6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: tokens.subdued }}>
                    {debouncedSearch || tab || categoryId || reviewDue
                      ? 'Nothing matches these filters.'
                      : 'No articles yet. Write the first one.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {articles.map((article) => {
              const style = STATUS_STYLE[article.status]
              const overdue = isReviewOverdue(article)
              return (
                <TableRow
                  key={article.id}
                  hover
                  data-article-id={article.id}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/content/articles/${article.id}`)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Avatar
                        variant="rounded"
                        src={article.cover ?? undefined}
                        alt=""
                        sx={{ width: 40, height: 40, bgcolor: tokens.hover }}
                      />
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {article.title}
                          {article.is_featured && (
                            <Chip
                              size="small"
                              label="Featured"
                              sx={{ ml: 1, height: 18, fontSize: 10, bgcolor: '#FFF3D6', color: '#7A5600' }}
                            />
                          )}
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.subdued }}>
                          /{article.slug}
                          {article.read_time_minutes ? ` · ${article.read_time_minutes} min read` : ''}
                        </Typography>
                      </Stack>
                    </Stack>
                  </TableCell>

                  {manyBlogs && (
                    <TableCell>
                      <Chip
                        size="small"
                        label={article.blog?.title ?? '—'}
                        sx={{ bgcolor: tokens.hover, color: tokens.ink, fontWeight: 600 }}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      {article.category?.name ?? '—'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={style.label}
                      sx={{ bgcolor: style.bg, color: style.fg, fontWeight: 600 }}
                    />
                  </TableCell>

                  <TableCell>
                    {article.medically_reviewed_by ? (
                      <Stack spacing={0.25}>
                        <Typography variant="caption">{article.medically_reviewed_by}</Typography>
                        {overdue ? (
                          <Tooltip title="The next review date has passed">
                            <Chip
                              size="small"
                              icon={<WarningAmberIcon sx={{ fontSize: 13 }} />}
                              label="Review overdue"
                              sx={{ height: 18, fontSize: 10, bgcolor: '#FDECEC', color: '#8A2222', width: 'fit-content' }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" sx={{ color: tokens.subdued }}>
                            {article.reviewed_at ?? 'no date'}
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" sx={{ color: tokens.subdued }}>
                        Not reviewed
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      {formatRelative(article.updated_at)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">{article.view_count}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && pagination.pages > 1 && (
        <Stack sx={{ mt: 2, alignItems: 'center' }}>
          <Pagination
            count={pagination.pages}
            page={pagination.page}
            onChange={(_event, value) => setPage(value)}
          />
        </Stack>
      )}
    </Box>
  )
}
