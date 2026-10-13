import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { countryOptions } from '../../../lib/countries'
import { errorMessage, fieldErrors } from '../../../lib/errors'
import { countryName, formatMoneyIn, storeCurrency } from '../../../lib/format'

type Rounding = 'none' | 'whole' | 'ninety_nine'

interface Market {
  id: number
  name: string
  currency: string
  price_adjustment_percent: number
  rounding: Rounding
  is_primary: boolean
  is_active: boolean
  countries: string[]
  rate: number | null
}

interface CurrencyRate {
  currency: string
  rate: number | null
  source: string
  updated_at: string
}

interface Draft {
  name: string
  countries: string[]
  currency: string
  price_adjustment_percent: number
  rounding: Rounding
  is_active: boolean
}

const ROUNDING: { value: Rounding; label: string; hint: string }[] = [
  { value: 'none', label: 'No rounding', hint: 'Converted prices keep their exact value.' },
  { value: 'whole', label: 'Round up to a whole number', hint: '12.34 becomes 13.00' },
  { value: 'ninety_nine', label: 'End in .99', hint: '12.34 becomes 12.99' },
]

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD', 'UGX', 'XAF', 'XOF'])

/** The same arithmetic the storefront uses, for the preview line. */
function presentPrice(amount: number, rate: number, adjustment: number, rounding: Rounding, currency: string): number {
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2
  const factor = 10 ** digits
  const value = Math.round(amount * rate * (1 + adjustment / 100) * factor) / factor
  if (value <= 0 || rounding === 'none') return value
  if (rounding === 'whole' || digits === 0) return Math.ceil(value - 1e-9)
  return Math.floor(value + 1e-9) + 0.99
}

const marketKeys = { all: ['markets'] as const, currencies: ['markets', 'currencies'] as const }

/**
 * Settings → Markets: the countries the store sells to beyond its own, each
 * group with the currency its customers see and how converted prices round.
 */
