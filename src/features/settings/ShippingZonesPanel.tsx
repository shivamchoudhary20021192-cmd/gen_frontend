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
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/client'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { SectionCard } from '../../components/SectionCard'
import { countryOptions } from '../../lib/countries'
import { errorMessage } from '../../lib/errors'
import { countryName, formatMoney } from '../../lib/format'
import { useShop } from '../../shop/useShop'
import { describeArea, zonesKey, type ShippingZone } from './shippingZones'

interface QuoteOption {
  method: string
  name: string
  price: number
  basePrice: number
  freeAbove: number | null
  etaMinDays: number
  etaMaxDays: number
}

interface Quote {
  deliverable: boolean
  needsAddress: boolean
  reason: string | null
  zone: string | null
  options: QuoteOption[]
  codAvailable: boolean
}

/**
 * Shipping zones: named groups of places (countries, states, postcode
 * prefixes) that get their own rates — Shopify's shipping zones. Rates with
 * no zone apply everywhere in the home country that no zone covers.
 */
export function ShippingZonesPanel({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient()
  const { summary } = useShop()
  const home = summary?.shop.country_code ?? 'IN'
  const [editing, setEditing] = useState<ShippingZone | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ShippingZone | null>(null)
  const [error, setError] = useState<string | null>(null)

  const zones = useQuery({ queryKey: zonesKey, queryFn: () => api.get<{ zones: ShippingZone[] }>('/shipping/zones') })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: zonesKey })
    void queryClient.invalidateQueries({ queryKey: ['shipping-rates'] })
  }
  const toggle = useMutation({
    mutationFn: (zone: ShippingZone) => api.patch(`/shipping/zones/${zone.id}`, { is_active: !zone.is_active }),
    onSuccess: refresh,
    onError: (caught) => setError(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (zone: ShippingZone) => api.delete(`/shipping/zones/${zone.id}`),
    onSuccess: (_result, zone) => {
      setDeleting(null)
      onChanged(`${zone.name} deleted`)
      refresh()
    },
    onError: (caught) => {
      setDeleting(null)
      setError(errorMessage(caught))
    },
  })

  const list = zones.data?.zones ?? []

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <SectionCard
        title="Shipping zones"
        description={`Group places that share rates. Rates without a zone apply everywhere in ${countryName(home)} that no zone covers; to ship abroad, add a zone for those countries.`}
        actions={
          canManage && (
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              Create zone
            </Button>
          )
        }
        flush={list.length > 0}
      >
        {list.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No zones yet. Every order in {countryName(home)} uses your general rates.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Zone</TableCell>
                <TableCell>Places</TableCell>
                <TableCell align="right">Rates</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((zone) => (
                <TableRow key={zone.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{zone.name}</TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" noWrap title={zone.areas.map((area) => describeArea(area, home)).join(', ')}>
                      {zone.areas
                        .slice(0, 3)
                        .map((area) => describeArea(area, home))
                        .join(', ')}
                      {zone.areas.length > 3 ? ` +${zone.areas.length - 3}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {zone.rate_count === 0 ? <Chip size="small" color="warning" label="No rates" /> : zone.rate_count}
                  </TableCell>
                  <TableCell>
                    <Switch size="small" checked={zone.is_active} disabled={!canManage} onChange={() => toggle.mutate(zone)} />
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <>
                        <IconButton size="small" onClick={() => setEditing(zone)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleting(zone)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <QuotePreview home={home} />

      {editing && (
        <ZoneDialog
          zone={editing === 'new' ? null : editing}
          home={home}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null)
            onChanged(`${name} saved`)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body={deleting?.rate_count ? `Its ${deleting.rate_count} rate${deleting.rate_count === 1 ? '' : 's'} will be deleted too. Places in it fall back to your general rates.` : 'Places in it fall back to your general rates.'}
        confirmLabel="Delete zone"
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}

interface DraftArea {
  country: string
  region: string
  postal_prefix: string
}

function ZoneDialog({ zone, home, onClose, onSaved }: { zone: ShippingZone | null; home: string; onClose(): void; onSaved(name: string): void }) {
  const [name, setName] = useState(zone?.name ?? '')
  const [active, setActive] = useState(zone?.is_active ?? true)
  const [areas, setAreas] = useState<DraftArea[]>(
    zone?.areas.map((area) => ({ country: area.country ?? home, region: area.region ?? '', postal_prefix: area.postal_prefix ?? '' })) ?? [{ country: home, region: '', postal_prefix: '' }],
  )
  const [error, setError] = useState<string | null>(null)
  const options = countryOptions()

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        is_active: active,
        areas: areas.map((area) => ({ country: area.country, region: area.region.trim() || null, postal_prefix: area.postal_prefix.trim() || null })),
      }
      return zone ? api.patch(`/shipping/zones/${zone.id}`, body) : api.post('/shipping/zones', body)
    },
    onSuccess: () => onSaved(name),
    onError: (caught) => setError(errorMessage(caught)),
  })

  const update = (index: number, patch: Partial<DraftArea>) => setAreas(areas.map((area, i) => (i === index ? { ...area, ...patch } : area)))

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{zone ? `Edit ${zone.name}` : 'Create shipping zone'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Zone name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Metro cities, North America…" helperText="Customers do not see this." fullWidth autoFocus />
          <Box>
            <Typography variant="subtitle2">Places</Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
              A whole country (abroad), a state or province, or postcodes starting with a prefix. In {countryName(home)}, give a state, a prefix, or both.
            </Typography>
            <Stack spacing={1}>
              {areas.map((area, index) => (
                <Grid key={index} container spacing={1} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 12, sm: 5 }}>
                    <Autocomplete
                      options={options}
                      getOptionLabel={(option) => option.name}
                      value={options.find((option) => option.code === area.country) ?? options[0]}
                      onChange={(_event, value) => update(index, { country: value?.code ?? home })}
                      disableClearable
                      size="small"
                      renderInput={(params) => <TextField {...params} label="Country" />}
                    />
                  </Grid>
                  <Grid size={{ xs: 5, sm: 3 }}>
                    <TextField label="State / province" value={area.region} onChange={(event) => update(index, { region: event.target.value })} size="small" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 5, sm: 3 }}>
                    <TextField label="Postcode prefix" value={area.postal_prefix} onChange={(event) => update(index, { postal_prefix: event.target.value.toUpperCase() })} size="small" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 2, sm: 1 }}>
                    <IconButton size="small" disabled={areas.length === 1} onClick={() => setAreas(areas.filter((_, i) => i !== index))} aria-label="Remove place">
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Stack>
            <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => setAreas([...areas, { country: areas[areas.length - 1]?.country ?? home, region: '', postal_prefix: '' }])}>
              Add place
            </Button>
          </Box>
          <FormControlLabel control={<Switch checked={active} onChange={(event) => setActive(event.target.checked)} />} label="Zone is active" />
          {!zone && <Alert severity="info">After saving, add rates for this zone on the Shipping rates tab.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !name.trim() || areas.length === 0}>
          {save.isPending ? 'Saving…' : 'Save zone'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function QuotePreview({ home }: { home: string }) {
  const [input, setInput] = useState({ country: home, region: '', postal_code: '', subtotal: 1000, weight_grams: 500 })
  const options = countryOptions()
  const preview = useMutation({
    mutationFn: () =>
      api.post<{ quote: Quote }>('/shipping/quote-preview', {
        ...input,
        region: input.region.trim() || null,
        postal_code: input.postal_code.trim() || null,
      }),
  })
  const quote = preview.data?.quote

  return (
    <SectionCard title="Check what a customer sees" description="The delivery options offered at checkout for an address and a cart.">
      <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Autocomplete
            options={options}
            getOptionLabel={(option) => option.name}
            value={options.find((option) => option.code === input.country) ?? options[0]}
            onChange={(_event, value) => setInput({ ...input, country: value?.code ?? home })}
            disableClearable
            size="small"
            renderInput={(params) => <TextField {...params} label="Country" />}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField label="State" value={input.region} onChange={(event) => setInput({ ...input, region: event.target.value })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField label="Postcode" value={input.postal_code} onChange={(event) => setInput({ ...input, postal_code: event.target.value })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField label="Cart subtotal" type="number" value={input.subtotal} onChange={(event) => setInput({ ...input, subtotal: Number(event.target.value) })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField label="Weight (g)" type="number" value={input.weight_grams} onChange={(event) => setInput({ ...input, weight_grams: Number(event.target.value) })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 1 }}>
          <Button variant="outlined" onClick={() => preview.mutate()} disabled={preview.isPending} fullWidth>
            Check
          </Button>
        </Grid>
      </Grid>
      {preview.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage(preview.error)}
        </Alert>
      )}
      {quote && (
        <Box sx={{ mt: 2 }}>
          {!quote.deliverable || quote.options.length === 0 ? (
            <Alert severity="warning">{quote.reason ?? 'No delivery options for this address.'}</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {quote.zone ? `Zone: ${quote.zone}` : 'General rates'} · Cash on delivery {quote.codAvailable ? 'available' : 'not available'}
              </Typography>
              <Table size="small" sx={{ maxWidth: 560 }}>
                <TableBody>
                  {quote.options.map((option) => (
                    <TableRow key={option.method + option.name}>
                      <TableCell>{option.name}</TableCell>
                      <TableCell>
                        {option.etaMinDays}–{option.etaMaxDays} days
                      </TableCell>
                      <TableCell align="right">
                        {option.price === 0 ? (
                          <>
                            Free
                            {option.basePrice > 0 && (
                              <Typography component="span" variant="caption" sx={{ ml: 0.5, textDecoration: 'line-through' }}>
                                {formatMoney(option.basePrice)}
                              </Typography>
                            )}
                          </>
                        ) : (
                          formatMoney(option.price)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </Box>
      )}
    </SectionCard>
  )
}
