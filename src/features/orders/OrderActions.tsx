import ReceiptIcon from '@mui/icons-material/ReceiptLong'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { formatMoneyIn } from '../../lib/format'
import { RETURN_REASON_LABEL } from '../fulfilment/fulfilmentMeta'
import {
  useCreateReturn,
  useInvoiceList,
  useIssueInvoice,
  useReturnable,
  type ReturnReason,
} from '../fulfilment/useFulfilment'
import { TRANSITION_LABEL } from './statusMeta'
import {
  useCancelOrder,
  useChangeOrderStatus,
  useRefundOrder,
  useShipOrder,
  type OrderDetail,
  type OrderStatus,
} from './useOrders'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

/**
 * The action bar.
 *
 * Every button here comes from `order.next_statuses`, which the server derives
 * from its transition table. Nothing is hardcoded: if the API stops allowing a
 * move, the button disappears rather than staying on screen to produce a 409.
 * Ship, cancel and refund need more than a status, so they open a dialog; the
 * rest are one call.
 */
export function OrderActions({ order }: { order: OrderDetail }) {
  const [dialog, setDialog] = useState<'ship' | 'cancel' | 'refund' | 'return' | null>(null)
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const changeStatus = useChangeOrderStatus(order.id)

  const simpleTransition = (status: OrderStatus) => {
    setError(null)
    setPendingStatus(status)
    changeStatus.mutate(
      { status },
      {
        onError: (caught) => setError(errorText(caught)),
        onSettled: () => setPendingStatus(null),
      },
    )
  }

  const next = order.next_statuses ?? []
  const canRefund = order.totals.refundable > 0

  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {next.map((status) => {
          if (status === 'shipped') {
            return (
              <Button key={status} variant="contained" onClick={() => setDialog('ship')}>
                Ship
              </Button>
            )
          }
          if (status === 'cancelled') {
            return (
              <Button key={status} color="error" variant="outlined" onClick={() => setDialog('cancel')}>
                Cancel order
              </Button>
            )
          }
          return (
            <Button
              key={status}
              variant={status === 'delivered' || status === 'confirmed' ? 'contained' : 'outlined'}
              disabled={changeStatus.isPending}
              onClick={() => simpleTransition(status)}
            >
              {pendingStatus === status ? 'Working…' : TRANSITION_LABEL[status]}
            </Button>
          )
        })}

        {canRefund && (
          <Button color="error" variant="outlined" onClick={() => setDialog('refund')}>
            Refund
          </Button>
        )}

        {/*
          A return can only be raised on a delivered order, so the button
          appears exactly when that is true rather than being always present
          and refusing.
        */}
        {order.order_status === 'delivered' && (
          <Button variant="outlined" onClick={() => setDialog('return')}>
            Raise a return
          </Button>
        )}

        <InvoiceButton order={order} onError={setError} />

        {next.length === 0 && !canRefund && order.order_status !== 'delivered' && (
          <Typography variant="body2" color="text.secondary">
            This order is closed — no further action is possible.
          </Typography>
        )}
      </Stack>

      <ShipDialog open={dialog === 'ship'} onClose={() => setDialog(null)} order={order} />
      <CancelDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} order={order} />
      <RefundDialog open={dialog === 'refund'} onClose={() => setDialog(null)} order={order} />
      <RaiseReturnDialog open={dialog === 'return'} onClose={() => setDialog(null)} order={order} />
    </>
  )
}