export function MarketsPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('settings.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [editing, setEditing] = useState<Market | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Market | null>(null)

  const markets = useQuery({ queryKey: marketKeys.all, queryFn: () => api.get<{ markets: Market[] }>('/markets') })
  const currencies = useQuery({ queryKey: marketKeys.currencies, queryFn: () => api.get<{ store_currency: string; currencies: CurrencyRate[] }>('/markets/currencies') })

  const toggle = useMutation({
    mutationFn: (market: Market) => api.patch(`/markets/${market.id}`, { is_active: !market.is_active }),
    onSuccess: (_result, market) => {
      success(market.is_active ? `${market.name} is off` : `Selling to ${market.name}`)
      void queryClient.invalidateQueries({ queryKey: marketKeys.all })
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (market: Market) => api.delete(`/markets/${market.id}`),
    onSuccess: (_result, market) => {
      setDeleting(null)
      success(`${market.name} deleted`)
      void queryClient.invalidateQueries({ queryKey: marketKeys.all })
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const list = useMemo(() => markets.data?.markets ?? [], [markets.data])
  const usedCountries = useMemo(() => new Map(list.flatMap((market) => market.countries.map((code) => [code, market] as const))), [list])

  return (
    <>
      <PageHeader
        title="Markets"
        subtitle="Sell internationally in local currencies."
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              Add market
            </Button>
          )
        }
      />

      <SectionCard title="Your markets" description="Customers see prices in their market's currency. Orders, payouts and reports stay in your store currency." flush>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Market</TableCell>
              <TableCell>Countries</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell>Pricing</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((market) => (
              <TableRow key={market.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {market.name}
                    </Typography>
                    {market.is_primary && <Chip size="small" label="Primary" />}
                  </Stack>
                </TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  <Typography variant="body2" noWrap title={market.countries.map(countryName).join(', ')}>
                    {market.countries.length <= 3 ? market.countries.map(countryName).join(', ') : `${market.countries.slice(0, 3).map(countryName).join(', ')} +${market.countries.length - 3}`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{market.currency}</Typography>
                  {market.rate !== null && market.currency !== storeCurrency() && (
                    <Typography variant="caption">
                      1 {storeCurrency()} = {market.rate.toFixed(4)} {market.currency}
                    </Typography>
                  )}
                  {market.rate === null && <Typography variant="caption" color="error">No exchange rate</Typography>}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {market.price_adjustment_percent === 0 ? 'Converted' : `${market.price_adjustment_percent > 0 ? '+' : ''}${market.price_adjustment_percent}%`}
                  </Typography>
                  <Typography variant="caption">{ROUNDING.find((option) => option.value === market.rounding)?.label}</Typography>
                </TableCell>
                <TableCell>
                  <Switch size="small" checked={market.is_active} disabled={!canManage || market.is_primary || toggle.isPending} onChange={() => toggle.mutate(market)} />
                </TableCell>
                <TableCell align="right">
                  {canManage && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditing(market)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!market.is_primary && (
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setDeleting(market)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <Alert severity="info" variant="outlined">
        Orders shipped to a country outside your own are treated as exports: no domestic tax is charged. Exchange rates update daily.
      </Alert>

      {editing && (
        <MarketDialog
          market={editing === 'new' ? null : editing}
          currencies={currencies.data?.currencies ?? []}
          usedCountries={usedCountries}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null)
            success(`${name} saved`)
            void queryClient.invalidateQueries({ queryKey: marketKeys.all })
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="Customers in these countries will no longer be able to check out. Past orders are kept."
        confirmLabel="Delete market"
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />

      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function MarketDialog({
  market,
  currencies,
  usedCountries,
  onClose,
  onSaved,
}: {
  market: Market | null
  currencies: CurrencyRate[]
  usedCountries: Map<string, Market>
  onClose(): void
  onSaved(name: string): void
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    market
      ? { name: market.name, countries: market.countries, currency: market.currency, price_adjustment_percent: market.price_adjustment_percent, rounding: market.rounding, is_active: market.is_active }
      : { name: '', countries: [], currency: storeCurrency(), price_adjustment_percent: 0, rounding: 'none', is_active: true },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => countryOptions().filter((option) => {
    const owner = usedCountries.get(option.code)
    return !owner || owner.id === market?.id
  }), [usedCountries, market])

  const save = useMutation({
    mutationFn: () => (market ? api.patch(`/markets/${market.id}`, draft) : api.post('/markets', draft)),
    onSuccess: () => onSaved(draft.name),
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      setError(errorMessage(caught))
    },
  })

  const rate = currencies.find((entry) => entry.currency === draft.currency)?.rate ?? (draft.currency === storeCurrency() ? 1 : null)
  const sample = 1000
  const previewed = rate !== null ? presentPrice(sample, rate, draft.price_adjustment_percent, draft.rounding, draft.currency) : null

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{market ? `Edit ${market.name}` : 'Add market'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Market name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Europe" error={Boolean(errors.name)} helperText={errors.name} fullWidth autoFocus />
          <Autocomplete
            multiple
            options={options}
            getOptionLabel={(option) => option.name}
            value={options.filter((option) => draft.countries.includes(option.code))}
            onChange={(_event, value) => setDraft({ ...draft, countries: value.map((option) => option.code) })}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => {
                const { key, ...itemProps } = getItemProps({ index })
                return <Chip key={key} size="small" label={option.name} {...itemProps} disabled={market?.is_primary && option.code === market.countries[0]} />
              })
            }
            renderInput={(params) => <TextField {...params} label="Countries" error={Boolean(errors.countries)} helperText={errors.countries ?? 'A country can be in one market only.'} />}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Currency"
                value={draft.currency}
                onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
                disabled={market?.is_primary}
                error={Boolean(errors.currency)}
                helperText={errors.currency ?? (market?.is_primary ? 'The primary market uses the store currency.' : ' ')}
                fullWidth
              >
                {Array.from(new Set([draft.currency, storeCurrency(), ...currencies.map((entry) => entry.currency)])).map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Price adjustment"
                type="number"
                value={draft.price_adjustment_percent}
                onChange={(event) => setDraft({ ...draft, price_adjustment_percent: Number(event.target.value) })}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { min: -50, max: 200, step: 1 } }}
                error={Boolean(errors.price_adjustment_percent)}
                helperText={errors.price_adjustment_percent ?? 'Raise or lower every price here, for duties or local pricing.'}
                fullWidth
              />
            </Grid>
          </Grid>
          <TextField select label="Price rounding" value={draft.rounding} onChange={(event) => setDraft({ ...draft, rounding: event.target.value as Rounding })} helperText={ROUNDING.find((option) => option.value === draft.rounding)?.hint} fullWidth>
            {ROUNDING.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {!market?.is_primary && (
            <FormControlLabel control={<Switch checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />} label="Sell to this market" />
          )}
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
            <Typography variant="body2">
              {previewed === null
                ? `There is no exchange rate for ${draft.currency} yet.`
                : `A ${formatMoneyIn(sample, storeCurrency())} product shows as ${formatMoneyIn(previewed, draft.currency)}.`}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !draft.name.trim() || draft.countries.length === 0}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
