import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api, platformApi } from '../../../api/client'
import type { AdminUser } from '../../../api/types'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage, fieldErrors } from '../../../lib/errors'
import { countryName, formatDate } from '../../../lib/format'
import { shopKeys } from '../../../shop/shopContext'
import type { Shop, ShopSummary } from '../../../shop/types'
import { useShop } from '../../../shop/useShop'
import { BrandCard } from './BrandCard'

const LOCALES = ['en', 'en-IN', 'en-US', 'en-GB', 'en-AU', 'en-CA', 'fr', 'fr-CA', 'de', 'es', 'it', 'nl', 'pt-BR', 'hi', 'ja']
const WEIGHT_UNITS = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'oz', label: 'Ounces (oz)' },
]

function supported(kind: 'timeZone' | 'currency'): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf(kind)
  } catch {
    return []
  }
}

type Draft = Pick<Shop, 'name' | 'email' | 'phone' | 'timezone' | 'locale' | 'weight_unit' | 'currency' | 'country_code'>

function draftOf(shop: Shop): Draft {
  return {
    name: shop.name,
    email: shop.email ?? '',
    phone: shop.phone ?? '',
    timezone: shop.timezone,
    locale: shop.locale,
    weight_unit: shop.weight_unit,
    currency: shop.currency,
    country_code: shop.country_code,
  }
}

/**
 * Settings → Store details: who the store is, the defaults every order and
 * report is measured in, who can see the storefront, and the owner-only
 * actions (pause, hand over, close).
 */
export function StoreDetailsPage() {
  const { summary, loading } = useShop()
  if (loading || !summary) return <PageHeader title="Store details" />
  // Keyed so the form restarts from the saved store after every save.
  return <StoreDetailsForm key={summary.shop.id + summary.shop.name + summary.shop.currency} summary={summary} />
}

