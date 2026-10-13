import {
  Alert,
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
  Link,
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
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage, fieldErrors } from '../../../lib/errors'
import { countryName, formatDate, formatMoney, taxLineLabel } from '../../../lib/format'
import { useShop } from '../../../shop/useShop'

interface TaxClass {
  id: number
  code: string
  name: string
  rate: number
  inclusive: boolean
  exempt: boolean
  hsn_code: string | null
  is_default: boolean
  is_active: boolean
  product_count: number
}

interface Registration {
  id: number
  country_code: string
  region_code: string | null
  name: string
  registration_number: string | null
  rate: number
  shipping_taxable: boolean
  is_active: boolean
}

interface TaxOverview {
  engine: string
  rate_source: 'class' | 'destination'
  /** Class-rate regimes: whether delivery is taxed like the goods. */
  shipping_taxable: boolean
  tax_service: { provider: string; name: string; reported: { sales: number; refunds: number; last_reported_at: string | null } } | null
  classes: TaxClass[]
  registrations: Registration[]
  collecting: boolean
}

interface Preview {
  source: string
  tax: number
  shipping_tax: number
  tax_lines: { name: string; rate: number; amount: number }[]
  total: number
}

const ENGINE_LABELS: Record<string, string> = {
  in_gst: 'India GST',
  us_sales_tax: 'US sales tax',
  ca_gst: 'Canadian GST/HST/PST',
  au_gst: 'Australian GST',
  sg_gst: 'Singapore GST',
  uk_vat: 'UK VAT',
  eu_vat: 'EU VAT',
  ae_vat: 'UAE VAT',
  manual: 'Rates you set',
}

const taxKey = ['tax', 'overview'] as const

/**
 * Settings → Taxes and duties. A store taxed by product (GST, VAT) sets rates
 * on tax classes; a store taxed by where it delivers (US sales tax, Canada)
 * lists where it is registered to collect, or connects a tax service.
 */
