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
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '../../../hooks/useDebounce'
import { tokens } from '../../../theme'
import {
  useBanners,
  useActivateBanner,
  useDeactivateBanner,
  useDeleteBanner,
  useDuplicateBanner,
  useBulkActivate,
  useBulkDeactivate,
  type BannerListItem,
  type BannerPlacement,
  type BannerAudience,
  type BannerStatus,
  getPlacementLabel,
  getAudienceLabel,
  getStatusLabel,
  getStatusColor,
  formatBannerDateRange,
  formatCTR,
  formatNumber,
  formatDateTime,
} from './index'

export function BannersListPage() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [placementFilter, setPlacementFilter] = useState<BannerPlacement | ''>('')
  const [audienceFilter, setAudienceFilter] = useState<BannerAudience | ''>('')
  const [statusFilter, setStatusFilter] = useState<BannerStatus | ''>('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ element: HTMLElement; banner: BannerListItem } | null>(
    null
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const {
    data: bannersData,
    isLoading,
    isError,
    error,
  } = useBanners({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    placement: placementFilter || undefined,
    audience: audienceFilter || undefined,
    status: statusFilter || undefined,
    sort_by: 'priority',
    sort_order: 'desc',
  })

  const banners = bannersData?.data || []
  const pagination = bannersData?.pagination

  // ── Mutations ──────────────────────────────────────────────────────────────
  const activateMutation = useActivateBanner()
  const deactivateMutation = useDeactivateBanner()
  const deleteMutation = useDeleteBanner()
  const duplicateMutation = useDuplicateBanner()
  const bulkActivateMutation = useBulkActivate()
  const bulkDeactivateMutation = useBulkDeactivate()

  // ── Selection ──────────────────────────────────────────────────────────────
  const isAllSelected = banners.length > 0 && selectedIds.length === banners.length
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < banners.length

  const handleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : banners.map((b) => b.id))
  }

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleActivate = async (id: number) => {
    try {
      await activateMutation.mutateAsync(id)
      setSuccessMessage('Banner activated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to activate banner:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleDeactivate = async (id: number) => {
    try {
      await deactivateMutation.mutateAsync(id)
      setSuccessMessage('Banner deactivated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to deactivate banner:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateMutation.mutateAsync(id)
      setSuccessMessage('Banner duplicated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to duplicate banner:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return

    try {
      await deleteMutation.mutateAsync(id)
      setSuccessMessage('Banner deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Failed to delete banner:', err)
    }
    setActionMenuAnchor(null)
  }

  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) return

    try {
      const result = await bulkActivateMutation.mutateAsync({ ids: selectedIds })
      setSuccessMessage(`${result.updated_count} banner(s) activated successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
      setSelectedIds([])
    } catch (err) { 
      console.error('Failed to bulk activate banners:', err)
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return

    try {
      const result = await bulkDeactivateMutation.mutateAsync({ ids: selectedIds })
      setSuccessMessage(`${result.updated_count} banner(s) deactivated successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
      setSelectedIds([])
    } catch (err) {
      console.error('Failed to bulk deactivate banners:', err)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Banners
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/content/banners/new')}
          sx={{ borderRadius: 2 }}
        >
          Create Banner
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
            placeholder="Search banners..."
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

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Placement</InputLabel>
            <Select
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value as BannerPlacement | '')}
              label="Placement"
            >
              <MenuItem value="">All Placements</MenuItem>
              <MenuItem value="announcement_bar">Announcement Bar</MenuItem>
              <MenuItem value="home_hero">Home Hero</MenuItem>
              <MenuItem value="home_carousel">Home Carousel</MenuItem>
              <MenuItem value="category_top">Category Top</MenuItem>
              <MenuItem value="pdp_strip">Product Page Strip</MenuItem>
              <MenuItem value="cart_drawer">Cart Drawer</MenuItem>
              <MenuItem value="checkout">Checkout</MenuItem>
              <MenuItem value="popup">Popup</MenuItem>
              <MenuItem value="footer">Footer</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Audience</InputLabel>
            <Select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value as BannerAudience | '')}
              label="Audience"
            >
              <MenuItem value="">All Audiences</MenuItem>
              <MenuItem value="all">All Visitors</MenuItem>
              <MenuItem value="new_visitors">New Visitors</MenuItem>
              <MenuItem value="returning">Returning</MenuItem>
              <MenuItem value="logged_in">Logged In</MenuItem>
              <MenuItem value="guests">Guests</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BannerStatus | '')}
              label="Status"
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ alignSelf: 'center', mr: 2 }}>
              {selectedIds.length} selected
            </Typography>
            <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={handleBulkActivate}>
              Activate
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityOffIcon />}
              onClick={handleBulkDeactivate}
            >
              Deactivate
            </Button>
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
              <TableCell sx={{ fontWeight: 600 }}>Banner</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Placement</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Audience</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Schedule</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Stats
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
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <Typography color="error">Error loading banners: {error?.message}</Typography>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && banners.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No banners found. Create your first banner to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              banners.map((banner) => (
                <TableRow
                  key={banner.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/content/banners/${banner.id}`)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(banner.id)}
                      onChange={() => handleSelectOne(banner.id)}
                      size="small"
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {banner.name}
                    </Typography>
                    {banner.title && (
                      <Typography variant="caption" color="text.secondary">
                        {banner.title}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{getPlacementLabel(banner.placement)}</Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{getAudienceLabel(banner.audience)}</Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={getStatusLabel(banner.status)}
                      size="small"
                      sx={{
                        bgcolor: getStatusColor(banner.status) + '20',
                        color: getStatusColor(banner.status),
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {formatBannerDateRange(banner.starts_at, banner.ends_at)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {formatNumber(banner.impression_count)} views
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {formatNumber(banner.click_count)} clicks • CTR: {formatCTR(banner.ctr)}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Tooltip title={formatDateTime(banner.updated_at)}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {new Date(banner.updated_at).toLocaleDateString()}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActionMenuAnchor({ element: e.currentTarget, banner })
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
        <MenuItem onClick={() => navigate(`/content/banners/${actionMenuAnchor?.banner.id}`)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => actionMenuAnchor && handleDuplicate(actionMenuAnchor.banner.id)}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        {actionMenuAnchor?.banner.is_active ? (
          <MenuItem onClick={() => actionMenuAnchor && handleDeactivate(actionMenuAnchor.banner.id)}>
            <VisibilityOffIcon fontSize="small" sx={{ mr: 1 }} />
            Deactivate
          </MenuItem>
        ) : (
          <MenuItem onClick={() => actionMenuAnchor && handleActivate(actionMenuAnchor.banner.id)}>
            <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
            Activate
          </MenuItem>
        )}
        <MenuItem
          onClick={() => actionMenuAnchor && handleDelete(actionMenuAnchor.banner.id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  )
}
