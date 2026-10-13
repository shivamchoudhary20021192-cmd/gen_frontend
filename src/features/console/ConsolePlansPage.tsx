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
  FormControlLabel,
  Grid,
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
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../../api/client'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { formatMoneyIn } from '../../lib/format'
import { FEATURE_LABELS, LIMIT_LABELS } from '../settings/billing/billingTypes'
import { consoleKeys, parseJson, type ConsoleOverview, type ConsolePlan } from './consoleTypes'
import { useOperator } from './useOperator'

const EXTRA_LIMIT_LABELS: Record<string, string> = {
  api_bucket_size: 'API burst (requests)',
  api_leak_rate: 'API rate (requests/second)',
}

function limitLabel(key: string): string {
  return LIMIT_LABELS[key] ?? EXTRA_LIMIT_LABELS[key] ?? key
}

interface PlansResponse {
  plans: ConsolePlan[]
  limit_keys: string[]
  feature_keys: string[]
}

/**
 * The plans merchants choose from. Pricing and packaging live here rather
 * than in code: a limit a plan leaves blank is unlimited, a feature it does
 * not switch on is off. A private plan is for custom deals — stores can be
 * moved onto it from their page, but it never appears at signup.
 */
export function ConsolePlansPage() {
  const queryClient = useQueryClient()
  const { canAct } = useOperator()
  const { flash, success, clear } = useFlash()
  const [editing, setEditing] = useState<ConsolePlan | 'new' | null>(null)
  const plans = useQuery({ queryKey: consoleKeys.plans, queryFn: () => platformApi.get<PlansResponse>('/plans') })
  const overview = useQuery({ queryKey: consoleKeys.overview, queryFn: () => platformApi.get<ConsoleOverview>('/overview') })
  const counts = overview.data?.shops_by_plan ?? {}

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="What stores pay the platform, and what each plan includes."
        actions={
          canAct && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              Create plan
            </Button>
          )
        }
      />
      <SectionCard title="All plans" flush>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Plan</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Trial</TableCell>
              <TableCell align="right">Fee</TableCell>
              <TableCell align="right">Stores</TableCell>
              <TableCell>Offered</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(plans.data?.plans ?? []).map((plan) => (
              <TableRow key={plan.id} hover sx={{ cursor: canAct ? 'pointer' : 'default', opacity: plan.is_active ? 1 : 0.55 }} onClick={() => canAct && setEditing(plan)}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {plan.name}
                  </Typography>
                  <Typography variant="caption">
                    {plan.handle}
                    {plan.tagline ? ` · ${plan.tagline}` : ''}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {Number(plan.price_amount) === 0 ? 'Free' : `${formatMoneyIn(Number(plan.price_amount), plan.currency)}/${plan.billing_interval === 'year' ? 'yr' : 'mo'}`}
                </TableCell>
                <TableCell align="right">{plan.trial_days ? `${plan.trial_days} days` : '—'}</TableCell>
                <TableCell align="right">{plan.transaction_fee_bps ? `${plan.transaction_fee_bps / 100}%` : '—'}</TableCell>
                <TableCell align="right">{counts[plan.handle] ?? 0}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {!plan.is_active ? <Chip size="small" label="Retired" /> : plan.is_public ? <Chip size="small" label="At signup" color="success" /> : <Chip size="small" label="Private" variant="outlined" />}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {editing && plans.data && (
        <PlanDialog
          plan={editing === 'new' ? null : editing}
          limitKeys={plans.data.limit_keys}
          featureKeys={plans.data.feature_keys}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            success(message)
            void queryClient.invalidateQueries({ queryKey: ['console'] })
          }}
        />
      )}
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

interface Draft {
  handle: string
  name: string
  tagline: string
  price_amount: string
  currency: string
  billing_interval: 'month' | 'year'
  trial_days: string
  fee_percent: string
  sort_order: string
  is_public: boolean
  is_active: boolean
  limits: Record<string, number | null>
  features: Record<string, boolean>
}

function draftOf(plan: ConsolePlan | null, limitKeys: string[], featureKeys: string[]): Draft {
  const limits = parseJson<Record<string, number | null>>(plan?.limits ?? null, {})
  const features = parseJson<Record<string, boolean>>(plan?.features ?? null, {})
  return {
    handle: plan?.handle ?? '',
    name: plan?.name ?? '',
    tagline: plan?.tagline ?? '',
    price_amount: plan ? String(Number(plan.price_amount)) : '0',
    currency: plan?.currency ?? 'INR',
    billing_interval: plan?.billing_interval ?? 'month',
    trial_days: String(plan?.trial_days ?? 14),
    fee_percent: String((plan?.transaction_fee_bps ?? 0) / 100),
    sort_order: String(plan?.sort_order ?? 100),
    is_public: plan ? plan.is_public === 1 : false,
    is_active: plan ? plan.is_active === 1 : true,
    limits: Object.fromEntries(limitKeys.map((key) => [key, limits[key] ?? null])),
    features: Object.fromEntries(featureKeys.map((key) => [key, features[key] === true])),
  }
}