function StoreDetailsForm({ summary }: { summary: ShopSummary }) {
  const shop = summary.shop
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const { memberships, switchTo } = useShop()
  const { flash, success, error: flashError, clear } = useFlash()
  const [draft, setDraft] = useState<Draft>(() => draftOf(shop))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const canManage = can('shop.manage')
  const isOwner = memberships.find((membership) => membership.handle === shop.handle)?.is_owner ?? false

  const options = useQuery({
    queryKey: ['signup-options'],
    queryFn: () => platformApi.anonymousGet<{ countries: string[] }>('/signup/options'),
    staleTime: Infinity,
  })
  const timezones = useMemo(() => supported('timeZone'), [])
  const currencies = useMemo(() => supported('currency'), [])

  const saved = useMemo(() => draftOf(shop), [shop])
  const changed = (Object.keys(draft) as (keyof Draft)[]).filter((key) => (draft[key] ?? '') !== (saved[key] ?? ''))

  const onSaved = (next: ShopSummary, message: string) => {
    queryClient.setQueryData(shopKeys.current, next)
    success(message)
  }

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {}
      for (const key of changed) {
        const value = draft[key]
        body[key] = key === 'email' || key === 'phone' ? (String(value ?? '').trim() || null) : value
      }
      return api.patch<ShopSummary>('/shop', body)
    },
    onSuccess: (next) => {
      setErrors({})
      onSaved(next, 'Store details saved')
    },
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      flashError(errorMessage(caught))
    },
  })

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  return (
    <>
      <PageHeader
        title="Store details"
        subtitle={`${shop.handle} · opened ${formatDate(shop.created_at)}`}
        actions={
          <Button variant="contained" disabled={!canManage || changed.length === 0 || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <SectionCard title="Profile" description="How customers and the platform reach you. Order notifications are sent from this store name.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Store name"
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              error={Boolean(errors.name)}
              helperText={errors.name}
              disabled={!canManage}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Store email"
              type="email"
              value={draft.email ?? ''}
              onChange={(event) => set('email', event.target.value)}
              error={Boolean(errors.email)}
              helperText={errors.email ?? 'Customers reply to this address.'}
              disabled={!canManage}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Store phone"
              value={draft.phone ?? ''}
              onChange={(event) => set('phone', event.target.value)}
              error={Boolean(errors.phone)}
              helperText={errors.phone ?? ' '}
              disabled={!canManage}
              fullWidth
            />
          </Grid>
        </Grid>
      </SectionCard>

      <BrandCard canManage={canManage} onSaved={success} onError={flashError} />

      <SectionCard
        title="Store address"
        description="Your store's address on the platform. Connect your own domain to replace it for customers."
        actions={
          <Button component={RouterLink} to="/settings/domains" size="small">
            Manage domains
          </Button>
        }
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href={shop.storefront_url} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {shop.primary_domain ?? shop.storefront_url.replace(/^https?:\/\//, '')}
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </Link>
          <Chip size="small" label={shop.status} color={shop.status === 'active' ? 'success' : 'default'} />
        </Stack>
      </SectionCard>

      <SectionCard
        title="Store defaults"
        description="Prices, orders and reports are in the store currency. Country and currency cannot change once the store has taken an order."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              label="Country"
              value={draft.country_code}
              onChange={(event) => set('country_code', event.target.value)}
              error={Boolean(errors.country_code)}
              helperText={errors.country_code ?? `Taxes are worked out for ${countryName(draft.country_code)}.`}
              disabled={!canManage}
              fullWidth
            >
              {Array.from(new Set([draft.country_code, ...(options.data?.countries ?? [])])).map((code) => (
                <MenuItem key={code} value={code}>
                  {countryName(code)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              options={currencies.length ? currencies : [draft.currency]}
              value={draft.currency}
              onChange={(_event, value) => value && set('currency', value)}
              disableClearable
              disabled={!canManage}
              renderInput={(params) => (
                <TextField {...params} label="Store currency" error={Boolean(errors.currency)} helperText={errors.currency ?? ' '} />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              options={timezones.length ? timezones : [draft.timezone]}
              value={draft.timezone}
              onChange={(_event, value) => value && set('timezone', value)}
              disableClearable
              disabled={!canManage}
              renderInput={(params) => (
                <TextField {...params} label="Time zone" error={Boolean(errors.timezone)} helperText={errors.timezone ?? 'Reports and order dates use this zone.'} />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField select label="Language" value={draft.locale} onChange={(event) => set('locale', event.target.value)} disabled={!canManage} fullWidth>
              {Array.from(new Set([draft.locale, ...LOCALES])).map((locale) => (
                <MenuItem key={locale} value={locale}>
                  {locale}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Weight unit"
              value={draft.weight_unit}
              onChange={(event) => set('weight_unit', event.target.value as Draft['weight_unit'])}
              disabled={!canManage}
              fullWidth
            >
              {WEIGHT_UNITS.map((unit) => (
                <MenuItem key={unit.value} value={unit.value}>
                  {unit.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </SectionCard>

      <StorefrontPasswordCard shop={shop} canManage={canManage} onSaved={onSaved} onError={(caught) => flashError(errorMessage(caught))} />

      {isOwner && <OwnerActions shop={shop} memberships={memberships} switchTo={switchTo} onSaved={onSaved} onError={(caught) => flashError(errorMessage(caught))} />}

      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function StorefrontPasswordCard({
  shop,
  canManage,
  onSaved,
  onError,
}: {
  shop: Shop
  canManage: boolean
  onSaved(next: ShopSummary, message: string): void
  onError(caught: unknown): void
}) {
  const [enabled, setEnabled] = useState(shop.storefront_password_enabled)
  const [password, setPassword] = useState('')
  const dirty = enabled !== shop.storefront_password_enabled || password.length > 0

  const save = useMutation({
    mutationFn: () => api.patch<ShopSummary>('/shop', { storefront_password: { enabled, password: password || null } }),
    onSuccess: (next) => {
      setPassword('')
      onSaved(next, enabled ? 'Storefront is password protected' : 'Storefront is open to everyone')
    },
    onError,
  })

  return (
    <SectionCard
      title="Storefront password"
      description="While a password is on, only people you give it to can browse or buy. Use it while you build the store."
      actions={
        <Button size="small" variant="outlined" disabled={!canManage || !dirty || save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      }
    >
      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={!canManage} />}
          label={enabled ? 'Password protection is on' : 'Password protection is off'}
        />
        {enabled && (
          <TextField
            label={shop.storefront_password_enabled ? 'New password (leave blank to keep the current one)' : 'Password visitors enter'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!canManage}
            size="small"
            fullWidth
          />
        )}
      </Stack>
    </SectionCard>
  )
}

function OwnerActions({
  shop,
  memberships,
  switchTo,
  onSaved,
  onError,
}: {
  shop: Shop
  memberships: { shop_id: number; handle: string }[]
  switchTo(shopId: number): Promise<void>
  onSaved(next: ShopSummary, message: string): void
  onError(caught: unknown): void
}) {
  const { logout } = useAuth()
  const [dialog, setDialog] = useState<'pause' | 'transfer' | 'close' | null>(null)
  const [newOwner, setNewOwner] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const staff = useQuery({
    queryKey: ['admin-users', 'list', { status: 'active', for: 'ownership' }],
    queryFn: () => api.get<{ admin_users: AdminUser[] }>('/admin-users', { status: 'active', limit: 100 }),
    enabled: dialog === 'transfer',
  })

  const pause = useMutation({
    mutationFn: () => api.post<ShopSummary>(shop.status === 'paused' ? '/shop/unpause' : '/shop/pause'),
    onSuccess: (next) => {
      setDialog(null)
      onSaved(next, next.shop.status === 'paused' ? 'Store paused' : 'Store resumed')
    },
    onError,
  })
  const transfer = useMutation({
    mutationFn: () => api.post('/shop/transfer-ownership', { admin_user_id: newOwner }),
    onSuccess: () => window.location.reload(),
    onError,
  })
  const close = useMutation({
    mutationFn: (confirmHandle: string) => api.post('/shop/close', { reason, confirm_handle: confirmHandle }),
    onSuccess: async () => {
      const other = memberships.find((membership) => membership.handle !== shop.handle)
      if (other) await switchTo(other.shop_id)
      else await logout()
    },
    onError,
  })

  const paused = shop.status === 'paused'

  return (
    <SectionCard title="Store status" description="Only the store owner sees these.">
      <Stack spacing={2}>
        <Row
          title={paused ? 'Resume selling' : 'Pause and build'}
          body={
            paused
              ? 'The storefront is closed to customers. Resume to take orders again.'
              : 'Close the storefront while you work on it. Your plan continues at a reduced rate while paused.'
          }
          action={
            <Button variant="outlined" disabled={!['active', 'paused'].includes(shop.status)} onClick={() => setDialog('pause')}>
              {paused ? 'Resume store' : 'Pause store'}
            </Button>
          }
        />
        <Row
          title="Transfer ownership"
          body="Make another active staff member the owner. You stay on the staff with full access."
          action={
            <Button variant="outlined" onClick={() => setDialog('transfer')}>
              Transfer
            </Button>
          }
        />
        <Row
          title="Close store"
          body="The storefront goes offline and billing stops. Your data is kept so the store can be reopened."
          action={
            <Button variant="outlined" color="error" onClick={() => setDialog('close')}>
              Close store
            </Button>
          }
        />
      </Stack>

      <ConfirmDialog
        open={dialog === 'pause'}
        title={paused ? 'Resume this store?' : 'Pause this store?'}
        body={paused ? 'Customers will be able to browse and buy again.' : 'Customers will see a closed page until you resume. Orders already placed are unaffected.'}
        confirmLabel={paused ? 'Resume store' : 'Pause store'}
        busy={pause.isPending}
        onConfirm={() => pause.mutate()}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'transfer'}
        title="Transfer ownership"
        body={
          <Stack spacing={2}>
            <Typography variant="body2">The new owner controls billing, staff and closing the store.</Typography>
            <TextField select label="New owner" value={newOwner} onChange={(event) => setNewOwner(Number(event.target.value))} size="small" fullWidth>
              {(staff.data?.admin_users ?? []).map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {[member.first_name, member.last_name].filter(Boolean).join(' ')} · {member.email}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        }
        confirmLabel="Transfer ownership"
        destructive
        busy={transfer.isPending}
        confirmDisabled={newOwner === ''}
        onConfirm={() => transfer.mutate()}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'close'}
        title={`Close ${shop.name}?`}
        body={
          <Stack spacing={2}>
            <Alert severity="warning">The storefront goes offline immediately and staff lose access.</Alert>
            <TextField label="Why are you closing?" value={reason} onChange={(event) => setReason(event.target.value)} size="small" fullWidth />
          </Stack>
        }
        confirmLabel="Close store"
        destructive
        typeToConfirm={shop.handle}
        busy={close.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => close.mutate(shop.handle)}
        onClose={() => setDialog(null)}
      />
    </SectionCard>
  )
}

function Row({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {body}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0 }}>{action}</Box>
    </Stack>
  )
}