function ShipDialog({ open, onClose, order }: { open: boolean; onClose: () => void; order: OrderDetail }) {
  const ship = useShipOrder(order.id)
  const [awb, setAwb] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [mode, setMode] = useState<'surface' | 'air' | 'express'>('surface')
  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    ship.mutate(
      {
        awb_number: awb.trim() || null,
        tracking_url: trackingUrl.trim() || null,
        shipping_mode: mode,
        weight_grams: weight.trim() ? Number(weight) : null,
      },
      {
        onSuccess: () => {
          setAwb('')
          setTrackingUrl('')
          setWeight('')
          onClose()
        },
        onError: (caught) => setError(errorText(caught)),
      },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Ship {order.order_number}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shipping everything still outstanding on this order. The tracking details go to the customer.
        </Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="AWB number"
            value={awb}
            onChange={(event) => setAwb(event.target.value)}
            placeholder="e.g. 1234567890123"
            fullWidth
          />
          <TextField
            label="Tracking URL"
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            placeholder="https://track.delhivery.com/…"
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as 'surface' | 'air' | 'express')}
              sx={{ flex: 1 }}
            >
              <MenuItem value="surface">Surface</MenuItem>
              <MenuItem value="air">Air</MenuItem>
              <MenuItem value="express">Express</MenuItem>
            </TextField>
            <TextField
              label="Weight"
              value={weight}
              onChange={(event) => setWeight(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="450"
              sx={{ flex: 1 }}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">g</InputAdornment> } }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={ship.isPending}>
          {ship.isPending ? 'Shipping…' : 'Mark as shipped'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CancelDialog({ open, onClose, order }: { open: boolean; onClose: () => void; order: OrderDetail }) {
  const cancel = useCancelOrder(order.id)
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    cancel.mutate(
      { reason: reason.trim(), restock },
      {
        onSuccess: () => {
          setReason('')
          onClose()
        },
        onError: (caught) => setError(errorText(caught)),
      },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cancel {order.order_number}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Alert severity="warning" sx={{ mb: 2 }}>
          Cancelling cannot be undone. The reason is shown to the customer.
        </Alert>
        <TextField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Customer requested cancellation on WhatsApp"
          fullWidth
          multiline
          minRows={2}
        />
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Checkbox checked={restock} onChange={(event) => setRestock(event.target.checked)} />}
          label="Return the items to stock"
        />
        {order.totals.amount_paid > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {formatMoneyIn(order.totals.amount_paid, order.currency)} has been paid on this order.
            {(order.totals.gift_card_total ?? 0) > 0
              ? ` Cancelling returns the ${formatMoneyIn(order.totals.gift_card_total!, order.currency)} paid by gift card to the card; refund the rest separately.`
              : ' Cancelling does not refund it — issue the refund separately.'}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Keep order</Button>
        <Button
          color="error"
          variant="contained"
          onClick={submit}
          disabled={cancel.isPending || reason.trim().length < 3}
        >
          {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RefundDialog({ open, onClose, order }: { open: boolean; onClose: () => void; order: OrderDetail }) {
  const refund = useRefundOrder(order.id)
  const refundable = order.totals.refundable
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = amount.trim() ? Number(amount) : refundable
  const overRefundable = parsed > refundable

  const submit = () => {
    setError(null)
    refund.mutate(
      {
        amount: amount.trim() ? Number(amount) : undefined,
        reason: reason.trim(),
        restock,
      },
      {
        onSuccess: () => {
          setAmount('')
          setReason('')
          onClose()
        },
        onError: (caught) => setError(errorText(caught)),
      },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Refund {order.order_number}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {formatMoneyIn(refundable, order.currency)} is still refundable on this order.
        </Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={String(refundable)}
            helperText={
              overRefundable
                ? `More than the ${formatMoneyIn(refundable, order.currency)} still refundable`
                : 'Leave blank to refund the full remaining amount'
            }
            error={overRefundable}
            fullWidth
            slotProps={{ input: { startAdornment: <InputAdornment position="start">{order.currency}</InputAdornment> } }}
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Damaged in transit — replacement not requested"
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={<Checkbox checked={restock} onChange={(event) => setRestock(event.target.checked)} />}
            label="Return the refunded items to stock"
          />
        </Stack>
        {/* Deliberately honest about what this button does today. */}
        <Alert severity="info" sx={{ mt: 2 }}>
          This records the refund and marks it pending. Money is not moved until the payment gateway is
          connected.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={submit}
          disabled={refund.isPending || reason.trim().length < 3 || overRefundable}
        >
          {refund.isPending ? 'Refunding…' : 'Issue refund'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Issues the tax invoice, or links to the one already issued.
 *
 * An invoice number is permanent and consecutive, so this deliberately does not
 * offer "reissue". Pressing it twice returns the existing document, and the
 * button changes to a download once one exists.
 */
function InvoiceButton({ order, onError }: { order: OrderDetail; onError: (message: string) => void }) {
  const issue = useIssueInvoice()
  const existing = useInvoiceList({ order_id: order.id, type: 'tax_invoice', limit: 1 })
  const invoice = existing.data?.invoices?.[0]

  // Nothing to invoice until the order is real.
  if (['pending', 'cancelled'].includes(order.order_status)) return null

  if (invoice?.pdf_url) {
    return (
      <Button
        variant="outlined"
        href={invoice.pdf_url}
        target="_blank"
        rel="noreferrer"
        startIcon={<ReceiptIcon sx={{ fontSize: 17 }} />}
      >
        {invoice.invoice_number}
      </Button>
    )
  }

  return (
    <Button
      variant="outlined"
      disabled={issue.isPending || existing.isLoading}
      startIcon={<ReceiptIcon sx={{ fontSize: 17 }} />}
      onClick={() =>
        issue.mutate(order.id, {
          onError: (caught) => onError(errorText(caught)),
        })
      }
    >
      {issue.isPending ? 'Issuing…' : 'Issue invoice'}
    </Button>
  )
}

/**
 * Raises a return against a delivered order.
 *
 * The eligible quantities come from the server rather than from the order's own
 * line quantities, because an open RMA already reserves what it claimed — this
 * form cannot offer a unit the create call would then refuse.
 */
function RaiseReturnDialog({ open, onClose, order }: { open: boolean; onClose: () => void; order: OrderDetail }) {
  const returnable = useReturnable(open ? order.id : undefined)
  const create = useCreateReturn()
  const navigate = useNavigate()

  const [reason, setReason] = useState<ReturnReason>('damaged')
  const [detail, setDetail] = useState('')
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuantities({})
    setDetail('')
    setError(null)
  }, [open])

  const items = returnable.data?.items.filter((item) => item.returnable > 0) ?? []
  const window = returnable.data?.window
  const chosen = Object.entries(quantities).filter(([, quantity]) => quantity > 0)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Raise a return on {order.order_number}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/*
          Out of window is a warning rather than a block — staff override it
          every day for a damaged parcel, and a system that refuses outright
          just gets worked around with an untraceable manual refund.
        */}
        {window && !window.in_window && window.days_since_delivery !== null && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Delivered {window.days_since_delivery} days ago, outside the {window.days}-day window. You can still
            raise this, but it is a goodwill return.
          </Alert>
        )}

        {returnable.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Everything on this order has already been returned or is already claimed by an open return.
          </Typography>
        ) : (
          <>
            <TextField
              select
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReturnReason)}
              fullWidth
              sx={{ mb: 2 }}
            >
              {Object.entries(RETURN_REASON_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="What did the customer say?"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Called to say the pump was broken on arrival"
              fullWidth
              multiline
              minRows={2}
              sx={{ mb: 2.5 }}
            />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              What is coming back
            </Typography>
            <Stack spacing={1.5}>
              {items.map((item) => (
                <Stack key={item.order_item_id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2">
                      {item.name}
                      {item.variant_title ? ` · ${item.variant_title}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.returnable} eligible · {formatMoneyIn(item.unit_price, order.currency)} each
                    </Typography>
                  </Box>
                  <TextField
                    select
                    size="small"
                    label="Qty"
                    value={String(quantities[item.order_item_id] ?? 0)}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.order_item_id]: Number(event.target.value),
                      }))
                    }
                    sx={{ width: 100 }}
                  >
                    {Array.from({ length: item.returnable + 1 }).map((_, index) => (
                      <MenuItem key={index} value={String(index)}>
                        {index}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={create.isPending || chosen.length === 0}
          onClick={() => {
            setError(null)
            create.mutate(
              {
                order_id: order.id,
                reason,
                reason_detail: detail.trim() || null,
                items: chosen.map(([id, quantity]) => ({ order_item_id: Number(id), quantity })),
              },
              {
                onSuccess: () => {
                  onClose()
                  navigate('/returns')
                },
                onError: (caught) => setError(errorText(caught)),
              },
            )
          }}
        >
          {create.isPending ? 'Raising…' : 'Raise return'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
