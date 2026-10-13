import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import HistoryIcon from '@mui/icons-material/History'
import type { InventoryLocation, StockItem } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import {
  LOCATION_TYPE_OPTIONS,
  MOVEMENT_TYPE_FILTERS,
  STOCK_STATE_FILTERS,
  STOCK_STATE_META,
  movementLabel,
  movementReference,
  signedQuantity,
} from './inventoryMeta'
import {
  errorMessage,
  useAdjustStock,
  useBulkAdjust,
  useCreateLocation,
  useLocations,
  useMovements,
  useSetStock,
  useStockLevels,
  useUpdateLocation,
  useVariantStock,
} from './useInventory'

const ROWS_PER_PAGE = [25, 50, 100]

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── summary cards ────────────────────────────────────────────────────────────

interface CardProps {
  label: string
  value: number | string
  tone?: 'default' | 'warning' | 'error'
  hint?: string
}

function SummaryCard({ label, value, tone = 'default', hint }: CardProps) {
  const colour = tone === 'warning' ? 'warning.main' : tone === 'error' ? 'error.main' : 'text.primary'
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 600, mt: 0.5, color: colour }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  )
}

// ── adjust / set dialog ──────────────────────────────────────────────────────

interface AdjustDialogProps {
  item: StockItem | null
  mode: 'adjust' | 'set'
  onClose: () => void
}

