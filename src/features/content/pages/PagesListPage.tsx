import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
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
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/PageHeader'
import { useAuth } from '../../../auth/useAuth'
import { formatRelative } from '../../../lib/format'
import { tokens } from '../../../theme'
import { useBulkUpdatePages, usePageList } from './usePages'
import type { PageListItem, PageStatus, PageType } from './types'
import { getPageStatusColor, getPageStatusLabel, getPageTypeLabel } from './utils'

export function PagesListPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PageStatus | ''>('')
  const [pageType, setPageType] = useState<PageType | ''>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      search: search || undefined,
      status: status || undefined,
      page_type: pageType || undefined,
      sort_by: 'updated_at' as const,
      sort_order: 'desc' as const,
    }),
    [page, search, status, pageType],
  )

  const list = usePageList(params)
  const bulk = useBulkUpdatePages()

  const rows = list.data?.data ?? []
  const pagination = list.data?.pagination

  const allSelected = rows.length > 0 && selected.length === rows.length

  const runBulk = (targetStatus: PageStatus) => {
    bulk.mutate(
      { ids: selected, status: targetStatus },
      { onSuccess: () => setSelected([]) },
    )
  }

  return (
    <Box>
      <PageHeader
        title="Pages"
        subtitle={pagination ? `${pagination.total} total` : undefined}
        actions={
          can('content.pages.create') ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/content/pages/new')}
            >
              Create page
            </Button>
          ) : null
        }
      />

      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search title, slug, or path"
            sx={{ flex: 1 }}
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
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PageStatus | '')
              setPage(1)
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="in_review">In Review</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </TextField>
          <TextField
            select
            label="Type"
            value={pageType}
            onChange={(event) => {
              setPageType(event.target.value as PageType | '')
              setPage(1)
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="home">Home</MenuItem>
            <MenuItem value="standard">Standard</MenuItem>
            <MenuItem value="landing">Landing</MenuItem>
            <MenuItem value="policy">Policy</MenuItem>
            <MenuItem value="about">About</MenuItem>
            <MenuItem value="support">Support</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
        </Stack>

        {selected.length > 0 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: tokens.ivory,
              alignItems: 'center',
              borderTop: `1px solid ${tokens.border}`,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {selected.length} selected
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => runBulk('published')} disabled={bulk.isPending}>
              Publish
            </Button>
            <Button size="small" onClick={() => runBulk('draft')} disabled={bulk.isPending}>
              Unpublish
            </Button>
            <Button size="small" color="error" onClick={() => runBulk('archived')} disabled={bulk.isPending}>
              Archive
            </Button>
          </Stack>
        )}

        {bulk.isSuccess && (
          <Alert severity="success" sx={{ m: 2 }} onClose={() => bulk.reset()}>
            Updated {bulk.data.updated_count} of {bulk.data.total_count} pages successfully.
          </Alert>
        )}
      </Card>

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : list.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load pages.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {search || status || pageType ? 'No pages match these filters.' : 'No pages yet.'}
            </Typography>
            {can('content.pages.create') && !search && !status && !pageType && (
              <Button variant="outlined" onClick={() => navigate('/content/pages/new')}>
                Create your first page
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selected.length > 0 && !allSelected}
                      onChange={(event) => setSelected(event.target.checked ? rows.map((r) => r.id) : [])}
                    />
                  </TableCell>
                  <TableCell>Page</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>SEO</TableCell>
                  <TableCell align="right">Sections</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((pageItem) => (
                  <PageRow
                    key={pageItem.id}
                    page={pageItem}
                    selected={selected.includes(pageItem.id)}
                    onToggle={() =>
                      setSelected((current) =>
                        current.includes(pageItem.id)
                          ? current.filter((id) => id !== pageItem.id)
                          : [...current, pageItem.id],
                      )
                    }
                    onOpen={() => navigate(`/content/pages/${pageItem.id}`)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {pagination && pagination.totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Pagination
              count={pagination.totalPages}
              page={pagination.page}
              onChange={(_, value) => setPage(value)}
              size="small"
            />
          </Box>
        )}
      </Card>
    </Box>
  )
}

function PageRow({
  page,
  selected,
  onToggle,
  onOpen,
}: {
  page: PageListItem
  selected: boolean
  onToggle(): void
  onOpen(): void
}) {
  const statusColor = getPageStatusColor(page.status)

  return (
    <TableRow hover sx={{ cursor: 'pointer' }}>
      <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggle} />
      </TableCell>
      <TableCell onClick={onOpen}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {page.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            /{page.slug}
          </Typography>
        </Box>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Typography variant="body2" color="text.secondary">
          {getPageTypeLabel(page.page_type)}
        </Typography>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Chip
          size="small"
          label={getPageStatusLabel(page.status)}
          sx={{
            bgcolor: statusColor,
            color: '#FFFFFF',
            fontWeight: 500,
            fontSize: 11,
          }}
        />
      </TableCell>
      <TableCell onClick={onOpen}>
        <Stack direction="row" spacing={0.5}>
          {page.is_indexable && (
            <Chip size="small" label="Indexed" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
          )}
          {page.show_in_sitemap && (
            <Chip size="small" label="Sitemap" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
          )}
        </Stack>
      </TableCell>
      <TableCell align="right" onClick={onOpen}>
        <Typography variant="body2" color="text.secondary">
          {page.section_count}
        </Typography>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {page.author_name ?? '—'}
        </Typography>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Typography variant="caption" color="text.secondary">
          {formatRelative(page.updated_at)}
        </Typography>
      </TableCell>
    </TableRow>
  )
}
