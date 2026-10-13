import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Link as MuiLink,
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
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { formatDate, formatMoneyIn, formatRelative, taxLineLabel } from '../../lib/format'
import { OrderActions } from './OrderActions'
import {
  FULFILLMENT_COLOR,
  FULFILLMENT_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  paymentMethodLabel,
} from './statusMeta'
import { useOrder, useSetOrderNote, type OrderAddress, type OrderDetail } from './useOrders'

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const query = useOrder(id ? Number(id) : undefined)
  const order = query.data?.order

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  if (query.isError || !order) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load that order.
        </Alert>
        <Button onClick={() => navigate('/orders')}>Back to orders</Button>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        back={
          <Button
            component={Link}
            to="/orders"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ mb: 1, ml: -1 }}
          >
            Orders
          </Button>
        }
        title={order.order_number}
        subtitle={`Placed ${formatRelative(order.placed_at)} · ${paymentMethodLabel(order.payment_method)}`}
        actions={
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={ORDER_STATUS_LABEL[order.order_status] ?? order.order_status}
              color={ORDER_STATUS_COLOR[order.order_status] ?? 'default'}
            />
            <Chip
              size="small"
              label={PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
              color={PAYMENT_STATUS_COLOR[order.payment_status] ?? 'default'}
            />
            <Chip
              size="small"
              label={FULFILLMENT_LABEL[order.fulfillment_status] ?? order.fulfillment_status}
              color={FULFILLMENT_COLOR[order.fulfillment_status] ?? 'default'}
            />
          </Stack>
        }
      />

      {order.cancellation && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Cancelled {order.cancellation.at ? formatDate(order.cancellation.at) : ''}
          {order.cancellation.by ? ` by ${order.cancellation.by}` : ''}
          {order.cancellation.reason ? ` — ${order.cancellation.reason}` : ''}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <OrderActions order={order} />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <ItemsCard order={order} />
          <ShipmentsCard order={order} />
          <PaymentsCard order={order} />
          <TimelineCard order={order} />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CustomerCard order={order} />
          <AddressCard title="Delivery address" address={order.shipping_address} />
          <AddressCard title="Billing address" address={order.billing_address} />
          <NotesCard order={order} />
        </Grid>
      </Grid>
    </Box>
  )
}

