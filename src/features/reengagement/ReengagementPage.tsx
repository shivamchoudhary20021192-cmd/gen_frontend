import SendIcon from '@mui/icons-material/Send'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Pagination,
  Snackbar,
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
import { useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../../auth/useAuth'
import { formatMoney, formatRelative } from '../../lib/format'
import { tokens } from '../../theme'
import {
  useAudience,
  useSendNudge,
  type AudienceFilters,
  type AudienceRow,
  type Interest,
  type SendResult,
} from './useReengagement'

const PAGE_SIZE = 20

/** How far back to look. Empty means "all of it". */
const WINDOWS: { value: number | ''; label: string }[] = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: '', label: 'Any time' },
]

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

function InterestChip({ interest }: { interest: Interest }) {
  return interest === 'cart' ? (
    <Chip size="small" label="Left in cart" sx={{ bgcolor: '#FFF1E3', color: '#8A4B00', fontWeight: 600 }} />
  ) : (
    <Chip size="small" label="Saved" sx={{ bgcolor: '#EAF4FF', color: '#0B4F8A', fontWeight: 600 }} />
  )
}

/** One headline number with its label. */
function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption" sx={{ color: tokens.subdued, fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: tokens.inkStrong }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ color: tokens.subdued }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Wanted, not bought.
 *
 * Everyone who saved a product or left one in their cart and has not ordered
 * it. The point of the screen is the nudge, so the two facts that decide
 * whether a nudge is possible — how many people opted in, and whether a
 * WhatsApp provider is actually connected — are stated before the table rather
 * than discovered by pressing Send.
 */
