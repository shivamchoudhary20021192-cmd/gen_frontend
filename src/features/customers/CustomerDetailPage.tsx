import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PushPinIcon from '@mui/icons-material/PushPin'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { SendMessageDialog } from '../messaging/SendMessageDialog'
import { formatDate, formatMoney, formatMoneyIn, formatRelative } from '../../lib/format'
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
} from '../orders/statusMeta'
import { useOrderList } from '../orders/useOrders'
import {
  useAddCustomerNote,
  useBlockCustomer,
  useCustomer,
  useDeleteCustomerNote,
  useUnblockCustomer,
  useUpdateCustomer,
  type CustomerDetail,
} from './useCustomers'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const customerId = id ? Number(id) : undefined
  const query = useCustomer(customerId)
  const customer = query.data?.customer

  const [blockOpen, setBlockOpen] = useState(false)
  // Messaging opens from here rather than from a separate screen: the decision
  // to message someone is made while looking at what they bought.
  const [messageOpen, setMessageOpen] = useState(false)
  const unblock = useUnblockCustomer(customerId ?? 0)

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  if (query.isError || !customer || !customerId) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load that customer.
        </Alert>
        <Button onClick={() => navigate('/customers')}>Back to customers</Button>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        back={
          <Button
            component={Link}
            to="/customers"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ mb: 1, ml: -1 }}
          >
            Customers
          </Button>
        }
        title={customer.name || 'Unnamed customer'}
        subtitle={`Joined ${formatRelative(customer.created_at)}`}
        actions={
          <>
            <Button variant="outlined" onClick={() => setMessageOpen(true)}>
              Message
            </Button>
            {customer.status === 'blocked' ? (
              <Button variant="outlined" onClick={() => unblock.mutate()} disabled={unblock.isPending}>
                {unblock.isPending ? 'Unblocking…' : 'Unblock'}
              </Button>
            ) : (
              <Button color="error" variant="outlined" onClick={() => setBlockOpen(true)}>
                Block
              </Button>
            )}
          </>
        }
      />

      {customer.status === 'blocked' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          This customer is blocked. Their sessions have been revoked and they cannot sign in or order.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <StatsCard customer={customer} />
          <OrderHistoryCard customerId={customerId} />
          <NotesCard customer={customer} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ContactCard customer={customer} />
          <MarketingCard customer={customer} />
          <AddressesCard customer={customer} />
        </Grid>
      </Grid>

      <BlockDialog open={blockOpen} onClose={() => setBlockOpen(false)} customer={customer} />
      <SendMessageDialog customerId={customerId} open={messageOpen} onClose={() => setMessageOpen(false)} />
    </Box>
  )
}

