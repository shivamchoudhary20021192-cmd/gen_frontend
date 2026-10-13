import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { formatDate, formatMoney, formatRelative } from '../../lib/format'
import {
  SHIPMENT_ACTION_LABEL,
  SHIPMENT_STATUS_COLOR,
  SHIPMENT_STATUS_LABEL,
} from './fulfilmentMeta'
import {
  useCancelShipment,
  useCarriers,
  useRefreshTracking,
  useShipment,
  useShipmentCounts,
  useShipmentList,
  useShipmentStatus,
  type ShipmentStatus,
} from './useFulfilment'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

const TABS: { value: string; label: string; countKey?: string }[] = [
  { value: '', label: 'All' },
  { value: 'label_generated', label: 'Ready to hand over', countKey: 'label_generated' },
  { value: 'in_transit', label: 'In transit', countKey: 'in_transit' },
  { value: 'out_for_delivery', label: 'Out for delivery', countKey: 'out_for_delivery' },
  { value: 'ndr', label: 'Delivery failed', countKey: 'ndr' },
  { value: 'delivered', label: 'Delivered', countKey: 'delivered' },
]

export function ShipmentsPage() {
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<number | null>(null)

  const status = params.get('status') ?? ''
  const carrier = params.get('carrier') ?? ''
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
    () => ({
      page,
      limit: 25,
      q: search || undefined,
      status: status || undefined,
      carrier_id: carrier ? Number(carrier) : undefined,
    }),
    [page, search, status, carrier],
  )

  const list = useShipmentList(query)
  const counts = useShipmentCounts()
  const carriers = useCarriers()

  const rows = list.data?.shipments ?? []
  const pagination = list.data?.pagination
  const usingStandIn = (carriers.data?.carriers ?? []).some((c) => c.is_active && !c.is_live)

  return (
    <Box>
      <PageHeader title="Shipments" subtitle={pagination ? `${pagination.total} total` : undefined} />

      {/*
        Stated plainly rather than buried in settings. An operator who believes
        Blue Dart has the parcel, when nothing was ever booked, will tell a
        customer their order is on the way.
      */}
      {usingStandIn && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No courier account is connected yet. Waybills and tracking come from a stand-in that behaves like a
          carrier but has not booked anything — nothing is collected until Shiprocket or Blue Dart is wired up.
        </Alert>
      )}

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

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search shipment, waybill, order or phone"
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
            label="Carrier"
            value={carrier}
            onChange={(event) => update({ carrier: event.target.value || undefined })}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Any carrier</MenuItem>
            {(carriers.data?.carriers ?? []).map((option) => (
              <MenuItem key={option.id} value={String(option.id)}>
                {option.name}
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
            Could not load shipments.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              {search || status || carrier ? 'No shipments match these filters.' : 'Nothing has shipped yet.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Shipment</TableCell>
                  <TableCell>Order</TableCell>
                  <TableCell>Destination</TableCell>
                  <TableCell>Carrier</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Shipped</TableCell>
                  <TableCell align="right">COD</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((shipment) => (
                  <TableRow key={shipment.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(shipment.id)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {shipment.shipment_number}
                      </Typography>
                      {shipment.awb_number && (
                        <Typography variant="caption" color="text.secondary">
                          AWB {shipment.awb_number}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {shipment.order.order_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {shipment.customer.name ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {shipment.destination ? `${shipment.destination.city}, ${shipment.destination.state}` : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {shipment.destination?.pincode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2">{shipment.carrier?.name ?? '—'}</Typography>
                        {shipment.carrier && !shipment.carrier.is_live && (
                          <Tooltip title="Not connected — this waybill came from the stand-in provider">
                            <Chip size="small" label="Stand-in" sx={{ height: 17, fontSize: 10 }} />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}
                        color={SHIPMENT_STATUS_COLOR[shipment.status] ?? 'default'}
                      />
                      {shipment.ndr_attempts > 0 && (
                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                          {shipment.ndr_attempts} failed attempt{shipment.ndr_attempts === 1 ? '' : 's'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatRelative(shipment.shipped_at)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      {shipment.cod_amount > 0 ? (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatMoney(shipment.cod_amount)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Prepaid
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

      <ShipmentDrawer id={openId} onClose={() => setOpenId(null)} />
    </Box>
  )
}

/**
 * Shipment detail as a dialog rather than a page.
 *
 * A parcel is looked at in the middle of working a queue — someone is checking
 * why a delivery failed and then moving to the next row. Losing the filtered
 * list to open one, and having to navigate back, is friction the task does not
 * need.
 */
function ShipmentDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const query = useShipment(id ?? undefined)
  const shipment = query.data?.shipment
  const refresh = useRefreshTracking(id ?? 0)
  const changeStatus = useShipmentStatus(id ?? 0)
  const cancel = useCancelShipment(id ?? 0)

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<ShipmentStatus | null>(null)
  const [reasonFor, setReasonFor] = useState<ShipmentStatus | null>(null)
  const [reason, setReason] = useState('')

  const act = (status: ShipmentStatus) => {
    setError(null)
    // NDR and RTO are the two statuses where "why" is the record. Everything
    // else moves in one click.
    if (status === 'ndr' || status === 'rto_initiated') {
      setReasonFor(status)
      return
    }
    setPending(status)
    changeStatus.mutate(
      { status },
      { onError: (caught) => setError(errorText(caught)), onSettled: () => setPending(null) },
    )
  }

  return (
    <Dialog open={id !== null} onClose={onClose} fullWidth maxWidth="md">
      {query.isLoading || !shipment ? (
        <DialogContent>
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        </DialogContent>
      ) : (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{shipment.shipment_number}</span>
              <Chip
                size="small"
                label={SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}
                color={SHIPMENT_STATUS_COLOR[shipment.status] ?? 'default'}
              />
              {shipment.carrier && !shipment.carrier.is_live && <Chip size="small" label="Stand-in carrier" />}
            </Stack>
          </DialogTitle>

          <DialogContent dividers>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Order
                </Typography>
                <Typography variant="body2">
                  <MuiLink component={Link} to={`/orders/${shipment.order.id}`} onClick={onClose}>
                    {shipment.order.order_number}
                  </MuiLink>
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Waybill
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {shipment.awb_number ?? '—'}
                </Typography>
                {shipment.tracking_url && (
                  <MuiLink
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    variant="caption"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                  >
                    Track <OpenInNewIcon sx={{ fontSize: 12 }} />
                  </MuiLink>
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Parcel
                </Typography>
                <Typography variant="body2">
                  {shipment.weight_grams ? `${shipment.weight_grams} g` : '—'} · {shipment.shipping_mode}
                </Typography>
                {shipment.shipping_charge !== null && (
                  <Typography variant="caption" color="text.secondary">
                    Freight {formatMoney(shipment.shipping_charge)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Expected
                </Typography>
                <Typography variant="body2">{formatDate(shipment.estimated_delivery_at)}</Typography>
              </Box>
            </Stack>

            {shipment.ndr_reason && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Delivery failed {shipment.ndr_attempts} time{shipment.ndr_attempts === 1 ? '' : 's'} —{' '}
                {shipment.ndr_reason}
              </Alert>
            )}
            {shipment.rto_reason && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Returning to origin — {shipment.rto_reason}
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Contents
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              {shipment.items.map((item) => (
                <Stack key={item.id} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2">
                    {item.name}
                    {item.variant_title ? ` · ${item.variant_title}` : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ×{item.quantity}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Tracking</Typography>
              <Button
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                disabled={!shipment.awb_number || refresh.isPending}
                onClick={() => {
                  setError(null)
                  refresh.mutate(undefined, { onError: (caught) => setError(errorText(caught)) })
                }}
              >
                {refresh.isPending ? 'Checking…' : 'Refresh from carrier'}
              </Button>
            </Stack>

            {shipment.tracking.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing from the carrier yet.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {[...shipment.tracking].reverse().map((event) => (
                  <Stack key={event.id} direction="row" spacing={1.5}>
                    <Box
                      sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.disabled', mt: 0.8, flexShrink: 0 }}
                    />
                    <Box>
                      <Typography variant="body2">{event.description ?? event.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatRelative(event.at)}
                        {event.location ? ` · ${event.location}` : ''}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </DialogContent>

          <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
            {/* Driven by the server's transition table, not a fixed list. */}
            {shipment.next_statuses.map((next) => (
              <Button
                key={next}
                size="small"
                variant={next === 'delivered' ? 'contained' : 'outlined'}
                color={next === 'ndr' || next === 'rto_initiated' || next === 'lost' ? 'error' : 'primary'}
                disabled={changeStatus.isPending}
                onClick={() => act(next)}
              >
                {pending === next ? 'Working…' : SHIPMENT_ACTION_LABEL[next]}
              </Button>
            ))}
            {shipment.can_cancel && (
              <Button
                size="small"
                color="error"
                disabled={cancel.isPending}
                onClick={() => {
                  setError(null)
                  cancel.mutate(
                    { reason: 'Cancelled by staff' },
                    { onError: (caught) => setError(errorText(caught)) },
                  )
                }}
              >
                Cancel shipment
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button onClick={onClose}>Close</Button>
          </DialogActions>

          <Dialog open={reasonFor !== null} onClose={() => setReasonFor(null)} fullWidth maxWidth="xs">
            <DialogTitle>{reasonFor === 'ndr' ? 'Why did delivery fail?' : 'Why is it going back?'}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This goes on the shipment record and is what the next person reads before calling the customer.
              </Typography>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  reasonFor === 'ndr' ? 'Customer not reachable on two attempts' : 'Three failed attempts, no response'
                }
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReasonFor(null)}>Cancel</Button>
              <Button
                variant="contained"
                disabled={reason.trim().length < 3}
                onClick={() => {
                  const status = reasonFor!
                  setReasonFor(null)
                  changeStatus.mutate(
                    { status, reason: reason.trim() },
                    { onError: (caught) => setError(errorText(caught)), onSuccess: () => setReason('') },
                  )
                }}
              >
                Record it
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Dialog>
  )
}
