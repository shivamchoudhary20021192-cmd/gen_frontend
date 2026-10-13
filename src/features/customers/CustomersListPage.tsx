import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { formatMoney, formatRelative } from '../../lib/format'
import { useCustomerList } from './useCustomers'

const SORTS = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'total_spent:desc', label: 'Highest spend' },
  { value: 'orders_count:desc', label: 'Most orders' },
  { value: 'last_order_at:desc', label: 'Most recent order' },
]

export function CustomersListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const search = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const sort = params.get('sort') ?? 'created_at:desc'
  const hasOrders = params.get('has_orders') === 'true'
  const page = Number(params.get('page') ?? 1)

  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed === search) return
      update({ q: trimmed || undefined })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const query = useMemo(
    () => ({
      page,
      limit: 25,
      q: search || undefined,
      status: status || undefined,
      has_orders: hasOrders || undefined,
      sort,
    }),
    [page, search, status, hasOrders, sort],
  )

  const list = useCustomerList(query)
  const rows = list.data?.customers ?? []
  const pagination = list.data?.pagination
  const hasFilters = Boolean(search || status || hasOrders)

  return (
    <Box>
      <PageHeader title="Customers" subtitle={pagination ? `${pagination.total} total` : undefined} />

      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, phone or email"
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
            onChange={(event) => update({ status: event.target.value || undefined })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All customers</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
          </TextField>
          <TextField
            select
            label="Orders"
            value={hasOrders ? 'yes' : ''}
            onChange={(event) => update({ has_orders: event.target.value === 'yes' ? 'true' : undefined })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Everyone</MenuItem>
            <MenuItem value="yes">Has ordered</MenuItem>
          </TextField>
          <TextField
            select
            label="Sort"
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            sx={{ minWidth: 190 }}
          >
            {SORTS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
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
            Could not load customers.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: hasFilters ? 2 : 0 }}>
              {hasFilters ? 'No customers match these filters.' : 'No customers yet.'}
            </Typography>
            {hasFilters && (
              <Button variant="outlined" onClick={() => setParams(new URLSearchParams())}>
                Clear filters
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="right">Orders</TableCell>
                  <TableCell align="right">Spent</TableCell>
                  <TableCell>Last order</TableCell>
                  <TableCell>Flags</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((customer) => (
                  <TableRow
                    key={customer.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {customer.name || 'Unnamed'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Joined {formatRelative(customer.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {/* Masked by the API on lists, in full on the detail page.
                          Browsing a table should not put ten thousand phone
                          numbers on a screen someone may be sharing. */}
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {customer.phone}
                      </Typography>
                      {customer.email && (
                        <Typography variant="caption" color="text.secondary">
                          {customer.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{customer.stats.orders_count}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatMoney(customer.stats.total_spent)}
                      </Typography>
                      {customer.stats.orders_count > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {formatMoney(customer.stats.average_order_value)} avg
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatRelative(customer.stats.last_order_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {customer.status === 'blocked' && <Chip size="small" color="error" label="Blocked" />}
                        {customer.cod_blocked && (
                          <Tooltip title="Cash on delivery is hidden for this customer at checkout">
                            <Chip size="small" color="warning" label="No COD" />
                          </Tooltip>
                        )}
                        {customer.stats.rto_count > 0 && (
                          <Tooltip title="Parcels returned to origin — usually refused on delivery">
                            <Chip size="small" color="warning" label={`${customer.stats.rto_count} RTO`} />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
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
              onChange={(_event, value) => update({ page: String(value) })}
              size="small"
            />
          </Box>
        )}
      </Card>
    </Box>
  )
}