function StatsCard({ customer }: { customer: CustomerDetail }) {
  const stats: [string, string][] = [
    ['Orders', String(customer.stats.orders_count)],
    ['Lifetime spend', formatMoney(customer.stats.total_spent)],
    ['Average order', formatMoney(customer.stats.average_order_value)],
    ['Last order', formatRelative(customer.stats.last_order_at)],
  ]
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Grid container spacing={2}>
          {stats.map(([label, value]) => (
            <Grid key={label} size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.25 }}>
                {value}
              </Typography>
            </Grid>
          ))}
        </Grid>
        {customer.stats.rto_count > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {customer.stats.rto_count} {customer.stats.rto_count === 1 ? 'parcel has' : 'parcels have'} come
            back undelivered. Consider turning off cash on delivery for this customer.
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Order history comes from the orders endpoint filtered by customer, not from
 * the customer payload — one source of truth for what an order is, and the rows
 * link straight through to the order screen.
 */
function OrderHistoryCard({ customerId }: { customerId: number }) {
  const navigate = useNavigate()
  const orders = useOrderList({ customer_id: customerId, limit: 20, sort: 'placed_at:desc' })
  const rows = orders.data?.orders ?? []

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: rows.length > 0 ? 0 : undefined }}>
        <Typography variant="subtitle2">Orders</Typography>
      </CardContent>
      {orders.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
          <CircularProgress size={22} />
        </Box>
      ) : rows.length === 0 ? (
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            This customer has not ordered yet.
          </Typography>
        </CardContent>
      ) : (
        <TableContainer sx={{ mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Placed</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((order) => (
                // Navigated by click rather than `component={Link}`: an anchor
                // as a table row puts <a> inside <tbody> and <td> inside <a>,
                // which is invalid HTML and which React warns about.
                <TableRow
                  key={order.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{order.order_number}</TableCell>
                  <TableCell>{formatDate(order.placed_at)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ORDER_STATUS_LABEL[order.order_status] ?? order.order_status}
                      color={ORDER_STATUS_COLOR[order.order_status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
                      color={PAYMENT_STATUS_COLOR[order.payment_status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">{order.currency ? formatMoneyIn(order.grand_total, order.currency) : formatMoney(order.grand_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}

function ContactCard({ customer }: { customer: CustomerDetail }) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Contact
        </Typography>
        <Stack spacing={1}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Phone
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {customer.country_code} {customer.phone}
              </Typography>
              {customer.phone_verified && <Chip size="small" color="success" label="Verified" />}
            </Stack>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Email
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {customer.email ?? '—'}
              </Typography>
              {customer.email && customer.email_verified && (
                <Chip size="small" color="success" label="Verified" />
              )}
            </Stack>
          </Box>
          {customer.date_of_birth && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Date of birth
              </Typography>
              <Typography variant="body2">{formatDate(customer.date_of_birth)}</Typography>
            </Box>
          )}
          {customer.signup_source && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Signed up via
              </Typography>
              <Typography variant="body2">{customer.signup_source}</Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

function MarketingCard({ customer }: { customer: CustomerDetail }) {
  const update = useUpdateCustomer(customer.id)
  const [error, setError] = useState<string | null>(null)

  const toggle = (field: 'accepts_email_marketing' | 'accepts_sms_marketing' | 'accepts_whatsapp_marketing' | 'cod_blocked', value: boolean) => {
    setError(null)
    update.mutate({ [field]: value }, { onError: (caught) => setError(errorText(caught)) })
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Consent & flags
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <Stack>
          <FormControlLabel
            control={
              <Switch
                checked={customer.marketing.email}
                onChange={(event) => toggle('accepts_email_marketing', event.target.checked)}
              />
            }
            label="Email marketing"
          />
          <FormControlLabel
            control={
              <Switch
                checked={customer.marketing.sms}
                onChange={(event) => toggle('accepts_sms_marketing', event.target.checked)}
              />
            }
            label="SMS marketing"
          />
          <FormControlLabel
            control={
              <Switch
                checked={customer.marketing.whatsapp}
                onChange={(event) => toggle('accepts_whatsapp_marketing', event.target.checked)}
              />
            }
            label="WhatsApp marketing"
          />
          <Divider sx={{ my: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={customer.cod_blocked}
                onChange={(event) => toggle('cod_blocked', event.target.checked)}
              />
            }
            label="Block cash on delivery"
          />
        </Stack>
        {customer.consents.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Latest consent recorded {formatDate(customer.consents[0].recorded_at)}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

function AddressesCard({ customer }: { customer: CustomerDetail }) {
  if (customer.addresses.length === 0) return null
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Addresses
        </Typography>
        <Stack spacing={2}>
          {customer.addresses.map((address) => (
            <Box key={address.id}>
              <Stack direction="row" spacing={0.75} sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                {address.label && <Chip size="small" label={address.label} />}
                {address.is_default_shipping && <Chip size="small" color="info" label="Default delivery" />}
              </Stack>
              <Typography variant="body2" component="div" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                <div>{address.line1}</div>
                {address.line2 && <div>{address.line2}</div>}
                <div>
                  {address.city}, {address.state} {address.pincode}
                </div>
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

function NotesCard({ customer }: { customer: CustomerDetail }) {
  const add = useAddCustomerNote(customer.id)
  const remove = useDeleteCustomerNote(customer.id)
  const [note, setNote] = useState('')
  const [pinned, setPinned] = useState(false)

  const submit = () => {
    if (!note.trim()) return
    add.mutate(
      { note: note.trim(), is_pinned: pinned },
      {
        onSuccess: () => {
          setNote('')
          setPinned(false)
        },
      },
    )
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Internal notes
        </Typography>

        <TextField
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Only staff can see this"
          fullWidth
          multiline
          minRows={2}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
          <Button size="small" variant="outlined" onClick={submit} disabled={!note.trim() || add.isPending}>
            {add.isPending ? 'Saving…' : 'Add note'}
          </Button>
          <FormControlLabel
            control={<Switch size="small" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />}
            label={<Typography variant="body2">Pin</Typography>}
          />
        </Stack>

        {customer.notes.length > 0 && (
          <Stack spacing={1.5} sx={{ mt: 2.5 }}>
            {customer.notes.map((entry) => (
              <Box key={entry.id}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
                  {entry.is_pinned && <PushPinIcon sx={{ fontSize: 14, mt: 0.35, color: 'text.secondary' }} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2">{entry.note}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entry.author} · {formatRelative(entry.created_at)}
                    </Typography>
                  </Box>
                  <Button size="small" color="inherit" onClick={() => remove.mutate(entry.id)}>
                    Delete
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function BlockDialog({
  open,
  onClose,
  customer,
}: {
  open: boolean
  onClose: () => void
  customer: CustomerDetail
}) {
  const block = useBlockCustomer(customer.id)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Block {customer.name || 'this customer'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Alert severity="warning" sx={{ mb: 2 }}>
          Blocking signs them out everywhere and stops them ordering. It can be undone.
        </Alert>
        <TextField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Four consecutive RTOs, no response to calls"
          fullWidth
          multiline
          minRows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          disabled={block.isPending}
          onClick={() => {
            setError(null)
            block.mutate(
              { reason: reason.trim() || null },
              {
                onSuccess: () => {
                  setReason('')
                  onClose()
                },
                onError: (caught) => setError(errorText(caught)),
              },
            )
          }}
        >
          {block.isPending ? 'Blocking…' : 'Block customer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
