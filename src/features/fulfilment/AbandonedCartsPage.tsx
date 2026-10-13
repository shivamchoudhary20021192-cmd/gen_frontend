import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SearchIcon from '@mui/icons-material/Search'
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
  Grid,
  InputAdornment,
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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { formatMoney, formatRelative } from '../../lib/format'
import {
  useAbandonedCart,
  useAbandonedCarts,
  useDismissCart,
  useMarkContacted,
  useRecoveryLink,
  useSweepCarts,
} from './useFulfilment'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function AbandonedCartsPage() {
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'newest'
  const reachable = params.get('reachable') === 'true'
  const page = Number(params.get('page') ?? 1)
  const [searchInput, setSearchInput] = useState(search)

  const sweep = useSweepCarts()
  const swept = useRef(false)

  /**
   * Sweeps once when the screen opens.
   *
   * There is no scheduler yet, so nothing else moves a stale cart into this
   * queue. The ref stops React 19's StrictMode double-effect from sweeping
   * twice, which would be harmless but would double the audit entries.
   */
  useEffect(() => {
    if (swept.current) return
    swept.current = true
    sweep.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    () => ({ page, limit: 25, q: search || undefined, sort, reachable: reachable || undefined }),
    [page, search, sort, reachable],
  )

  const list = useAbandonedCarts(query)
  const rows = list.data?.carts ?? []
  const pagination = list.data?.pagination
  const stats = list.data?.stats

  return (
    <Box>
      <PageHeader
        title="Abandoned carts"
        subtitle={pagination ? `${pagination.total} waiting` : undefined}
        actions={
          <Button size="small" variant="outlined" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
            {sweep.isPending ? 'Checking…' : 'Check for new'}
          </Button>
        }
      />

      {stats && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Carts waiting
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.25 }}>
                  {stats.abandoned_carts}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Value at risk
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.25 }}>
                  {formatMoney(stats.value_at_risk)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Recovered in 30 days
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.25 }}>
                  {stats.recovered_last_30_days}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Recovery links are copied and sent by hand for now — over WhatsApp or email. Nothing is sent
        automatically, so nobody gets chased without someone deciding to.
      </Alert>

      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search phone, email or PIN code"
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
            label="Contactable"
            value={reachable ? 'yes' : ''}
            onChange={(event) => update({ reachable: event.target.value === 'yes' ? 'true' : undefined })}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Everyone</MenuItem>
            <MenuItem value="yes">Has a phone or email</MenuItem>
          </TextField>
          <TextField
            select
            label="Sort"
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="newest">Most recent</MenuItem>
            <MenuItem value="value">Highest value</MenuItem>
            <MenuItem value="oldest">Oldest first</MenuItem>
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
            Could not load abandoned carts.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              Nothing abandoned right now.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              A cart lands here after four hours untouched, and leaves the moment it becomes an order.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Abandoned</TableCell>
                  <TableCell>Contacted</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((cart) => (
                  <TableRow key={cart.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(cart.id)}>
                    <TableCell>
                      <Typography variant="body2">{cart.customer.name ?? 'Guest'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cart.customer.phone ?? cart.customer.email ?? 'No contact details'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{cart.item_count}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatMoney(cart.value)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatRelative(cart.abandoned_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      {cart.last_contacted_at ? (
                        <Chip size="small" label={formatRelative(cart.last_contacted_at)} />
                      ) : cart.customer.reachable ? (
                        <Chip size="small" color="warning" label="Not yet" />
                      ) : (
                        <Tooltip title="No phone or email on this cart — there is nobody to reach">
                          <Chip size="small" label="Unreachable" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={(event) => { event.stopPropagation(); setOpenId(cart.id) }}>
                        Open
                      </Button>
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

      <CartDialog id={openId} onClose={() => setOpenId(null)} onToast={setToast} />

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

function CartDialog({
  id,
  onClose,
  onToast,
}: {
  id: number | null
  onClose: () => void
  onToast: (message: string) => void
}) {
  const query = useAbandonedCart(id ?? undefined)
  const cart = query.data?.cart
  const link = useRecoveryLink(id ?? 0)
  const contacted = useMarkContacted(id ?? 0)
  const dismiss = useDismissCart(id ?? 0)

  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRecoveryUrl(cart?.recovery_url ?? null)
  }, [cart?.recovery_url])

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      onToast('Recovery link copied')
    } catch {
      // Clipboard access is denied in plenty of contexts; the link is on screen
      // and selectable, so this is a nudge rather than a failure.
      onToast('Could not copy — select the link and copy it manually')
    }
  }

  return (
    <Dialog open={id !== null} onClose={onClose} fullWidth maxWidth="sm">
      {query.isLoading || !cart ? (
        <DialogContent>
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        </DialogContent>
      ) : (
        <>
          <DialogTitle>{cart.customer.name ?? 'Guest cart'}</DialogTitle>
          <DialogContent dividers>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Value
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatMoney(cart.value)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Abandoned
                </Typography>
                <Typography variant="body2">{formatRelative(cart.abandoned_at)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Contact
                </Typography>
                <Typography variant="body2">
                  {cart.customer.phone ?? cart.customer.email ?? 'None on file'}
                </Typography>
              </Box>
            </Stack>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              In the bag
            </Typography>
            <Stack spacing={1}>
              {cart.items.map((item) => (
                <Stack key={item.id} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2">
                      {item.name}
                      {item.variant_title ? ` · ${item.variant_title}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ×{item.quantity}
                    </Typography>
                    {/* Worth knowing before ringing someone. */}
                    {!item.in_stock && (
                      <Chip size="small" color="error" label="Out of stock" sx={{ ml: 1, height: 17, fontSize: 10 }} />
                    )}
                  </Box>
                  <Typography variant="body2">{formatMoney(item.line_total)}</Typography>
                </Stack>
              ))}
            </Stack>

            {recoveryUrl && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Recovery link
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    value={recoveryUrl}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                    onFocus={(event) => event.target.select()}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
                    onClick={() => void copy(recoveryUrl)}
                  >
                    Copy
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Opening this restores the bag on the storefront. Treat it like a private link.
                </Typography>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
            {!recoveryUrl && (
              <Button
                variant="contained"
                size="small"
                disabled={link.isPending}
                onClick={() => {
                  setError(null)
                  link.mutate(undefined, {
                    onSuccess: (data) => {
                      setRecoveryUrl(data.recovery_url)
                      void copy(data.recovery_url)
                    },
                    onError: (caught) => setError(errorText(caught)),
                  })
                }}
              >
                {link.isPending ? 'Creating…' : 'Create recovery link'}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              disabled={contacted.isPending}
              onClick={() => contacted.mutate(undefined, { onError: (caught) => setError(errorText(caught)) })}
            >
              Mark as contacted
            </Button>
            <Button
              size="small"
              color="inherit"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate(undefined, { onSuccess: onClose })}
            >
              Dismiss
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