function PlanDialog({
  plan,
  limitKeys,
  featureKeys,
  onClose,
  onSaved,
}: {
  plan: ConsolePlan | null
  limitKeys: string[]
  featureKeys: string[]
  onClose(): void
  onSaved(message: string): void
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(plan, limitKeys, featureKeys))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: draft.name.trim(),
        tagline: draft.tagline.trim() || null,
        price_amount: Number(draft.price_amount || 0),
        currency: draft.currency.toUpperCase(),
        billing_interval: draft.billing_interval,
        trial_days: Number(draft.trial_days || 0),
        transaction_fee_bps: Math.round(Number(draft.fee_percent || 0) * 100),
        sort_order: Number(draft.sort_order || 0),
        is_public: draft.is_public,
        limits: draft.limits,
        features: draft.features,
      }
      return plan
        ? platformApi.patch(`/plans/${plan.handle}`, { ...body, is_active: draft.is_active })
        : platformApi.post('/plans', { ...body, handle: draft.handle.trim().toLowerCase() })
    },
    onSuccess: () => onSaved(plan ? `${draft.name} saved` : `${draft.name} created`),
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      setError(errorMessage(caught))
    },
  })

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{plan ? `Edit ${plan.name}` : 'Create plan'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {plan && plan.is_active === 1 && (
            <Alert severity="info" variant="outlined">
              Price changes apply to stores on this plan from their next bill.
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Handle"
                value={draft.handle}
                onChange={(event) => set('handle', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                disabled={Boolean(plan)}
                error={Boolean(errors.handle)}
                helperText={errors.handle ?? (plan ? 'Fixed once created.' : 'Lowercase, used in the API.')}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Name" value={draft.name} onChange={(event) => set('name', event.target.value)} error={Boolean(errors.name)} helperText={errors.name} size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Sort order" type="number" value={draft.sort_order} onChange={(event) => set('sort_order', event.target.value)} helperText="Lower shows first." size="small" fullWidth />
            </Grid>
            <Grid size={12}>
              <TextField label="Tagline" value={draft.tagline} onChange={(event) => set('tagline', event.target.value)} helperText="One line under the name on the plan picker." size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField label="Price" type="number" value={draft.price_amount} onChange={(event) => set('price_amount', event.target.value)} size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField label="Currency" value={draft.currency} onChange={(event) => set('currency', event.target.value.toUpperCase().slice(0, 3))} size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField select label="Billed" value={draft.billing_interval} onChange={(event) => set('billing_interval', event.target.value as Draft['billing_interval'])} size="small" fullWidth>
                <MenuItem value="month">Monthly</MenuItem>
                <MenuItem value="year">Yearly</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                label="Trial"
                type="number"
                value={draft.trial_days}
                onChange={(event) => set('trial_days', event.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                label="Transaction fee"
                type="number"
                value={draft.fee_percent}
                onChange={(event) => set('fee_percent', event.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { step: 0.1, min: 0, max: 10 } }}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Limits
            </Typography>
            <Grid container spacing={1.5}>
              {limitKeys.map((key) => {
                const value = draft.limits[key]
                const unlimited = value === null || value === undefined
                return (
                  <Grid key={key} size={{ xs: 12, sm: 6 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <TextField
                        label={limitLabel(key)}
                        type="number"
                        value={unlimited ? '' : value}
                        onChange={(event) => set('limits', { ...draft.limits, [key]: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })}
                        disabled={unlimited}
                        placeholder="Unlimited"
                        size="small"
                        sx={{ flex: 1 }}
                      />
                      <FormControlLabel
                        control={<Checkbox size="small" checked={unlimited} onChange={(event) => set('limits', { ...draft.limits, [key]: event.target.checked ? null : 0 })} />}
                        label="Unlimited"
                        sx={{ mr: 0 }}
                      />
                    </Stack>
                  </Grid>
                )
              })}
            </Grid>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Features
            </Typography>
            <Grid container spacing={0.5}>
              {featureKeys.map((key) => (
                <Grid key={key} size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={<Switch size="small" checked={draft.features[key]} onChange={(event) => set('features', { ...draft.features, [key]: event.target.checked })} />}
                    label={FEATURE_LABELS[key] ?? key}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControlLabel control={<Switch checked={draft.is_public} onChange={(event) => set('is_public', event.target.checked)} />} label="Offer at signup and on the plan picker" />
            {plan && <FormControlLabel control={<Switch checked={draft.is_active} onChange={(event) => set('is_active', event.target.checked)} />} label="Active (stores can be on it)" />}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || draft.name.trim().length < 2 || (!plan && draft.handle.length < 2)}>
          {save.isPending ? 'Saving…' : plan ? 'Save plan' : 'Create plan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