function ItemsCard({ order }: { order: OrderDetail }) {
  const t = order.totals
  // Tax either sits inside the prices (GST, VAT) or is added on top (US sales
  // tax, Canada); the totals say which.
  const beforeTax = t.subtotal - t.discount_total + t.shipping_total + t.cod_fee
  const taxAdded = t.tax_total > 0 && Math.abs(t.grand_total - beforeTax - t.tax_total) < 0.01
  const taxLines = t.tax_lines ?? []
  const rows: [string, number, boolean?][] = [
    ['Subtotal', t.subtotal],
    ['Discount', -t.discount_total],
    ['Delivery', t.shipping_total],
    ['Cash handling', t.cod_fee],
    ...(taxAdded
      ? taxLines.length > 0
        ? taxLines.map((line): [string, number] => [taxLineLabel(line), line.amount])
        : [['Tax', t.tax_total] as [string, number]]
      : []),
  ]

  return (
    <Card sx={{ mb: 2 }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        bgcolor: 'action.hover',
                        backgroundImage: item.image_url ? `url(${item.image_url})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[item.variant_title, item.sku].filter(Boolean).join(' · ')}
                      </Typography>
                      {item.cancelled_quantity > 0 && (
                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                          {item.cancelled_quantity} cancelled
                        </Typography>
                      )}
                      {item.returned_quantity > 0 && (
                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                          {item.returned_quantity} returned
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatMoneyIn(item.unit_price, order.currency)}</TableCell>
                <TableCell align="right">
                  {item.quantity}
                  {item.fulfilled_quantity > 0 && item.fulfilled_quantity < item.quantity && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {item.fulfilled_quantity} shipped
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{formatMoneyIn(item.line_total, order.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider />
      <CardContent>
        <Stack spacing={0.75} sx={{ maxWidth: 340, ml: 'auto' }}>
          {rows
            .filter(([, value]) => value !== 0)
            .map(([label, value]) => (
              <Stack key={label} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2">{formatMoneyIn(value, order.currency)}</Typography>
              </Stack>
            ))}
          <Divider sx={{ my: 0.5 }} />
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Total
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatMoneyIn(t.grand_total, order.currency)}
            </Typography>
          </Stack>
          {taxAdded ? null : t.tax_total > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
              Including {formatMoneyIn(t.tax_total, order.currency)} tax
              {taxLines.length > 0 ? ` (${taxLines.map((line) => `${line.name} ${formatMoneyIn(line.amount, order.currency)}`).join(', ')})` : ''}
            </Typography>
          )}
          {order.presentment && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
              ≈ {formatMoneyIn(order.presentment.shop_grand_total, order.presentment.shop_currency)} in your store currency at{' '}
              {order.presentment.exchange_rate.toFixed(4)}
            </Typography>
          )}

          <Divider sx={{ my: 0.5 }} />
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Paid
            </Typography>
            <Typography variant="body2">{formatMoneyIn(t.amount_paid, order.currency)}</Typography>
          </Stack>
          {(t.gift_card_total ?? 0) > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between', pl: 2 }}>
              <Typography variant="caption" color="text.secondary">
                of which by gift card
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatMoneyIn(t.gift_card_total!, order.currency)}
              </Typography>
            </Stack>
          )}
          {t.amount_refunded > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Refunded
              </Typography>
              <Typography variant="body2" color="error">
                −{formatMoneyIn(t.amount_refunded, order.currency)}
              </Typography>
            </Stack>
          )}
          {t.amount_due > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Outstanding
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatMoneyIn(t.amount_due, order.currency)}
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

function ShipmentsCard({ order }: { order: OrderDetail }) {
  if (order.shipments.length === 0) return null
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Shipments
        </Typography>
        <Stack spacing={1.5}>
          {order.shipments.map((shipment) => (
            <Box key={shipment.id}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {shipment.carrier ?? 'Courier'} · {shipment.awb_number ?? 'No AWB'}
                </Typography>
                <Chip size="small" label={shipment.status} />
                {shipment.tracking_url && (
                  <MuiLink
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    variant="caption"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                  >
                    Track <OpenInNewIcon sx={{ fontSize: 13 }} />
                  </MuiLink>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {[
                  shipment.shipped_at ? `Shipped ${formatDate(shipment.shipped_at)}` : null,
                  shipment.delivered_at ? `Delivered ${formatDate(shipment.delivered_at)}` : null,
                  shipment.weight_grams ? `${shipment.weight_grams} g` : null,
                  shipment.cod_amount ? `COD ${formatMoneyIn(shipment.cod_amount, order.currency)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

function PaymentsCard({ order }: { order: OrderDetail }) {
  if (order.payments.length === 0 && order.refunds.length === 0) return null
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Payments
        </Typography>
        <Stack spacing={1.25}>
          {order.payments.map((payment) => (
            <Stack key={payment.id} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2">
                  {[payment.gateway, payment.method, payment.instrument].filter(Boolean).join(' · ') ||
                    'Payment'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {payment.status}
                  {payment.captured_at ? ` · ${formatDate(payment.captured_at)}` : ''}
                  {/* Whether the gateway signature verified is the single most
                      important fact about a payment row, so it is stated. */}
                  {payment.gateway ? (payment.signature_verified ? ' · signature verified' : ' · unverified') : ''}
                </Typography>
              </Box>
              <Typography variant="body2">{formatMoneyIn(payment.amount, order.currency)}</Typography>
            </Stack>
          ))}
          {order.refunds.map((refund) => (
            <Stack key={`r${refund.id}`} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="error">
                  Refund — {refund.reason ?? refund.refund_type}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {refund.status} · {formatDate(refund.created_at)}
                </Typography>
              </Box>
              <Typography variant="body2" color="error">
                −{formatMoneyIn(refund.amount, order.currency)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

function TimelineCard({ order }: { order: OrderDetail }) {
  if (order.timeline.length === 0) return null
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          Timeline
        </Typography>
        <Stack spacing={2}>
          {[...order.timeline].reverse().map((entry) => (
            <Stack key={entry.id} direction="row" spacing={1.5}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'text.disabled',
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2">
                    {entry.from ? `${labelFor(entry.from)} → ${labelFor(entry.to)}` : labelFor(entry.to)}
                  </Typography>
                  {/* A fulfilment row reading "Unfulfilled → Fulfilled" beside
                      order rows is ambiguous without saying which track it is. */}
                  {entry.type && entry.type !== 'order' && (
                    <Chip size="small" label={entry.type} sx={{ height: 17, fontSize: 10 }} />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatRelative(entry.at)}
                  {entry.actor ? ` · ${entry.actor}` : entry.actor_type ? ` · ${entry.actor_type}` : ''}
                </Typography>
                {entry.note && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {entry.note}
                  </Typography>
                )}
              </Box>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

function labelFor(status: string): string {
  return (
    ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] ??
    status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  )
}

function CustomerCard({ order }: { order: OrderDetail }) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Customer
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {order.customer.name ?? 'Guest'}
        </Typography>
        {order.customer.phone && (
          <Typography variant="body2" color="text.secondary">
            {order.customer.phone}
          </Typography>
        )}
        {order.customer.email && (
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {order.customer.email}
          </Typography>
        )}
        {order.customer.id ? (
          <Button component={Link} to={`/customers/${order.customer.id}`} size="small" sx={{ mt: 1, ml: -1 }}>
            View customer
          </Button>
        ) : (
          <Chip size="small" label="Guest checkout" sx={{ mt: 1 }} />
        )}
      </CardContent>
    </Card>
  )
}

function AddressCard({ title, address }: { title: string; address: OrderAddress | null }) {
  if (!address) return null
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" component="div" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
          {address.name && <div>{address.name}</div>}
          <div>{address.line1}</div>
          {address.line2 && <div>{address.line2}</div>}
          {address.landmark && <div>{address.landmark}</div>}
          <div>
            {address.city}, {address.state} {address.pincode}
          </div>
          {address.phone && <div>{address.phone}</div>}
          {address.gstin && <div>GSTIN {address.gstin}</div>}
        </Typography>
        {address.delivery_notes && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {address.delivery_notes}
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function NotesCard({ order }: { order: OrderDetail }) {
  const save = useSetOrderNote(order.id)
  const [note, setNote] = useState(order.notes.admin ?? '')

  // Another admin's edit should land here rather than being masked by whatever
  // is in this box.
  useEffect(() => {
    setNote(order.notes.admin ?? '')
  }, [order.notes.admin])

  const dirty = note !== (order.notes.admin ?? '')

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {order.notes.customer && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Note from the customer
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              {order.notes.customer}
            </Alert>
          </>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Internal note
        </Typography>
        <TextField
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Only staff can see this"
          fullWidth
          multiline
          minRows={3}
        />
        <Button
          size="small"
          variant="outlined"
          sx={{ mt: 1 }}
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(note.trim() || null)}
        >
          {save.isPending ? 'Saving…' : 'Save note'}
        </Button>
      </CardContent>
    </Card>
  )
}