export function ReengagementPage() {
  const { can } = useAuth()
  const [page, setPage] = useState(1)
  const [interest, setInterest] = useState<Interest | ''>('')
  const [contactableOnly, setContactableOnly] = useState(false)
  // Opens showing everything. An out-of-stock product that people keep saving
  // is the most useful thing on this screen — hiding it by default would turn
  // the strongest restock signal into an empty table.
  const [inStockOnly, setInStockOnly] = useState(false)
  const [withinDays, setWithinDays] = useState<number | ''>(30)

  const [confirming, setConfirming] = useState(false)
  const [sendLimit, setSendLimit] = useState(50)
  const [preview, setPreview] = useState<SendResult | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const filters: AudienceFilters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      interest,
      contactable: contactableOnly,
      in_stock: inStockOnly,
      within_days: withinDays,
    }),
    [page, interest, contactableOnly, inStockOnly, withinDays],
  )

  const { data, isLoading, isFetching, error } = useAudience(filters)
  const send = useSendNudge(filters)

  const rows = data?.audience ?? []
  const summary = data?.summary
  const pagination = data?.pagination
  const maySend = can('customers.manage')

  /** Resets to page one whenever a filter changes — page 3 of a new audience is nobody. */
  const onFilterChange = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const openConfirm = () => {
    setPreview(null)
    setResult(null)
    setConfirming(true)
    // Ask the server how many would be messaged rather than guessing from the
    // page on screen: the send is scoped by the filters, not by this page.
    send.mutate(
      { dryRun: true, limit: sendLimit },
      {
        onSuccess: (outcome) => setPreview(outcome),
        onError: (caught) => setToast(errorText(caught)),
      },
    )
  }

  const confirmSend = () => {
    send.mutate(
      { dryRun: false, limit: sendLimit },
      {
        onSuccess: (outcome) => {
          setResult(outcome)
          setToast(
            outcome.sent > 0
              ? `Messaged ${outcome.sent} ${outcome.sent === 1 ? 'person' : 'people'}.`
              : outcome.message,
          )
        },
        onError: (caught) => setToast(errorText(caught)),
      },
    )
  }

  return (
    <Box>
      <PageHeader
        title="Wanted, not bought"
        subtitle="People who saved a product or left it in their cart and never ordered it."
        actions={
          maySend ? (
            <Tooltip
              title={
                summary?.contactable === 0
                  ? 'Nobody in this audience has opted in to WhatsApp'
                  : 'Send a WhatsApp nudge to everyone in this audience who opted in'
              }
            >
              {/* A span keeps the tooltip alive while the button is disabled. */}
              <span>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={openConfirm}
                  disabled={!summary || summary.contactable === 0 || send.isPending}
                >
                  Send nudge
                </Button>
              </span>
            </Tooltip>
          ) : null
        }
      />

      {summary && !summary.can_send && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No WhatsApp provider is connected, so nothing will actually reach a phone yet. Messages are
          still recorded against each customer, which is what the counts below reflect.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorText(error)}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat label="People" value={summary?.people ?? '—'} hint="in this audience" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat
            label="Contactable"
            value={summary?.contactable ?? '—'}
            hint="opted in to WhatsApp"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat label="Saved" value={summary?.saved ?? '—'} hint="wishlisted, not bought" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat label="In cart" value={summary?.cart ?? '—'} hint="added, not checked out" />
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="Interest"
              value={interest}
              onChange={(e) => onFilterChange(() => setInterest(e.target.value as Interest | ''))}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Saved or in cart</MenuItem>
              <MenuItem value="saved">Saved only</MenuItem>
              <MenuItem value="cart">Left in cart only</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Interested"
              value={withinDays}
              onChange={(e) =>
                onFilterChange(() =>
                  setWithinDays(e.target.value === '' ? '' : Number(e.target.value)),
                )
              }
              sx={{ minWidth: 180 }}
            >
              {WINDOWS.map((window) => (
                <MenuItem key={String(window.value)} value={window.value}>
                  {window.label}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={
                <Checkbox
                  checked={contactableOnly}
                  onChange={(e) => onFilterChange(() => setContactableOnly(e.target.checked))}
                />
              }
              label="Only people who opted in"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={inStockOnly}
                  onChange={(e) => onFilterChange(() => setInStockOnly(e.target.checked))}
                />
              }
              label="Only products in stock"
            />
            {isFetching && <CircularProgress size={18} />}
          </Stack>
        </CardContent>
      </Card>

      <TableContainer component={Card} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Interest</TableCell>
              <TableCell>When</TableCell>
              <TableCell>Last nudged</TableCell>
              <TableCell align="right">Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: tokens.subdued }}>
                    Nobody matches these filters. Widen the date range or turn off "in stock only".
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((row: AudienceRow) => (
              <TableRow
                key={`${row.customer.id}-${row.product.id}-${row.interest}`}
                data-audience-row={`${row.customer.id}-${row.product.id}`}
                hover
              >
                <TableCell>
                  <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.customer.name || 'Customer'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      {row.customer.phone}
                    </Typography>
                    {row.customer.contactable ? (
                      <Chip
                        size="small"
                        icon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
                        label="Opted in"
                        sx={{ width: 'fit-content', bgcolor: '#E8F5E9', color: '#1B5E20', fontWeight: 600 }}
                      />
                    ) : (
                      <Tooltip title="They will be skipped by the nudge">
                        <Chip
                          size="small"
                          label={row.customer.reason ?? 'Not contactable'}
                          sx={{ width: 'fit-content', bgcolor: tokens.hover, color: tokens.subdued }}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Avatar
                      variant="rounded"
                      src={row.product.image ?? undefined}
                      alt=""
                      sx={{ width: 36, height: 36, bgcolor: tokens.hover }}
                    />
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{row.product.name}</Typography>
                      {!row.product.in_stock && (
                        <Typography variant="caption" sx={{ color: tokens.critical, fontWeight: 600 }}>
                          Out of stock
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </TableCell>

                <TableCell>
                  <InterestChip interest={row.interest} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: tokens.subdued }}>
                    {formatRelative(row.interested_at)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: tokens.subdued }}>
                    {row.last_contacted_at ? formatRelative(row.last_contacted_at) : 'Never'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {row.product.price === null ? '—' : formatMoney(row.product.price)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && pagination.pages > 1 && (
        <Stack sx={{ mt: 2, alignItems: 'center' }}>
          <Pagination
            count={pagination.pages}
            page={pagination.page}
            onChange={(_event, value) => setPage(value)}
          />
        </Stack>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send a WhatsApp nudge</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              One message per person, not per product — someone who saved four things hears from the
              shop once. Anyone who has not opted in is skipped.
            </Typography>

            <TextField
              type="number"
              size="small"
              label="Most people to message"
              value={sendLimit}
              onChange={(e) => setSendLimit(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              helperText="Between 1 and 200. Start small."
              slotProps={{ htmlInput: { min: 1, max: 200 } }}
            />

            {send.isPending && !result && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Working…</Typography>
              </Stack>
            )}

            {preview && !result && (
              <Alert severity="info">{preview.message}</Alert>
            )}

            {result && (
              <Alert severity={result.sent > 0 ? 'success' : 'warning'}>
                {result.sent > 0
                  ? `Messaged ${result.sent} of ${result.attempted}.`
                  : result.message}
                {result.skipped.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Skipped
                    </Typography>
                    {result.skipped.slice(0, 5).map((skip) => (
                      <Typography key={skip.customer} variant="caption" sx={{ display: 'block' }}>
                        {skip.customer} — {skip.reason}
                      </Typography>
                    ))}
                    {result.skipped.length > 5 && (
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        …and {result.skipped.length - 5} more
                      </Typography>
                    )}
                  </Box>
                )}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>{result ? 'Close' : 'Cancel'}</Button>
          {!result && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={confirmSend}
              disabled={send.isPending || !preview || preview.attempted === 0}
            >
              {preview ? `Send to ${preview.attempted}` : 'Send'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
      />
    </Box>
  )
}
