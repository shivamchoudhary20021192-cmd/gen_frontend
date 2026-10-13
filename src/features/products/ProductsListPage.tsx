import AddIcon from '@mui/icons-material/Add'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
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
import type { ProductSummary } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../../auth/useAuth'
import { formatPriceRange, formatRelative } from '../../lib/format'
import { tokens } from '../../theme'
import { useBulkProductAction, useCategories, useProductList } from './useProducts'

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  active: 'success',
  draft: 'default',
  in_review: 'warning',
  archived: 'info',
}

export function ProductsListPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

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
      q: search || undefined,
      status: status || undefined,
      category_id: categoryId === '' ? undefined : categoryId,
      sort: 'created_at:desc',
    }),
    [page, search, status, categoryId],
  )

  const list = useProductList(params)
  const categories = useCategories()
  const bulk = useBulkProductAction()

  const rows = list.data?.products ?? []
  const pagination = list.data?.pagination

  const allSelected = rows.length > 0 && selected.length === rows.length

  const runBulk = (action: 'publish' | 'unpublish' | 'archive') => {
    bulk.mutate(
      { ids: selected, action },
      { onSuccess: () => setSelected([]) },
    )
  }

  return (
    <Box>
      <PageHeader
        title="Products"
        subtitle={pagination ? `${pagination.total} total` : undefined}
        actions={
          can('products.create') ? (
            <Button size='small' variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/products/new')}>
              Add product
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
            placeholder="Search name, slug or SKU"
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
              setStatus(event.target.value)
              setPage(1)
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="in_review">In review</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </TextField>
          <TextField
            select
            label="Category"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value === '' ? '' : Number(event.target.value))
              setPage(1)
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All categories</MenuItem>
            {(categories.data?.categories ?? []).map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {'— '.repeat(category.depth)}
                {category.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {selected.length > 0 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ px: 2, py: 1.5, bgcolor: tokens.ivory, alignItems: 'center', borderTop: `1px solid ${tokens.border}` }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {selected.length} selected
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => runBulk('publish')} disabled={bulk.isPending}>
              Publish
            </Button>
            <Button size="small" onClick={() => runBulk('unpublish')} disabled={bulk.isPending}>
              Unpublish
            </Button>
            <Button size="small" color="error" onClick={() => runBulk('archive')} disabled={bulk.isPending}>
              Archive
            </Button>
          </Stack>
        )}

        {/* Bulk publish is per-item on the server: anything failing the
            compliance gate comes back in `skipped` rather than silently not
            happening. Surfacing that is the whole point of the response. */}
        {bulk.data && bulk.data.skipped.length > 0 && (
          <Alert severity="warning" sx={{ m: 2 }} onClose={() => bulk.reset()}>
            {bulk.data.affected} published. {bulk.data.skipped.length} skipped:{' '}
            {bulk.data.skipped.map((s) => `#${s.id} (${s.reason})`).join(', ')}
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
            Could not load products.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {search || status || categoryId ? 'No products match these filters.' : 'No products yet.'}
            </Typography>
            {can('products.create') && (
              <Button variant="outlined" onClick={() => navigate('/products/new')}>
                Create your first product
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
                      onChange={(event) =>
                        setSelected(event.target.checked ? rows.map((r) => r.id) : [])
                      }
                    />
                  </TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="right">Variants</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={selected.includes(product.id)}
                    onToggle={() =>
                      setSelected((current) =>
                        current.includes(product.id)
                          ? current.filter((id) => id !== product.id)
                          : [...current, product.id],
                      )
                    }
                    onOpen={() => navigate(`/products/${product.id}`)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {pagination && pagination.pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Pagination
              count={pagination.pages}
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

function ProductRow({
  product,
  selected,
  onToggle,
  onOpen,
}: {
  product: ProductSummary
  selected: boolean
  onToggle(): void
  onOpen(): void
}) {
  return (
    <TableRow hover sx={{ cursor: 'pointer' }}>
      <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggle} />
      </TableCell>
      <TableCell onClick={onOpen}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              overflow: 'hidden',
              flexShrink: 0,
              bgcolor: tokens.ivory,
              display: 'grid',
              placeItems: 'center',
              color: tokens.taupe,
            }}
          >
            {product.primary_image ? (
              <Box
                component="img"
                src={product.primary_image.url}
                alt={product.primary_image.alt ?? ''}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ImageNotSupportedIcon sx={{ fontSize: 18 }} />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {product.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {product.subtitle ?? product.slug}
            </Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Chip
          size="small"
          label={product.status.replace('_', ' ')}
          color={STATUS_COLOR[product.status] ?? 'default'}
          variant={product.status === 'active' ? 'filled' : 'outlined'}
        />
      </TableCell>
      <TableCell onClick={onOpen}>
        <Typography variant="body2" color="text.secondary">
          {product.category?.name ?? '—'}
        </Typography>
      </TableCell>
      <TableCell align="right" onClick={onOpen}>
        <Typography variant="body2">{formatPriceRange(product.min_price, product.max_price)}</Typography>
      </TableCell>
      <TableCell align="right" onClick={onOpen}>
        <Typography
          variant="body2"
          color={product.inventory_quantity > 0 ? 'text.primary' : 'error.main'}
        >
          {product.inventory_quantity}
        </Typography>
      </TableCell>
      <TableCell align="right" onClick={onOpen}>
        <Typography variant="body2" color="text.secondary">
          {product.variant_count}
        </Typography>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Typography variant="caption" color="text.secondary">
          {formatRelative(product.updated_at)}
        </Typography>
      </TableCell>
    </TableRow>
  )
}