function AdjustDialog({ item, mode, onClose }: AdjustDialogProps) {
  const [quantity, setQuantity] = useState('0')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  const adjust = useAdjustStock()
  const set = useSetStock()
  const pending = adjust.isPending || set.isPending

  // Reset when a different row opens the dialog.
  const signature = `${item?.inventory_item_id ?? 'none'}:${mode}`
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    setQuantity(mode === 'set' ? String(item?.quantity_on_hand ?? 0) : '0')
    setReason(mode === 'set' ? 'Stock count' : '')
    setError(null)
    setKey((value) => value + 1)
  }

  if (!item) return null

  const parsed = Number(quantity)
  const projected = mode === 'adjust' ? item.quantity_on_hand + parsed : parsed

  const submit = () => {
    setError(null)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError('Enter a whole number of units.')
      return
    }
    if (!reason.trim()) {
      setError('Give a reason — it is written to the stock ledger.')
      return
    }
    if (mode === 'adjust' && parsed === 0) {
      setError('Enter how many units to add or remove.')
      return
    }
    if (projected < 0) {
      setError(`That would take stock to ${projected}. Stock cannot go below zero.`)
      return
    }

    const onError = (caught: unknown) => setError(errorMessage(caught, 'The stock change was refused.'))
    if (mode === 'adjust') {
      adjust.mutate(
        {
          variantId: item.variant_id,
          location_id: item.location_id,
          quantity_delta: parsed,
          reason: reason.trim(),
        },
        { onSuccess: onClose, onError },
      )
    } else {
      set.mutate(
        {
          variantId: item.variant_id,
          location_id: item.location_id,
          quantity: parsed,
          reason: reason.trim(),
        },
        { onSuccess: onClose, onError },
      )
    }
  }

  return (
    <Dialog open onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth key={key}>
      <DialogTitle>{mode === 'adjust' ? 'Adjust stock' : 'Set stock level'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.product_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.sku}
              {item.variant_title ? ` · ${item.variant_title}` : ''} · {item.location_name}
            </Typography>
          </Box>

          <Stack direction="row" spacing={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                On hand
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.quantity_on_hand}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Reserved
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.quantity_reserved}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Available
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.quantity_available}
              </Typography>
            </Box>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label={mode === 'adjust' ? 'Units to add or remove' : 'New on-hand quantity'}
            placeholder={mode === 'adjust' ? 'e.g. 24 to add, -3 to remove' : 'e.g. 120'}
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            fullWidth
            size="small"
            helperText={
              mode === 'adjust'
                ? `On hand would become ${Number.isFinite(parsed) ? projected : '—'}`
                : `Recorded as a stock take, ${
                    Number.isFinite(parsed) ? signedQuantity(parsed - item.quantity_on_hand) : '—'
                  } against the ledger`
            }
          />

          <TextField
            label="Reason"
            placeholder="e.g. Shipment received, Damaged in transit, Annual count"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
            size="small"
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={pending}>
          {mode === 'adjust' ? 'Adjust stock' : 'Set stock'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── bulk adjust dialog ───────────────────────────────────────────────────────

interface BulkDialogProps {
  items: StockItem[]
  onClose: () => void
  onDone: () => void
}

function BulkAdjustDialog({ items, onClose, onDone }: BulkDialogProps) {
  const [delta, setDelta] = useState('0')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bulk = useBulkAdjust()

  const parsed = Number(delta)
  // The batch is all-or-nothing on the server, so the row that would go negative
  // is worth naming before the request rather than after it is refused.
  const wouldGoNegative = Number.isFinite(parsed)
    ? items.filter((item) => item.quantity_on_hand + parsed < 0)
    : []

  const submit = () => {
    setError(null)
    if (!Number.isInteger(parsed) || parsed === 0) {
      setError('Enter how many units to add or remove from every selected variant.')
      return
    }
    if (!reason.trim()) {
      setError('Give a reason — it is written against every line.')
      return
    }
    if (wouldGoNegative.length > 0) {
      setError(
        `${wouldGoNegative.length} of the selected variants would go below zero (${wouldGoNegative
          .slice(0, 3)
          .map((item) => item.sku)
          .join(', ')}${wouldGoNegative.length > 3 ? '…' : ''}).`,
      )
      return
    }

    bulk.mutate(
      {
        items: items.map((item) => ({
          variant_id: item.variant_id,
          location_id: item.location_id,
          quantity_delta: parsed,
        })),
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onDone()
          onClose()
        },
        onError: (caught) => setError(errorMessage(caught, 'The batch was refused — nothing was changed.')),
      },
    )
  }

  return (
    <Dialog open onClose={bulk.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adjust {items.length} variants</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            The same change is applied to every selected variant. If any one line would
            take stock below zero the whole batch is refused and nothing moves.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Units to add or remove, per variant"
            placeholder="e.g. 12 to add, -2 to remove"
            type="number"
            value={delta}
            onChange={(event) => setDelta(event.target.value)}
            fullWidth
            size="small"
          />

          <TextField
            label="Reason"
            placeholder="e.g. Quarterly count correction"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
            size="small"
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={bulk.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={bulk.isPending}>
          Apply to {items.length}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── variant history drawer ───────────────────────────────────────────────────

function VariantHistoryDialog({ variantId, onClose }: { variantId: number; onClose: () => void }) {
  const { data, isLoading } = useVariantStock(variantId)

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Stock history</DialogTitle>
      <DialogContent>
        {isLoading && <LinearProgress />}
        {data && (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {data.item.product_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data.item.sku} · {data.item.quantity_on_hand} on hand ·{' '}
                {data.item.quantity_available} available
              </Typography>
            </Box>
            <Divider />
            {data.recent_movements.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing has moved this variant yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>What</TableCell>
                    <TableCell align="right">Change</TableCell>
                    <TableCell align="right">After</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recent_movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption">{formatDateTime(movement.created_at)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{movementLabel(movement.movement_type)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {movementReference(movement.reference_type, movement.reference_id) ??
                            movement.reason ??
                            '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600 }}
                          color={movement.quantity_delta < 0 ? 'error.main' : 'success.main'}
                        >
                          {signedQuantity(movement.quantity_delta)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{movement.quantity_after}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── location dialog ──────────────────────────────────────────────────────────

interface LocationDialogProps {
  location: InventoryLocation | null
  onClose: () => void
}

function LocationDialog({ location, onClose }: LocationDialogProps) {
  const editing = location !== null
  const [form, setForm] = useState({
    code: location?.code ?? '',
    name: location?.name ?? '',
    location_type: location?.location_type ?? 'warehouse',
    line1: location?.address.line1 ?? '',
    city: location?.address.city ?? '',
    state: location?.address.state ?? '',
    state_code: location?.address.state_code ?? '',
    pincode: location?.address.pincode ?? '',
    gstin: location?.gstin ?? '',
    contact_name: location?.contact_name ?? '',
    contact_phone: location?.contact_phone ?? '',
    is_active: location?.is_active ?? true,
    fulfils_online_orders: location?.fulfils_online_orders ?? true,
    is_default: location?.is_default ?? false,
  })
  const [error, setError] = useState<string | null>(null)

  const create = useCreateLocation()
  const update = useUpdateLocation()
  const pending = create.isPending || update.isPending

  const field = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) =>
      setForm((previous) => ({ ...previous, [key]: event.target.value })),
  })

  const submit = () => {
    setError(null)
    if (!form.name.trim()) {
      setError('Give the location a name.')
      return
    }
    if (!editing && !form.code.trim()) {
      setError('Give the location a short code, for example MAIN or BLR-01.')
      return
    }

    // Empty strings are absent values, not values — sending "" for a nullable
    // column would store a blank rather than leaving the field unset.
    const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim())
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      location_type: form.location_type,
      line1: blankToNull(form.line1),
      city: blankToNull(form.city),
      state: blankToNull(form.state),
      state_code: blankToNull(form.state_code),
      pincode: blankToNull(form.pincode),
      gstin: blankToNull(form.gstin),
      contact_name: blankToNull(form.contact_name),
      contact_phone: blankToNull(form.contact_phone),
      is_active: form.is_active,
      fulfils_online_orders: form.fulfils_online_orders,
      is_default: form.is_default,
    }

    const onError = (caught: unknown) => setError(errorMessage(caught, 'The location could not be saved.'))
    if (editing) {
      update.mutate({ id: location.id, location: payload }, { onSuccess: onClose, onError })
    } else {
      create.mutate({ ...payload, code: form.code.trim().toUpperCase() }, { onSuccess: onClose, onError })
    }
  }

  return (
    <Dialog open onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? `Edit ${location.name}` : 'New location'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Code"
              placeholder="e.g. BLR-01"
              {...field('code')}
              disabled={editing}
              size="small"
              fullWidth
              helperText={editing ? 'The code is fixed once the location exists.' : 'Short and unique.'}
            />
            <TextField
              label="Name"
              placeholder="e.g. Bengaluru warehouse"
              {...field('name')}
              size="small"
              fullWidth
              required
            />
          </Stack>

          <Select
            value={form.location_type}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                location_type: event.target.value as typeof previous.location_type,
              }))
            }
            size="small"
            fullWidth
          >
            {LOCATION_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>

          <TextField
            label="Address"
            placeholder="e.g. Plot 44, Baddi Industrial Area"
            {...field('line1')}
            size="small"
            fullWidth
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="City" placeholder="e.g. Solan" {...field('city')} size="small" fullWidth />
            <TextField
              label="State"
              placeholder="e.g. Himachal Pradesh"
              {...field('state')}
              size="small"
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="State code"
              placeholder="e.g. 02"
              {...field('state_code')}
              size="small"
              fullWidth
              helperText="Two digits — decides CGST/SGST versus IGST on invoices."
            />
            <TextField
              label="PIN code"
              placeholder="e.g. 173205"
              {...field('pincode')}
              size="small"
              fullWidth
            />
          </Stack>

          <TextField
            label="GSTIN"
            placeholder="e.g. 02AABCV1234F1Z5"
            {...field('gstin')}
            size="small"
            fullWidth
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Contact name"
              placeholder="e.g. Warehouse manager"
              {...field('contact_name')}
              size="small"
              fullWidth
            />
            <TextField
              label="Contact phone"
              placeholder="e.g. 18002004455"
              {...field('contact_phone')}
              size="small"
              fullWidth
            />
          </Stack>

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={(event) => setForm((p) => ({ ...p, is_active: event.target.checked }))}
              />
            }
            label="Active"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.fulfils_online_orders}
                onChange={(event) =>
                  setForm((p) => ({ ...p, fulfils_online_orders: event.target.checked }))
                }
              />
            }
            label="Fulfils online orders"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_default}
                disabled={editing && location.is_default}
                onChange={(event) => setForm((p) => ({ ...p, is_default: event.target.checked }))}
              />
            }
            label="Default location"
          />
          <Typography variant="caption" color="text.secondary">
            Stock changes that do not name a location land on the default. Exactly one
            location is the default, so promoting this one demotes the current default.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={pending}>
          {editing ? 'Save location' : 'Create location'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── stock tab ────────────────────────────────────────────────────────────────

function StockTab() {
  const [search, setSearch] = useState('')
  const [stockStatus, setStockStatus] = useState('all')
  const [locationId, setLocationId] = useState('all')
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(25)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adjusting, setAdjusting] = useState<{ item: StockItem; mode: 'adjust' | 'set' } | null>(null)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const debouncedSearch = useDebounce(search, 300)
  const { data: locationsData } = useLocations()
  const locations = locationsData?.locations ?? []

  const params = useMemo(
    () => ({
      page: page + 1,
      limit,
      q: debouncedSearch || undefined,
      stock_status: stockStatus === 'all' ? undefined : stockStatus,
      location_id: locationId === 'all' ? undefined : Number(locationId),
    }),
    [page, limit, debouncedSearch, stockStatus, locationId],
  )

  const { data, isLoading, isFetching, error } = useStockLevels(params)
  const items = data?.items ?? []
  const summary = data?.summary
  const total = data?.pagination.total ?? 0

  // Selection is by inventory row, and a row that scrolls off the current page
  // stays selected — the bulk dialog works from the rows still on screen, so it
  // never adjusts something the merchant cannot see.
  const selectedItems = items.filter((item) => selected.has(item.inventory_item_id))
  const allOnPageSelected = items.length > 0 && selectedItems.length === items.length

  const toggleAll = () => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (allOnPageSelected) items.forEach((item) => next.delete(item.inventory_item_id))
      else items.forEach((item) => next.add(item.inventory_item_id))
      return next
    })
  }

  const toggleOne = (id: number) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetPage = () => setPage(0)

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <SummaryCard label="SKUs" value={summary?.total_skus ?? '—'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <SummaryCard label="Units on hand" value={summary?.total_on_hand ?? '—'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <SummaryCard
            label="Units available"
            value={summary?.total_available ?? '—'}
            hint="On hand, less what is reserved"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <SummaryCard label="Low stock" value={summary?.low_stock_count ?? '—'} tone="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <SummaryCard label="Out of stock" value={summary?.out_of_stock_count ?? '—'} tone="error" />
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary">
        These totals describe the rows below, filters included.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
        <TextField
          placeholder="Search by product, SKU, variant or barcode"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            resetPage()
          }}
          size="small"
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

        <Select
          value={stockStatus}
          onChange={(event) => {
            setStockStatus(event.target.value)
            resetPage()
          }}
          size="small"
          sx={{ minWidth: 180 }}
        >
          {STOCK_STATE_FILTERS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>

        <Select
          value={locationId}
          onChange={(event) => {
            setLocationId(event.target.value)
            resetPage()
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All locations</MenuItem>
          {locations.map((location) => (
            <MenuItem key={location.id} value={String(location.id)}>
              {location.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {selectedItems.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="body2">
              {selectedItems.length} selected on this page
            </Typography>
            <Button size="small" variant="contained" onClick={() => setBulkOpen(true)}>
              Adjust together
            </Button>
            <Button size="small" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

      {error && <Alert severity="error">{errorMessage(error, 'Stock levels could not be loaded.')}</Alert>}

      <Paper variant="outlined">
        {isFetching && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={selectedItems.length > 0 && !allOnPageSelected}
                    onChange={toggleAll}
                    slotProps={{ input: { 'aria-label': 'Select all rows on this page' } }}
                  />
                </TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">On hand</TableCell>
                <TableCell align="right">Reserved</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    Loading stock levels…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" color="text.secondary">
                      No stock matches these filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const meta = STOCK_STATE_META[item.stock_state]
                  return (
                    <TableRow key={item.inventory_item_id} hover selected={selected.has(item.inventory_item_id)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.has(item.inventory_item_id)}
                          onChange={() => toggleOne(item.inventory_item_id)}
                          slotProps={{ input: { 'aria-label': `Select ${item.sku}` } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.product_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.sku}
                          {item.variant_title ? ` · ${item.variant_title}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.location_code}</Typography>
                        {item.bin_location && (
                          <Typography variant="caption" color="text.secondary">
                            Bin {item.bin_location}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{item.quantity_on_hand}</TableCell>
                      <TableCell align="right">
                        {item.quantity_reserved > 0 ? item.quantity_reserved : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.quantity_available}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={meta.help}>
                          <Chip
                            label={meta.label}
                            color={meta.colour}
                            size="small"
                            variant={item.stock_state === 'in_stock' ? 'outlined' : 'filled'}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" onClick={() => setAdjusting({ item, mode: 'adjust' })}>
                            Adjust
                          </Button>
                          <Button size="small" onClick={() => setAdjusting({ item, mode: 'set' })}>
                            Set
                          </Button>
                          <Tooltip title="Stock history">
                            <Button
                              size="small"
                              onClick={() => setHistoryFor(item.variant_id)}
                              aria-label={`Stock history for ${item.sku}`}
                            >
                              <HistoryIcon fontSize="small" />
                            </Button>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_event, next) => setPage(next)}
          rowsPerPage={limit}
          rowsPerPageOptions={ROWS_PER_PAGE}
          onRowsPerPageChange={(event) => {
            setLimit(Number(event.target.value))
            resetPage()
          }}
        />
      </Paper>

      {adjusting && (
        <AdjustDialog
          item={adjusting.item}
          mode={adjusting.mode}
          onClose={() => setAdjusting(null)}
        />
      )}
      {historyFor !== null && (
        <VariantHistoryDialog variantId={historyFor} onClose={() => setHistoryFor(null)} />
      )}
      {bulkOpen && (
        <BulkAdjustDialog
          items={selectedItems}
          onClose={() => setBulkOpen(false)}
          onDone={() => setSelected(new Set())}
        />
      )}
    </Stack>
  )
}

// ── movements tab ────────────────────────────────────────────────────────────

function MovementsTab() {
  const [movementType, setMovementType] = useState('all')
  const [locationId, setLocationId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(25)

  const { data: locationsData } = useLocations()

  const params = useMemo(
    () => ({
      page: page + 1,
      limit,
      movement_type: movementType === 'all' ? undefined : movementType,
      location_id: locationId === 'all' ? undefined : Number(locationId),
      from: from || undefined,
      to: to || undefined,
    }),
    [page, limit, movementType, locationId, from, to],
  )

  const { data, isLoading, isFetching, error } = useMovements(params)
  const movements = data?.movements ?? []

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Every change to stock, and what caused it — sales, returns, manual adjustments
        and counts.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
        <Select
          value={movementType}
          onChange={(event) => {
            setMovementType(event.target.value)
            setPage(0)
          }}
          size="small"
          sx={{ minWidth: 220 }}
        >
          {MOVEMENT_TYPE_FILTERS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>

        <Select
          value={locationId}
          onChange={(event) => {
            setLocationId(event.target.value)
            setPage(0)
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All locations</MenuItem>
          {(locationsData?.locations ?? []).map((location) => (
            <MenuItem key={location.id} value={String(location.id)}>
              {location.name}
            </MenuItem>
          ))}
        </Select>

        <TextField
          label="From"
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value)
            setPage(0)
          }}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value)
            setPage(0)
          }}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      {error && <Alert severity="error">{errorMessage(error, 'The ledger could not be loaded.')}</Alert>}

      <Paper variant="outlined">
        {isFetching && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Movement</TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell align="right">On hand after</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    Loading movements…
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" color="text.secondary">
                      No stock movements match these filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((movement) => (
                  <TableRow key={movement.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="caption">{formatDateTime(movement.created_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{movement.product_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {movement.sku}
                        {movement.variant_title ? ` · ${movement.variant_title}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{movementLabel(movement.movement_type)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {movementReference(movement.reference_type, movement.reference_id) ??
                          movement.reason ??
                          '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                        color={movement.quantity_delta < 0 ? 'error.main' : 'success.main'}
                      >
                        {signedQuantity(movement.quantity_delta)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{movement.quantity_after}</TableCell>
                    <TableCell>{movement.location_code}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{movement.admin_name ?? 'System'}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.pagination.total ?? 0}
          page={page}
          onPageChange={(_event, next) => setPage(next)}
          rowsPerPage={limit}
          rowsPerPageOptions={ROWS_PER_PAGE}
          onRowsPerPageChange={(event) => {
            setLimit(Number(event.target.value))
            setPage(0)
          }}
        />
      </Paper>
    </Stack>
  )
}

// ── locations tab ────────────────────────────────────────────────────────────

function LocationsTab() {
  const { data, isLoading, error } = useLocations()
  const [editing, setEditing] = useState<InventoryLocation | null>(null)
  const [creating, setCreating] = useState(false)

  const locations = data?.locations ?? []

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          Where stock is held. The default location receives any stock change that does
          not name one.
        </Typography>
        <Button variant="contained" size="small" onClick={() => setCreating(true)}>
          New location
        </Button>
      </Stack>

      {error && <Alert severity="error">{errorMessage(error, 'Locations could not be loaded.')}</Alert>}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Address</TableCell>
                <TableCell align="right">SKUs</TableCell>
                <TableCell align="right">Units</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    Loading locations…
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((location) => (
                  <TableRow key={location.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {location.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {location.code}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {location.location_type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {[location.address.city, location.address.state, location.address.pincode]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{location.item_count}</TableCell>
                    <TableCell align="right">{location.total_on_hand}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {location.is_default && <Chip label="Default" size="small" color="primary" />}
                        {!location.is_active && <Chip label="Inactive" size="small" />}
                        {location.fulfils_online_orders && (
                          <Chip label="Ships online orders" size="small" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setEditing(location)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {creating && <LocationDialog location={null} onClose={() => setCreating(false)} />}
      {editing && <LocationDialog location={editing} onClose={() => setEditing(null)} />}
    </Stack>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export function InventoryPage() {
  const [tab, setTab] = useState<'stock' | 'movements' | 'locations'>('stock')

  return (
    <Box>
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, the movement ledger behind them, and the locations they sit in"
      />

      <Tabs
        value={tab}
        onChange={(_event, next) => setTab(next as typeof tab)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Stock levels" value="stock" />
        <Tab label="Movements" value="movements" />
        <Tab label="Locations" value="locations" />
      </Tabs>

      {tab === 'stock' && <StockTab />}
      {tab === 'movements' && <MovementsTab />}
      {tab === 'locations' && <LocationsTab />}
    </Box>
  )
}
