import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Menu,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Publish as PublishIcon,
  Unpublished as UnpublishedIcon,
  ThumbUp as ThumbUpIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '../../../hooks/useDebounce'
import { tokens } from '../../../theme'
import {
  useFAQs,
  useFAQGroups,
  usePublishFAQ,
  useUnpublishFAQ,
  useDeleteFAQ,
  useMarkFAQHelpful,
  type FAQListItem,
  type EntityType,
  getPublishedStatusLabel,
  getPublishedStatusColor,
  formatEntityReference,
  getAnswerPreview,
  formatDateTime,
  formatNumber,
} from './index'

export function FAQsListPage() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<number | ''>('')
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | ''>('')
  const [publishedFilter, setPublishedFilter] = useState<'true' | 'false' | ''>('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ element: HTMLElement; faq: FAQListItem } | null>(
    null
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const {
    data: faqsData,
    isLoading,
    isError,
    error,
  } = useFAQs({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    group_id: groupFilter || undefined,
    entity_type: entityTypeFilter || undefined,
    is_published: publishedFilter === 'true' ? true : publishedFilter === 'false' ? false : undefined,
    sort_by: 'sort_order',
    sort_order: 'asc',
  })

  const { data: groupsData } = useFAQGroups({ limit: 100, is_active: true })

  const faqs = faqsData?.data || []
  const pagination = faqsData?.pagination
  const groups = groupsData?.data || []

  // ── Mutations ──────────────────────────────────────────────────────────────
  const publishMutation = usePublishFAQ()
  const unpublishMutation = useUnpublishFAQ()
  const deleteMutation = useDeleteFAQ()
  const helpfulMutation = useMarkFAQHelpful()

  // ── Selection ──────────────────────────────────────────────────────────────
  const isAllSelected = faqs.length > 0 && selectedIds.length === faqs.length
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < faqs.length

  const handleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : faqs.map((f) => f.id))
  }

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePublish = async (id: number) => {
    try {
      await publishMutation.mutateAsync(id)
      setSuccessMessage('FAQ published successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to publish FAQ:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleUnpublish = async (id: number) => {
    try {
      await unpublishMutation.mutateAsync(id)
      setSuccessMessage('FAQ unpublished successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to unpublish FAQ:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return

    try {
      await deleteMutation.mutateAsync(id)
      setSuccessMessage('FAQ deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to delete FAQ:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleMarkHelpful = async (id: number) => {
    try {
      await helpfulMutation.mutateAsync(id)
      setSuccessMessage('Marked as helpful')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err) {
      console.error('Failed to mark FAQ as helpful:', err)
    }
    setActionMenuAnchor(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          FAQs
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/content/faqs/new')}
          sx={{ borderRadius: 2 }}
        >
          Create FAQ
        </Button>
      </Box>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 2, p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Search"
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
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

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Group</InputLabel>
            <Select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as number | '')}
              label="Group"
            >
              <MenuItem value="">All Groups</MenuItem>
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Entity Type</InputLabel>
            <Select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value as EntityType | '')}
              label="Entity Type"
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="product">Product</MenuItem>
              <MenuItem value="cms_page">CMS Page</MenuItem>
              <MenuItem value="collection">Collection</MenuItem>
              <MenuItem value="category">Category</MenuItem>
              <MenuItem value="article">Article</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value as 'true' | 'false' | '')}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Published</MenuItem>
              <MenuItem value="false">Draft</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Selected Count */}
        {selectedIds.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedIds.length} FAQ{selectedIds.length !== 1 ? 's' : ''} selected
            </Typography>
          </Box>
        )}
      </Card>

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: tokens.ivory }}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isSomeSelected}
                  onChange={handleSelectAll}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Question</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Group</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Entity</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Helpful
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Updated</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography color="error">Error loading FAQs: {error?.message}</Typography>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && faqs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No FAQs found. Create your first FAQ to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              faqs.map((faq) => (
                <TableRow
                  key={faq.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/content/faqs/${faq.id}`)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(faq.id)}
                      onChange={() => handleSelectOne(faq.id)}
                      size="small"
                    />
                  </TableCell>

                  <TableCell sx={{ maxWidth: 400 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      {faq.question}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getAnswerPreview(faq.answer, 80)}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {faq.group_name ? (
                      <Typography variant="body2">{faq.group_name}</Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No group
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {formatEntityReference(faq.entity_type, faq.entity_id)}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={getPublishedStatusLabel(faq.is_published)}
                      size="small"
                      sx={{
                        bgcolor: getPublishedStatusColor(faq.is_published) + '20',
                        color: getPublishedStatusColor(faq.is_published),
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                      <ThumbUpIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
                      <Typography variant="body2">{formatNumber(faq.helpful_count)}</Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Tooltip title={formatDateTime(faq.updated_at)}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {new Date(faq.updated_at).toLocaleDateString()}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActionMenuAnchor({ element: e.currentTarget, faq })
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor?.element}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <MenuItem onClick={() => navigate(`/content/faqs/${actionMenuAnchor?.faq.id}`)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => actionMenuAnchor && handleMarkHelpful(actionMenuAnchor.faq.id)}>
          <ThumbUpIcon fontSize="small" sx={{ mr: 1 }} />
          Mark Helpful
        </MenuItem>
        {actionMenuAnchor?.faq.is_published ? (
          <MenuItem onClick={() => actionMenuAnchor && handleUnpublish(actionMenuAnchor.faq.id)}>
            <UnpublishedIcon fontSize="small" sx={{ mr: 1 }} />
            Unpublish
          </MenuItem>
        ) : (
          <MenuItem onClick={() => actionMenuAnchor && handlePublish(actionMenuAnchor.faq.id)}>
            <PublishIcon fontSize="small" sx={{ mr: 1 }} />
            Publish
          </MenuItem>
        )}
        <MenuItem
          onClick={() => actionMenuAnchor && handleDelete(actionMenuAnchor.faq.id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  )
}
