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
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { formatMoneyIn, formatRelative } from '../../lib/format'
import {
  FULFILLMENT_COLOR,
  FULFILLMENT_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  paymentMethodLabel,
} from './statusMeta'
import { useOrderCounts, useOrderList } from './useOrders'

/**
 * Tabs are the statuses an operator works *through*, in the order the day
 * happens. Cancelled, returned and RTO are reachable from the status filter
 * rather than the tab bar — they are exceptions to investigate, not a queue.
 */
const TABS: { value: string; label: string; countKey?: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending', countKey: 'pending' },
  { value: 'confirmed', label: 'Confirmed', countKey: 'confirmed' },
  { value: 'processing', label: 'Processing', countKey: 'processing' },
  { value: 'packed', label: 'Packed', countKey: 'packed' },
  { value: 'shipped', label: 'Shipped', countKey: 'shipped' },
  { value: 'delivered', label: 'Delivered', countKey: 'delivered' },
]

export function OrdersListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const status = params.get('status') ?? ''
  const paymentStatus = params.get('payment_status') ?? ''
  const paymentMethod = params.get('payment_method') ?? ''
  const search = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1)

  const [searchInput, setSearchInput] = useState(search)

  // Debounced so typing an order number does not fire a request per keystroke.
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
    // Any change to what is being filtered starts again at page one — leaving
    // someone on page 6 of a narrower result set shows them nothing.
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const query = useMemo(
    () => ({
      page,
      limit: 25,
      q: search || undefined,
      order_status: status || undefined,
      payment_status: paymentStatus || undefined,
      payment_method: paymentMethod || undefined,
      sort: 'placed_at:desc',
    }),
    [page, search, status, paymentStatus, paymentMethod],
  )

  const list = useOrderList(query)
  const counts = useOrderCounts()

  const rows = list.data?.orders ?? []
  const pagination = list.data?.pagination
  const hasFilters = Boolean(search || status || paymentStatus || paymentMethod)

  return (
    <Box>
      <PageHeader title="Orders" subtitle={pagination ? `${pagination.total} total` : undefined} />

      <Card sx={{ mb: 2 }}>
        <Tabs
          value={status}
          onChange={(_event, value: string) => update({ status: value || undefined })}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((tab) => {
            const count = tab.countKey ? counts.data?.counts?.[tab.countKey] : undefined
            return (
              <Tab
                key={tab.value}
                value={tab.value}
                label={
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <span>{tab.label}</span>
                    {count !== undefined && count > 0 && (
                      <Chip size="small" label={count} sx={{ height: 18, fontSize: 11 }} />
                    )}
                  </Stack>
                }
              />
            )
          })}
        </Tabs>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search order number, name, phone or email"
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
            label="Payment"
            value={paymentStatus}
            onChange={(event) => update({ payment_status: event.target.value || undefined })}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Any payment status</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="cod_pending">COD — to collect</MenuItem>
            <MenuItem value="cod_collected">COD collected</MenuItem>
            <MenuItem value="pending">Payment pending</MenuItem>
            <MenuItem value="partially_refunded">Partly refunded</MenuItem>
            <MenuItem value="refunded">Refunded</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </TextField>
          <TextField
            select
            label="Method"
            value={paymentMethod}
            onChange={(event) => update({ payment_method: event.target.value || undefined })}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">Any method</MenuItem>
            <MenuItem value="cod">Cash on delivery</MenuItem>
            <MenuItem value="razorpay">Razorpay</MenuItem>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="card">Card</MenuItem>
            <MenuItem value="netbanking">Net banking</MenuItem>
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
            Could not load orders.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: hasFilters ? 2 : 0 }}>
              {hasFilters ? 'No orders match these filters.' : 'No orders yet.'}
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
                  <TableCell>Order</TableCell>
                  <TableCell>Placed</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Fulfilment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {order.order_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatRelative(order.placed_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.customer.name ?? '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.customer.phone ?? order.customer.email ?? ''}
                        {order.customer.is_guest ? ' · Guest' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
                        color={PAYMENT_STATUS_COLOR[order.payment_status] ?? 'default'}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {paymentMethodLabel(order.payment_method)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={FULFILLMENT_LABEL[order.fulfillment_status] ?? order.fulfillment_status}
                        color={FULFILLMENT_COLOR[order.fulfillment_status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={ORDER_STATUS_LABEL[order.order_status] ?? order.order_status}
                        color={ORDER_STATUS_COLOR[order.order_status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatMoneyIn(order.grand_total, order.currency)}
                      </Typography>
                      {order.amount_refunded > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          −{formatMoneyIn(order.amount_refunded, order.currency)} refunded
                        </Typography>
                      )}
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
