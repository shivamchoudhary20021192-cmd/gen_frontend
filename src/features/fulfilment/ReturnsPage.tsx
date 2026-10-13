import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  Link as MuiLink,
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
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { formatMoney, formatRelative } from '../../lib/format'
import {
  CONDITION_LABEL,
  RESTOCKABLE_CONDITIONS,
  RETURN_ACTION_LABEL,
  RETURN_REASON_LABEL,
  RETURN_STATUS_COLOR,
  RETURN_STATUS_LABEL,
} from './fulfilmentMeta'
import {
  useInspectReturn,
  useRefundReturn,
  useReturn,
  useReturnCounts,
  useReturnList,
  useReturnStatus,
  useSchedulePickup,
  type ReturnStatus,
} from './useFulfilment'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

const TABS: { value: string; label: string; countKey?: string }[] = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Awaiting decision', countKey: 'requested' },
  { value: 'approved', label: 'Approved', countKey: 'approved' },
  { value: 'pickup_scheduled', label: 'Pickup booked', countKey: 'pickup_scheduled' },
  { value: 'received', label: 'To inspect', countKey: 'received' },
  { value: 'inspected', label: 'To refund', countKey: 'inspected' },
  { value: 'refunded', label: 'Refunded', countKey: 'refunded' },
]

