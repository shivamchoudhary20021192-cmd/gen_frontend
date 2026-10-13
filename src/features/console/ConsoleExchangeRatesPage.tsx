import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { platformApi } from '../../api/client'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { formatRelative } from '../../lib/format'
import { consoleKeys, type ExchangeRate } from './consoleTypes'
import { useOperator } from './useOperator'

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * The rates every market's prices are converted with, as units of each
 * currency per US dollar. The European Central Bank's are fetched daily; an
 * operator can pin a rate (a currency the ECB does not publish, or a
 * deliberate buffer), which then stays until it is handed back.
 */
export function ConsoleExchangeRatesPage() {
  const queryClient = useQueryClient()
  const { canAct } = useOperator()
  const { flash, success, error: flashError, clear } = useFlash()
  const [editing, setEditing] = useState<ExchangeRate | 'new' | null>(null)
  const [filter, setFilter] = useState('')
  const [base, setBase] = useState('INR')

  const rates = useQuery({ queryKey: consoleKeys.rates, queryFn: () => platformApi.get<{ base: string; rates: ExchangeRate[] }>('/exchange-rates') })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: consoleKeys.rates })

  const fetchEcb = useMutation({
    mutationFn: () => platformApi.post<{ updated: number }>('/exchange-rates/refresh'),
    onSuccess: (result) => {
      success(`${result.updated} rates updated from the ECB`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const unpin = useMutation({
    mutationFn: (rate: ExchangeRate) => platformApi.delete<{ refreshed: boolean }>(`/exchange-rates/${rate.currency}/manual`),
    onSuccess: (result, rate) => {
      success(result.refreshed ? `${rate.currency} follows the ECB again` : `${rate.currency} follows the ECB from the next refresh`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const list = useMemo(() => rates.data?.rates ?? [], [rates.data])
  // The dollar is the base every rate is quoted against, so it is always 1.
  const all = useMemo<ExchangeRate[]>(() => [{ currency: 'USD', per_usd: 1, source: 'base', updated_at: '' }, ...list.filter((rate) => rate.currency !== 'USD')], [list])
  const baseRate = all.find((rate) => rate.currency === base)?.per_usd ?? null
  const shown = all.filter((rate) => !filter || `${rate.currency} ${currencyName(rate.currency)}`.toLowerCase().includes(filter.toLowerCase()))
  const newest = list.reduce<string | null>((latest, rate) => (rate.source === 'ecb' && (!latest || rate.updated_at > latest) ? rate.updated_at : latest), null)

  return (
    <>
      <PageHeader
        title="Exchange rates"
        subtitle={newest ? `ECB rates last updated ${formatRelative(newest)}` : 'No ECB rates yet'}
        actions={
          canAct && (
            <>
              <Button variant="outlined" onClick={() => setEditing('new')}>
                Pin a rate
              </Button>
              <Button variant="contained" startIcon={<RefreshIcon />} disabled={fetchEcb.isPending} onClick={() => fetchEcb.mutate()}>
                {fetchEcb.isPending ? 'Fetching…' : 'Fetch from ECB'}
              </Button>
            </>
          )
        }
      />
      <SectionCard
        title="Rates"
        description="Units of each currency for one US dollar. Markets convert through these; a missing rate means a market in that currency cannot sell."
        actions={
          <Stack direction="row" spacing={1}>
            <TextField size="small" placeholder="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ width: 140 }} />
            <TextField
              size="small"
              value={base}
              onChange={(event) => setBase(event.target.value.toUpperCase().slice(0, 3))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">1</InputAdornment> }, htmlInput: { 'aria-label': 'Show rates against' } }}
              sx={{ width: 100 }}
            />
          </Stack>
        }
        flush
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Currency</TableCell>
              <TableCell align="right">Per US dollar</TableCell>
              <TableCell align="right">1 {base} =</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Updated</TableCell>
              {canAct && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((rate) => (
              <TableRow key={rate.currency} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {rate.currency}
                  </Typography>
                  <Typography variant="caption">{currencyName(rate.currency)}</Typography>
                </TableCell>
                <TableCell align="right">{rate.per_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}</TableCell>
                <TableCell align="right">{baseRate ? `${(rate.per_usd / baseRate).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${rate.currency}` : '—'}</TableCell>
                <TableCell>
                  {rate.source === 'manual' ? <Chip size="small" label="Pinned" color="warning" /> : rate.source === 'base' ? <Chip size="small" label="Base" /> : <Chip size="small" label="ECB" variant="outlined" />}
                </TableCell>
                <TableCell>{rate.updated_at ? formatRelative(rate.updated_at) : '—'}</TableCell>
                {canAct && (
                  <TableCell align="right">
                    {rate.source !== 'base' && (
                      <Button size="small" onClick={() => setEditing(rate)}>
                        Pin
                      </Button>
                    )}
                    {rate.source === 'manual' && (
                      <Button size="small" color="inherit" disabled={unpin.isPending} onClick={() => unpin.mutate(rate)}>
                        Use ECB
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {editing && (
        <PinDialog
          rate={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(currency) => {
            setEditing(null)
            success(`${currency} pinned`)
            refresh()
          }}
        />
      )}
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function PinDialog({ rate, onClose, onSaved }: { rate: ExchangeRate | null; onClose(): void; onSaved(currency: string): void }) {
  const [currency, setCurrency] = useState(rate?.currency ?? '')
  const [value, setValue] = useState(rate ? String(rate.per_usd) : '')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => platformApi.put(`/exchange-rates/${currency}`, { per_usd: Number(value) }),
    onSuccess: () => onSaved(currency),
    onError: (caught) => setError(errorMessage(caught)),
  })
  const valid = /^[A-Z]{3}$/.test(currency) && currency !== 'USD' && Number(value) > 0
  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{rate ? `Pin ${rate.currency}` : 'Pin a rate'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} disabled={Boolean(rate)} helperText={currency ? currencyName(currency) : 'ISO code, such as AED'} size="small" autoFocus={!rate} />
          <TextField
            label="Rate"
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">{currency || '…'} per USD</InputAdornment> }, htmlInput: { step: 'any', min: 0 } }}
            helperText="Kept until you hand it back to the ECB."
            size="small"
            autoFocus={Boolean(rate)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Pin rate
        </Button>
      </DialogActions>
    </Dialog>
  )
}
