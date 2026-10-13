import AddIcon from '@mui/icons-material/Add'
import BoltIcon from '@mui/icons-material/Bolt'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  InputAdornment,
  LinearProgress,
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
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { formatDate, formatMoney } from '../../lib/format'
import { useDiscountList, type DiscountState } from './useDiscounts'

const STATE_COLOR: Record<DiscountState, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  active: 'success',
  scheduled: 'info',
  expired: 'default',
  disabled: 'default',
  exhausted: 'warning',
}

export function DiscountsListPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)

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
      state: state || undefined,
      discount_type: type || undefined,
      sort: 'created_at:desc',
    }),
    [page, search, state, type],
  )

  const list = useDiscountList(params)
  const rows = list.data?.discounts ?? []
  const pagination = list.data?.pagination

  return (
    <Box>
      <PageHeader
        title="Discounts"
        subtitle={pagination ? `${pagination.total} total` : undefined}
        actions={
          can('coupons.manage') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/discounts/new')}>
              Create discount
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
            placeholder="Search code or title"
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
            value={state}
            onChange={(event) => {
              setState(event.target.value)
              setPage(1)
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </TextField>
          <TextField
            select
            label="Type"
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              setPage(1)
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="percentage">Percentage</MenuItem>
            <MenuItem value="fixed_amount">Fixed amount</MenuItem>
            <MenuItem value="free_shipping">Free shipping</MenuItem>
            <MenuItem value="buy_x_get_y">Buy X get Y</MenuItem>
            <MenuItem value="free_gift">Free gift</MenuItem>
          </TextField>
        </Stack>
      </Card>

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : list.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load discounts.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {search || state || type ? 'No discounts match these filters.' : 'No discounts yet.'}
            </Typography>
            {can('coupons.manage') && (
              <Button variant="outlined" onClick={() => navigate('/discounts/new')}>
                Create your first discount
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell>Applies to</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Window</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Used</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((discount) => {
                  const usagePercent =
                    discount.usage_limit_total && discount.usage_limit_total > 0
                      ? Math.min(100, (discount.used_count / discount.usage_limit_total) * 100)
                      : null
                  return (
                    <TableRow
                      key={discount.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/discounts/${discount.id}`)}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          {discount.is_automatic && (
                            <Tooltip title="Applies automatically — no code needed at checkout">
                              <BoltIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                            </Tooltip>
                          )}
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                              {discount.code}
                            </Typography>
                            {discount.title && (
                              <Typography variant="caption" color="text.secondary">
                                {discount.title}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{discount.summary}</Typography>
                        {discount.min_order_amount > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            min {formatMoney(discount.min_order_amount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {discount.applies_to === 'all'
                            ? 'All products'
                            : `${discount.product_count} product${discount.product_count === 1 ? '' : 's'}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={discount.state}
                          color={STATE_COLOR[discount.state]}
                          variant={discount.state === 'active' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {discount.starts_at || discount.ends_at
                            ? `${formatDate(discount.starts_at) } → ${formatDate(discount.ends_at)}`
                            : 'Always'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {discount.used_count}
                          {discount.usage_limit_total ? ` / ${discount.usage_limit_total}` : ''}
                        </Typography>
                        {usagePercent !== null && (
                          <LinearProgress
                            variant="determinate"
                            value={usagePercent}
                            sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                            color={usagePercent >= 100 ? 'warning' : 'primary'}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
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
