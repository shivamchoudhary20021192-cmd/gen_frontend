import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Button,
  Card,
  InputAdornment,
  LinearProgress,
  Link,
  Pagination,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { useDebounce } from '../../../hooks/useDebounce'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { formatRelative } from '../../../lib/format'

type Status = 'pending' | 'published' | 'spam' | 'removed'

interface Comment {
  id: number
  author: string
  email: string
  body: string
  status: Status
  created_at: string
  published_at: string | null
  article?: { id: number; title: string; url: string }
}

interface CommentList {
  comments: Comment[]
  counts: Partial<Record<Status, number>>
  pagination: { page: number; limit: number; total: number; total_pages: number }
}

const TABS: Array<{ value: Status; label: string }> = [
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'published', label: 'Published' },
  { value: 'spam', label: 'Spam' },
  { value: 'removed', label: 'Removed' },
]

/** What staff can do to a comment in each tab. */
const ACTIONS: Record<Status, Array<{ to: Status; label: string; color?: 'error' }>> = {
  pending: [
    { to: 'published', label: 'Publish' },
    { to: 'spam', label: 'Spam', color: 'error' },
    { to: 'removed', label: 'Remove', color: 'error' },
  ],
  published: [
    { to: 'pending', label: 'Unpublish' },
    { to: 'spam', label: 'Spam', color: 'error' },
    { to: 'removed', label: 'Remove', color: 'error' },
  ],
  spam: [
    { to: 'published', label: 'Not spam — publish' },
    { to: 'removed', label: 'Remove', color: 'error' },
  ],
  removed: [{ to: 'pending', label: 'Restore' }],
}

/**
 * Content → Comments: what shoppers wrote on blog posts. Blogs choose in
 * Content → Blogs whether comments are off, held here for approval, or
 * published at once.
 */
export function CommentsPage() {
  const { can } = useAuth()
  const canModerate = can('cms.publish')
  const queryClient = useQueryClient()
  const { flash, success, error, clear } = useFlash()
  const [status, setStatus] = useState<Status>('pending')
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim(), 300)
  const [page, setPage] = useState(1)
  const params = { status, q: search || undefined, page, limit: 25 }
  const list = useQuery({ queryKey: ['comments', params], queryFn: () => api.get<CommentList>('/content/comments', params), placeholderData: keepPreviousData })
  const moderate = useMutation({
    mutationFn: ({ id, to }: { id: number; to: Status }) => api.post(`/content/comments/${id}/moderate`, { status: to }),
    onSuccess: (_response, { to }) => {
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
      success(to === 'published' ? 'Comment published' : to === 'spam' ? 'Marked as spam' : to === 'removed' ? 'Comment removed' : 'Comment held for approval')
    },
    onError: (caught) => error(errorMessage(caught)),
  })
  const counts = list.data?.counts ?? {}
  const rows = list.data?.comments ?? []

  return (
    <Box>
      <PageHeader title="Comments" subtitle="What shoppers wrote on your blog posts. Choose per blog in Content → Blogs whether comments are held for approval." />
      <Card variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ px: 2, pt: 1, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Tabs
            value={status}
            onChange={(_event, next: Status) => {
              setStatus(next)
              setPage(1)
            }}
            variant="scrollable"
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={`${tab.label}${counts[tab.value] ? ` · ${counts[tab.value]}` : ''}`} />
            ))}
          </Tabs>
          <TextField
            size="small"
            placeholder="Author, email, words, post"
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 260, pb: { xs: 1, md: 0 } }}
          />
        </Stack>
        {list.isFetching && <LinearProgress sx={{ height: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '45%' }}>Comment</TableCell>
                <TableCell>On</TableCell>
                <TableCell>Posted</TableCell>
                {canModerate && <TableCell align="right" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((comment) => (
                <TableRow key={comment.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {comment.author}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {comment.email}
                      </Typography>
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 0.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {comment.body}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {comment.article && (
                      <Link component={RouterLink} to={`/content/articles/${comment.article.id}`}>
                        {comment.article.title}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRelative(comment.created_at)}</TableCell>
                  {canModerate && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {ACTIONS[comment.status].map((action) => (
                        <Button key={action.to} size="small" color={action.color} disabled={moderate.isPending} onClick={() => moderate.mutate({ id: comment.id, to: action.to })}>
                          {action.label}
                        </Button>
                      ))}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!list.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
                      {status === 'pending' ? 'Nothing waiting for approval.' : 'No comments here.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {(list.data?.pagination.total_pages ?? 1) > 1 && (
          <Stack sx={{ alignItems: 'center', py: 2 }}>
            <Pagination count={list.data!.pagination.total_pages} page={page} onChange={(_event, next) => setPage(next)} />
          </Stack>
        )}
      </Card>
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}
