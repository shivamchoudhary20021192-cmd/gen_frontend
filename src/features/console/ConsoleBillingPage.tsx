import {
  Alert,
  Button,
  Chip,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { platformApi } from '../../api/client'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatMoneyIn } from '../../lib/format'
import { consoleKeys, type ConsoleInvoice } from './consoleTypes'
import { useOperator } from './useOperator'

const STATUS_COLOR: Record<ConsoleInvoice['status'], 'success' | 'warning' | 'error' | 'default'> = { paid: 'success', open: 'warning', failed: 'error', void: 'default' }

/**
 * What the platform bills its stores. Bills are raised and charged by the
 * billing job; this is where an operator settles a bank transfer by hand,
 * voids a bill raised in error, or runs the cycle now — in development "as
 * of" a later date, to walk a trial or a grace period through in seconds.
 */
export function ConsoleBillingPage() {
  const queryClient = useQueryClient()
  const { canAct } = useOperator()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const shopId = params.get('shop_id') ?? ''
  const { flash, success, error: flashError, info, clear } = useFlash()
  const [confirm, setConfirm] = useState<{ invoice: ConsoleInvoice; action: 'mark-paid' | 'void' } | null>(null)
  const [clock, setClock] = useState('')
  const [clockShop, setClockShop] = useState('')

  const query = { status: status || undefined, shop_id: shopId || undefined, limit: 100 }
  const invoices = useQuery({ queryKey: consoleKeys.invoices(query), queryFn: () => platformApi.get<{ invoices: ConsoleInvoice[] }>('/billing/invoices', query) })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['console'] })

  const act = useMutation({
    mutationFn: ({ invoice, action }: { invoice: ConsoleInvoice; action: 'mark-paid' | 'void' }) => platformApi.post(`/billing/invoices/${invoice.id}/${action}`),
    onSuccess: (_result, { invoice, action }) => {
      setConfirm(null)
      success(action === 'void' ? `${invoice.number} voided` : `${invoice.number} marked paid`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const run = useMutation({
    mutationFn: () =>
      platformApi.post<{ now: string; billed: number; retried: number; frozen: number; reminded: number }>('/billing/run', {
        ...(clock ? { now: new Date(clock).toISOString() } : {}),
        ...(clockShop.trim() ? { shop: clockShop.trim() } : {}),
      }),
    onSuccess: (result) => {
      info(`Billing run as of ${formatDate(result.now)}: ${result.billed} billed, ${result.retried} retried, ${result.frozen} frozen, ${result.reminded} trial reminders.`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const list = invoices.data?.invoices ?? []

  return (
    <>
      <PageHeader title="Platform billing" subtitle="Subscription and transaction-fee bills to stores." />

      {canAct && (
        <SectionCard title="Run the billing cycle" description="Bills ended periods, retries failed charges, freezes stores past their grace period and sends trial reminders. It also runs by itself every hour.">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
            <TextField
              type="datetime-local"
              label="As of (test clock)"
              value={clock}
              onChange={(event) => setClock(event.target.value)}
              helperText="Blank: now. Development only."
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label="Only this store" value={clockShop} onChange={(event) => setClockShop(event.target.value)} placeholder="store address, e.g. veylor" helperText={clock ? 'Required with a test clock.' : 'Blank: every store.'} size="small" />
            <Button variant="outlined" disabled={run.isPending || (Boolean(clock) && !clockShop.trim())} onClick={() => run.mutate()}>
              {run.isPending ? 'Running…' : 'Run now'}
            </Button>
          </Stack>
        </SectionCard>
      )}

      <SectionCard
        title="Bills"
        actions={
          <Stack direction="row" spacing={1}>
            {shopId && <Chip size="small" label={`Store #${shopId}`} onDelete={() => setFilter('shop_id', '')} />}
            <TextField select size="small" value={status} onChange={(event) => setFilter('status', event.target.value)} sx={{ minWidth: 140 }} slotProps={{ select: { displayEmpty: true } }}>
              <MenuItem value="">Any status</MenuItem>
              <MenuItem value="open">Due</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="void">Void</MenuItem>
            </TextField>
          </Stack>
        }
        flush
      >
        {list.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No bills match.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bill</TableCell>
                <TableCell>Store</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total</TableCell>
                {canAct && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Typography variant="body2">{invoice.number}</Typography>
                    <Typography variant="caption">{invoice.kind.replace('_', ' ')}</Typography>
                  </TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/console/stores/${invoice.shop.id}`}>
                      {invoice.shop.name}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(invoice.issued_at)}</TableCell>
                  <TableCell>
                    <Tooltip title={invoice.last_error ?? ''}>
                      <Chip size="small" label={invoice.status === 'open' ? 'Due' : invoice.status} color={STATUS_COLOR[invoice.status]} />
                    </Tooltip>
                    {invoice.attempts > 0 && invoice.status !== 'paid' && (
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        {invoice.attempts} attempt{invoice.attempts === 1 ? '' : 's'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{formatMoneyIn(invoice.total, invoice.currency)}</TableCell>
                  {canAct && (
                    <TableCell align="right">
                      {(invoice.status === 'open' || invoice.status === 'failed') && (
                        <>
                          <Button size="small" onClick={() => setConfirm({ invoice, action: 'mark-paid' })}>
                            Mark paid
                          </Button>
                          <Button size="small" color="error" onClick={() => setConfirm({ invoice, action: 'void' })}>
                            Void
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <Alert severity="info" variant="outlined">
        Marking a bill paid is for money received outside the platform, such as a bank transfer. A store frozen for that bill reopens once nothing else is overdue.
      </Alert>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'void' ? `Void ${confirm.invoice.number}?` : `Mark ${confirm?.invoice.number ?? ''} paid?`}
        body={
          confirm?.action === 'void'
            ? 'The store will not be asked to pay it and no further attempts are made. This cannot be undone.'
            : `Record ${confirm ? formatMoneyIn(confirm.invoice.total, confirm.invoice.currency) : ''} from ${confirm?.invoice.shop.name ?? ''} as received.`
        }
        confirmLabel={confirm?.action === 'void' ? 'Void bill' : 'Mark paid'}
        destructive={confirm?.action === 'void'}
        busy={act.isPending}
        onConfirm={() => confirm && act.mutate(confirm)}
        onClose={() => setConfirm(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