export function TaxesPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const { summary } = useShop()
  const canManage = can('settings.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [editingClass, setEditingClass] = useState<TaxClass | 'new' | null>(null)
  const [editingRegistration, setEditingRegistration] = useState<Registration | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Registration | null>(null)

  const overview = useQuery({ queryKey: taxKey, queryFn: () => api.get<TaxOverview>('/tax') })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: taxKey })

  const toggleClass = useMutation({
    mutationFn: (entry: TaxClass) => api.patch(`/tax/classes/${entry.id}`, { is_active: !entry.is_active }),
    onSuccess: refresh,
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const toggleRegistration = useMutation({
    mutationFn: (entry: Registration) => api.patch(`/tax/registrations/${entry.id}`, { is_active: !entry.is_active }),
    onSuccess: refresh,
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const shippingTax = useMutation({
    mutationFn: (taxable: boolean) => api.put('/tax/settings', { shipping_taxable: taxable }),
    onSuccess: (_result, taxable) => {
      success(taxable ? 'Delivery is now taxed like the goods' : 'Delivery is no longer taxed')
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const removeRegistration = useMutation({
    mutationFn: (entry: Registration) => api.delete(`/tax/registrations/${entry.id}`),
    onSuccess: () => {
      setDeleting(null)
      success('Registration removed')
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const data = overview.data
  const country = summary?.shop.country_code ?? ''
  const destination = data?.rate_source === 'destination'

  return (
    <>
      <PageHeader title="Taxes and duties" subtitle={summary ? `Selling from ${countryName(country)}` : undefined} />

      {data && !data.collecting && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are not collecting tax anywhere yet. Add the states or provinces where you are registered, or connect a tax service.
        </Alert>
      )}

      <SectionCard
        title="How tax is worked out"
        actions={
          <Button component={RouterLink} to="/settings/integrations" size="small">
            Tax services
          </Button>
        }
      >
        <Stack spacing={1}>
          <Typography variant="body2">
            <strong>{ENGINE_LABELS[data?.engine ?? ''] ?? data?.engine}</strong> ·{' '}
            {destination ? 'rates depend on where the order is delivered' : 'rates come from each product’s tax class'}
          </Typography>
          {data?.tax_service ? (
            <Typography variant="body2" color="text.secondary">
              Calculated by {data.tax_service.name}. Reported for filing: {formatMoney(data.tax_service.reported.sales)} in sales,{' '}
              {formatMoney(Math.abs(data.tax_service.reported.refunds))} in refunds
              {data.tax_service.reported.last_reported_at ? `, last on ${formatDate(data.tax_service.reported.last_reported_at)}` : ''}.
            </Typography>
          ) : (
            destination && (
              <Typography variant="body2" color="text.secondary">
                Using your registrations below. <Link component={RouterLink} to="/settings/integrations">Connect a tax service</Link> for rooftop-accurate rates and filing reports.
              </Typography>
            )
          )}
          <Typography variant="body2" color="text.secondary">
            Orders delivered outside {countryName(country)} are exports and are not charged {countryName(country)} tax.
          </Typography>
        </Stack>
      </SectionCard>

      {data && !destination && (
        <SectionCard title="Delivery" description="Whether the delivery charge on an order is taxed.">
          <FormControlLabel
            control={<Switch checked={data.shipping_taxable} disabled={!canManage || shippingTax.isPending} onChange={(event) => shippingTax.mutate(event.target.checked)} />}
            label={
              <Stack>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Charge tax on delivery
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The delivery charge is shared across the items in proportion to their value and taxed at each item’s rate, as GST treats a composite supply.
                </Typography>
              </Stack>
            }
          />
        </SectionCard>
      )}

      {(destination || (data?.registrations.length ?? 0) > 0) && (
        <SectionCard
          title="Where you collect"
          description="Each state or province you are registered in, at its combined rate. Leave the region blank for a country-wide tax."
          actions={
            canManage && (
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setEditingRegistration('new')}>
                Add registration
              </Button>
            )
          }
          flush
        >
          {(data?.registrations.length ?? 0) === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
              No registrations yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>Tax</TableCell>
                  <TableCell>Registration no.</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell>Shipping</TableCell>
                  <TableCell>Collecting</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {data!.registrations.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell>{entry.region_code ?? `All of ${countryName(entry.country_code)}`}</TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell>{entry.registration_number ?? '—'}</TableCell>
                    <TableCell align="right">{entry.rate}%</TableCell>
                    <TableCell>{entry.shipping_taxable ? 'Taxed' : 'Not taxed'}</TableCell>
                    <TableCell>
                      <Switch size="small" checked={entry.is_active} disabled={!canManage} onChange={() => toggleRegistration.mutate(entry)} />
                    </TableCell>
                    <TableCell align="right">
                      {canManage && (
                        <>
                          <IconButton size="small" onClick={() => setEditingRegistration(entry)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => setDeleting(entry)}>
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
      )}

      <SectionCard
        title="Tax classes"
        description={destination ? 'Mark exempt goods (groceries, clothing in some states) with an exempt class.' : 'Each product carries one class; its rate is charged at checkout.'}
        actions={
          canManage && (
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setEditingClass('new')}>
              Add class
            </Button>
          )
        }
        flush
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell>Prices</TableCell>
              <TableCell>HSN / code</TableCell>
              <TableCell align="right">Products</TableCell>
              <TableCell>Active</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.classes ?? []).map((entry) => (
              <TableRow key={entry.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {entry.name}
                    </Typography>
                    {entry.is_default && <Chip size="small" label="Default" />}
                    {entry.exempt && <Chip size="small" label="Exempt" variant="outlined" />}
                  </Stack>
                  <Typography variant="caption">{entry.code}</Typography>
                </TableCell>
                <TableCell align="right">{entry.exempt ? '—' : `${entry.rate}%`}</TableCell>
                <TableCell>{entry.inclusive ? 'Include tax' : 'Tax added'}</TableCell>
                <TableCell>{entry.hsn_code ?? '—'}</TableCell>
                <TableCell align="right">{entry.product_count}</TableCell>
                <TableCell>
                  <Switch size="small" checked={entry.is_active} disabled={!canManage || entry.is_default} onChange={() => toggleClass.mutate(entry)} />
                </TableCell>
                <TableCell align="right">
                  {canManage && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditingClass(entry)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <RateCheck destination={destination} classes={data?.classes ?? []} />

      {editingClass && (
        <ClassDialog
          entry={editingClass === 'new' ? null : editingClass}
          onClose={() => setEditingClass(null)}
          onSaved={() => {
            setEditingClass(null)
            success('Tax class saved')
            refresh()
          }}
        />
      )}
      {editingRegistration && (
        <RegistrationDialog
          entry={editingRegistration === 'new' ? null : editingRegistration}
          country={country}
          onClose={() => setEditingRegistration(null)}
          onSaved={() => {
            setEditingRegistration(null)
            success('Registration saved')
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this registration?"
        body={`Orders delivered to ${deleting?.region_code ?? 'this country'} will stop being charged ${deleting?.name ?? 'this tax'}.`}
        confirmLabel="Remove"
        destructive
        busy={removeRegistration.isPending}
        onConfirm={() => deleting && removeRegistration.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function ClassDialog({ entry, onClose, onSaved }: { entry: TaxClass | null; onClose(): void; onSaved(): void }) {
  const [draft, setDraft] = useState({
    code: entry?.code ?? '',
    name: entry?.name ?? '',
    rate: entry?.rate ?? 0,
    inclusive: entry?.inclusive ?? true,
    exempt: entry?.exempt ?? false,
    hsn_code: entry?.hsn_code ?? '',
    is_default: entry?.is_default ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, hsn_code: draft.hsn_code.trim() || null }
      return entry ? api.patch(`/tax/classes/${entry.id}`, body) : api.post('/tax/classes', body)
    },
    onSuccess: onSaved,
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      setError(errorMessage(caught))
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{entry ? `Edit ${entry.name}` : 'Add tax class'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField label="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Standard rate" error={Boolean(errors.name)} helperText={errors.name} fullWidth autoFocus />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Code"
                  value={draft.code}
                  onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                  placeholder="STANDARD"
                  error={Boolean(errors.code)}
                  helperText={errors.code ?? 'Used by imports and the API.'}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Rate"
                  type="number"
                  value={draft.rate}
                  onChange={(event) => setDraft({ ...draft, rate: Number(event.target.value) })}
                  disabled={draft.exempt}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { min: 0, max: 100, step: 0.01 } }}
                  error={Boolean(errors.rate)}
                  helperText={errors.rate}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField label="HSN / tax code" value={draft.hsn_code} onChange={(event) => setDraft({ ...draft, hsn_code: event.target.value })} helperText="Optional. Printed on invoices." fullWidth />
              </Grid>
            </Grid>
            <FormControlLabel control={<Switch checked={draft.inclusive} onChange={(event) => setDraft({ ...draft, inclusive: event.target.checked })} />} label="Prices include this tax" />
            <FormControlLabel control={<Switch checked={draft.exempt} onChange={(event) => setDraft({ ...draft, exempt: event.target.checked })} />} label="Exempt from tax" />
            <FormControlLabel
              control={<Switch checked={draft.is_default} disabled={entry?.is_default} onChange={(event) => setDraft({ ...draft, is_default: event.target.checked })} />}
              label="Default for new products"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={save.isPending || !draft.name.trim() || draft.code.length < 2}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function RegistrationDialog({ entry, country, onClose, onSaved }: { entry: Registration | null; country: string; onClose(): void; onSaved(): void }) {
  const [draft, setDraft] = useState({
    region_code: entry?.region_code ?? '',
    name: entry?.name ?? '',
    registration_number: entry?.registration_number ?? '',
    rate: entry?.rate ?? 0,
    shipping_taxable: entry?.shipping_taxable ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, region_code: draft.region_code.trim() || null, registration_number: draft.registration_number.trim() || null }
      return entry ? api.patch(`/tax/registrations/${entry.id}`, body) : api.post('/tax/registrations', { ...body, country_code: country })
    },
    onSuccess: onSaved,
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      setError(errorMessage(caught))
    },
  })
  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{entry ? 'Edit registration' : 'Add registration'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="State / province"
                value={draft.region_code}
                onChange={(event) => setDraft({ ...draft, region_code: event.target.value.toUpperCase() })}
                placeholder={country === 'CA' ? 'ON' : country === 'US' ? 'CA' : ''}
                error={Boolean(errors.region_code)}
                helperText={errors.region_code ?? 'Code, or blank for the whole country.'}
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField label="Tax name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={country === 'CA' ? 'HST' : 'Sales tax'} error={Boolean(errors.name)} helperText={errors.name ?? 'Shown to customers at checkout.'} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Rate"
                type="number"
                value={draft.rate}
                onChange={(event) => setDraft({ ...draft, rate: Number(event.target.value) })}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { min: 0, max: 100, step: 0.001 } }}
                error={Boolean(errors.rate)}
                helperText={errors.rate}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField label="Registration number" value={draft.registration_number} onChange={(event) => setDraft({ ...draft, registration_number: event.target.value })} helperText="Optional. Printed on invoices." fullWidth />
            </Grid>
          </Grid>
          <FormControlLabel control={<Switch checked={draft.shipping_taxable} onChange={(event) => setDraft({ ...draft, shipping_taxable: event.target.checked })} />} label="Charge this tax on delivery too" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || draft.name.trim().length < 2}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RateCheck({ destination, classes }: { destination: boolean; classes: TaxClass[] }) {
  const defaultClass = classes.find((entry) => entry.is_default)?.id ?? ''
  const [input, setInput] = useState({ region: '', postal_code: '', amount: 1000, shipping: 0, exempt: false, tax_class_id: '' as number | '' })
  const classId = input.tax_class_id || defaultClass
  const check = useMutation({
    mutationFn: () =>
      api.post<Preview>('/tax/preview', {
        region: input.region.trim() || null,
        postal_code: input.postal_code.trim() || null,
        amount: input.amount,
        shipping: input.shipping,
        exempt: destination ? input.exempt : false,
        tax_class_id: destination ? null : classId || null,
      }),
  })
  return (
    <SectionCard title="Check a rate" description="What a customer pays for an order, before anyone places one.">
      <Grid container spacing={2} sx={{ alignItems: 'center' }}>
        {!destination && classes.length > 0 && (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField select label="Tax class" value={classId} onChange={(event) => setInput({ ...input, tax_class_id: Number(event.target.value) })} size="small" fullWidth>
              {classes
                .filter((entry) => entry.is_active)
                .map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
            </TextField>
          </Grid>
        )}
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField
            label={destination ? 'Region' : 'Deliver to state'}
            value={input.region}
            onChange={(event) => setInput({ ...input, region: event.target.value.toUpperCase() })}
            placeholder={destination ? 'CA' : 'MH'}
            size="small"
            fullWidth
          />
        </Grid>
        {destination && (
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField label="Postal code" value={input.postal_code} onChange={(event) => setInput({ ...input, postal_code: event.target.value })} size="small" fullWidth />
          </Grid>
        )}
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField label="Order amount" type="number" value={input.amount} onChange={(event) => setInput({ ...input, amount: Number(event.target.value) })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField label="Delivery" type="number" value={input.shipping} onChange={(event) => setInput({ ...input, shipping: Number(event.target.value) })} size="small" fullWidth />
        </Grid>
        {destination && (
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControlLabel control={<Switch size="small" checked={input.exempt} onChange={(event) => setInput({ ...input, exempt: event.target.checked })} />} label="Exempt goods" />
          </Grid>
        )}
        <Grid size={{ xs: 6, md: 1 }}>
          <Button variant="outlined" onClick={() => check.mutate()} disabled={check.isPending}>
            Check
          </Button>
        </Grid>
      </Grid>
      {check.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage(check.error)}
        </Alert>
      )}
      {check.data && (
        <Table size="small" sx={{ mt: 2, maxWidth: 480 }}>
          <TableBody>
            {check.data.tax_lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={2}>No tax is charged here.</TableCell>
              </TableRow>
            )}
            {check.data.tax_lines.map((line) => (
              <TableRow key={line.name}>
                <TableCell>
                  {taxLineLabel(line)}
                </TableCell>
                <TableCell align="right">{formatMoney(line.amount)}</TableCell>
              </TableRow>
            ))}
            {check.data.shipping_tax > 0 && (
              <TableRow>
                <TableCell>of which on delivery</TableCell>
                <TableCell align="right">{formatMoney(check.data.shipping_tax)}</TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Customer pays</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatMoney(check.data.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
      {check.data && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          {check.data.source === 'classes' ? 'Worked out from the tax class.' : check.data.source === 'pending' ? 'Enter a region or postal code to work it out.' : `Worked out by ${check.data.source}.`}
        </Typography>
      )}
    </SectionCard>
  )
}