export function ReturnsPage() {
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<number | null>(null)

  const status = params.get('status') ?? ''
  const search = params.get('q') ?? ''
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
    () => ({ page, limit: 25, q: search || undefined, status: status || undefined }),
    [page, search, status],
  )

  const list = useReturnList(query)
  const counts = useReturnCounts()
  const rows = list.data?.returns ?? []
  const pagination = list.data?.pagination

  return (
    <Box>
      <PageHeader title="Returns & refunds" subtitle={pagination ? `${pagination.total} total` : undefined} />

      <Card sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ px: 2, pt: 2, flexWrap: 'wrap', gap: 1 }}>
          {TABS.map((tab) => {
            const count = tab.countKey ? counts.data?.counts?.[tab.countKey] : undefined
            const active = status === tab.value
            return (
              <Chip
                key={tab.value}
                label={count !== undefined && count > 0 ? `${tab.label} (${count})` : tab.label}
                onClick={() => update({ status: tab.value || undefined })}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                size="small"
              />
            )
          })}
        </Stack>

        <Box sx={{ p: 2 }}>
          <TextField
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search RMA, order number or phone"
            fullWidth
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
        </Box>
      </Card>

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : list.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load returns.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              {search || status ? 'No returns match these filters.' : 'No returns yet.'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Returns are raised from a delivered order.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>RMA</TableCell>
                  <TableCell>Order</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Raised</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={entry.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(entry.id)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {entry.rma_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.item_count} item{entry.item_count === 1 ? '' : 's'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {entry.order.order_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.customer.name ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{RETURN_REASON_LABEL[entry.reason] ?? entry.reason}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={RETURN_STATUS_LABEL[entry.status] ?? entry.status}
                        color={RETURN_STATUS_COLOR[entry.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatRelative(entry.requested_at)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatMoney(entry.approved_amount ?? entry.requested_amount)}
                      </Typography>
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

      <ReturnDialog id={openId} onClose={() => setOpenId(null)} />
    </Box>
  )
}

function ReturnDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const query = useReturn(id ?? undefined)
  const rma = query.data?.return
  const changeStatus = useReturnStatus(id ?? 0)
  const pickup = useSchedulePickup(id ?? 0)
  const inspect = useInspectReturn(id ?? 0)
  const refund = useRefundReturn(id ?? 0)

  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [inspecting, setInspecting] = useState(false)

  const act = (status: ReturnStatus) => {
    setError(null)
    // Three statuses need more than a click: rejection needs a reason the
    // customer will read, pickup calls a carrier, inspection records condition.
    if (status === 'rejected') return setRejecting(true)
    if (status === 'pickup_scheduled') {
      return pickup.mutate({}, { onError: (caught) => setError(errorText(caught)) })
    }
    if (status === 'inspected') return setInspecting(true)
    if (status === 'refunded') {
      return refund.mutate({}, { onError: (caught) => setError(errorText(caught)) })
    }
    changeStatus.mutate({ status }, { onError: (caught) => setError(errorText(caught)) })
  }

  return (
    <Dialog open={id !== null} onClose={onClose} fullWidth maxWidth="md">
      {query.isLoading || !rma ? (
        <DialogContent>
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        </DialogContent>
      ) : (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{rma.rma_number}</span>
              <Chip
                size="small"
                label={RETURN_STATUS_LABEL[rma.status] ?? rma.status}
                color={RETURN_STATUS_COLOR[rma.status] ?? 'default'}
              />
            </Stack>
          </DialogTitle>

          <DialogContent dividers>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {rma.rejection_reason && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Rejected — {rma.rejection_reason}
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Order
                </Typography>
                <Typography variant="body2">
                  <MuiLink component={Link} to={`/orders/${rma.order.id}`} onClick={onClose}>
                    {rma.order.order_number}
                  </MuiLink>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Delivered {formatRelative(rma.order.delivered_at)}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Reason
                </Typography>
                <Typography variant="body2">{RETURN_REASON_LABEL[rma.reason] ?? rma.reason}</Typography>
                {rma.reason_detail && (
                  <Typography variant="caption" color="text.secondary">
                    {rma.reason_detail}
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Refund
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatMoney(rma.approved_amount ?? rma.requested_amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatMoney(rma.order.refundable)} still refundable on the order
                </Typography>
              </Box>
              {rma.pickup_awb && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Reverse pickup
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {rma.pickup_awb}
                  </Typography>
                </Box>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Coming back
            </Typography>
            <Stack spacing={1}>
              {rma.items.map((item) => (
                <Stack key={item.id} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2">
                      {item.name}
                      {item.variant_title ? ` · ${item.variant_title}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ×{item.quantity}
                      {item.condition ? ` · ${CONDITION_LABEL[item.condition] ?? item.condition}` : ''}
                      {item.restock ? ' · restocked' : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2">{formatMoney(item.refund_amount)}</Typography>
                </Stack>
              ))}
            </Stack>

            {rma.inspection_note && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Inspection
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {rma.inspection_note}
                </Typography>
              </>
            )}
          </DialogContent>

          <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
            {rma.next_statuses.map((next) => (
              <Button
                key={next}
                size="small"
                variant={next === 'approved' || next === 'refunded' ? 'contained' : 'outlined'}
                color={next === 'rejected' ? 'error' : 'primary'}
                disabled={changeStatus.isPending || pickup.isPending || refund.isPending}
                onClick={() => act(next)}
              >
                {RETURN_ACTION_LABEL[next]}
              </Button>
            ))}
            <Box sx={{ flex: 1 }} />
            <Button onClick={onClose}>Close</Button>
          </DialogActions>

          <Dialog open={rejecting} onClose={() => setRejecting(false)} fullWidth maxWidth="xs">
            <DialogTitle>Reject {rma.rma_number}</DialogTitle>
            <DialogContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                The customer sees this reason. Say what would have made it eligible if anything would.
              </Alert>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={2}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Opened cosmetics cannot be resold under Indian law"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRejecting(false)}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                disabled={rejectReason.trim().length < 3}
                onClick={() => {
                  setRejecting(false)
                  changeStatus.mutate(
                    { status: 'rejected', reason: rejectReason.trim() },
                    { onError: (caught) => setError(errorText(caught)), onSuccess: () => setRejectReason('') },
                  )
                }}
              >
                Reject
              </Button>
            </DialogActions>
          </Dialog>

          <InspectDialog
            open={inspecting}
            onClose={() => setInspecting(false)}
            items={rma.items}
            pending={inspect.isPending}
            onSubmit={(body) => {
              setInspecting(false)
              inspect.mutate(body, { onError: (caught) => setError(errorText(caught)) })
            }}
          />
        </>
      )}
    </Dialog>
  )
}

/**
 * Records what actually came back.
 *
 * This is the step that touches inventory, so condition is per line rather than
 * per return — a parcel of three often contains one sellable unit and two that
 * are not. Restock defaults from the condition, because "unopened" is the only
 * state an Indian cosmetic can legally go back on the shelf in, and leaving that
 * to the operator every time is how used stock gets resold.
 */
function InspectDialog({
  open,
  onClose,
  items,
  pending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  items: { id: number; name: string; variant_title: string | null; quantity: number }[]
  pending: boolean
  onSubmit: (body: {
    note?: string | null
    items: { id: number; condition: string; restock: boolean }[]
  }) => void
}) {
  const [state, setState] = useState<Record<number, { condition: string; restock: boolean }>>({})
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setState(Object.fromEntries(items.map((item) => [item.id, { condition: 'unopened', restock: true }])))
  }, [open, items])

  const setCondition = (itemId: number, condition: string) => {
    setState((current) => ({
      ...current,
      [itemId]: { condition, restock: RESTOCKABLE_CONDITIONS.has(condition) },
    }))
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Inspect the return</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Anything marked for restock goes back into sellable stock immediately.
        </Typography>
        <Stack spacing={2.5}>
          {items.map((item) => (
            <Box key={item.id}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {item.name}
                {item.variant_title ? ` · ${item.variant_title}` : ''} ×{item.quantity}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
                <TextField
                  select
                  label="Condition"
                  size="small"
                  value={state[item.id]?.condition ?? 'unopened'}
                  onChange={(event) => setCondition(item.id, event.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={state[item.id]?.restock ?? false}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], restock: event.target.checked },
                        }))
                      }
                    />
                  }
                  label="Put back in stock"
                />
              </Stack>
            </Box>
          ))}
        </Stack>
        <TextField
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Seal intact, box scuffed in transit"
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 3 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={pending}
          onClick={() =>
            onSubmit({
              note: note.trim() || null,
              items: items.map((item) => ({
                id: item.id,
                condition: state[item.id]?.condition ?? 'unknown',
                restock: state[item.id]?.restock ?? false,
              })),
            })
          }
        >
          {pending ? 'Recording…' : 'Record inspection'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
