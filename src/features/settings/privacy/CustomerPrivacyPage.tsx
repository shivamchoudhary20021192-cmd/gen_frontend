import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { countryOptions } from '../../../lib/countries'
import { errorMessage } from '../../../lib/errors'
import { countryName } from '../../../lib/format'
import { privacyKeys } from '../../privacy/privacyTypes'

type Copy = { title?: string; message?: string; accept?: string; decline?: string; manage?: string }

interface PrivacySettings {
  banner_enabled: boolean
  banner_regions: 'required' | 'all' | 'custom'
  banner_countries: string[]
  banner_position: 'bottom' | 'bottom_left' | 'bottom_right' | 'center'
  banner_colors: { background: string; text: string; button: string; button_text: string }
  banner_copy: Record<string, Copy>
  consent_max_age_days: number
  reprompt_on_policy_change: boolean
  sale_opt_out_enabled: boolean
  sale_opt_out_countries: string[]
  honor_gpc: boolean
  request_form_enabled: boolean
  request_response_days: number
  erasure_grace_days: number
  erasure_order_hold_days: number
  privacy_email: string | null
  grievance_officer_name: string | null
  grievance_officer_email: string | null
  grievance_officer_phone: string | null
  updated_at: string | null
}

interface SettingsResponse {
  settings: PrivacySettings
  defaults: { required_countries: string[]; sale_opt_out_countries: string[]; banner_colors: PrivacySettings['banner_colors']; banner_copy: Record<string, Required<Copy>> }
  storefront_url: string
}

const LANGUAGES: Record<string, string> = { en: 'English', hi: 'Hindi', de: 'German', fr: 'French', es: 'Spanish' }
const COPY_FIELDS: { key: keyof Copy; label: string; multiline?: boolean }[] = [
  { key: 'title', label: 'Heading' },
  { key: 'message', label: 'Message', multiline: true },
  { key: 'accept', label: '“Accept” button' },
  { key: 'decline', label: '“Reject” button' },
  { key: 'manage', label: '“Preferences” button' },
]

function CountryPicker({ value, onChange, label, disabled }: { value: string[]; onChange(next: string[]): void; label: string; disabled?: boolean }) {
  const options = useMemo(() => countryOptions(), [])
  return (
    <Autocomplete
      multiple
      disabled={disabled}
      options={options.map((option) => option.code)}
      value={value}
      onChange={(_event, next) => onChange(next)}
      getOptionLabel={(code) => `${countryName(code)} (${code})`}
      renderValue={(selected, getItemProps) => selected.map((code, index) => <Chip {...getItemProps({ index })} key={code} size="small" label={countryName(code)} />)}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  )
}

/**
 * Settings → Customer privacy, as on Shopify: the cookie banner (where it
 * shows, how it looks, what it says), the "Do not sell or share" opt-out for
 * US shoppers with Global Privacy Control, how privacy requests are handled,
 * and the people shoppers can reach about their data.
 */
export function CustomerPrivacyPage() {
  const { flash, success, clear } = useFlash()
  const query = useQuery({ queryKey: privacyKeys.settings, queryFn: () => api.get<SettingsResponse>('/privacy/settings') })
  if (query.isLoading || !query.data) {
    return <Box sx={{ p: 6, textAlign: 'center' }}>{query.isError ? <Alert severity="error">{errorMessage(query.error)}</Alert> : <CircularProgress />}</Box>
  }
  return (
    <>
      <PrivacySettingsForm initial={query.data.settings} defaults={query.data.defaults} storefront={query.data.storefront_url} onSaved={success} />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function PrivacySettingsForm({ initial, defaults, storefront, onSaved }: { initial: PrivacySettings; defaults: SettingsResponse['defaults']; storefront: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('privacy.settings')
  const [saved, setSaved] = useState<PrivacySettings>(initial)
  const [form, setForm] = useState<PrivacySettings>(initial)
  const [language, setLanguage] = useState('en')

  const save = useMutation({
    mutationFn: (settings: PrivacySettings) => {
      const body: Partial<PrivacySettings> = { ...settings }
      delete body.updated_at
      return api.patch<{ settings: PrivacySettings }>('/privacy/settings', {
        ...body,
        privacy_email: body.privacy_email?.trim() || null,
        grievance_officer_name: body.grievance_officer_name?.trim() || null,
        grievance_officer_email: body.grievance_officer_email?.trim() || null,
        grievance_officer_phone: body.grievance_officer_phone?.trim() || null,
      })
    },
    onSuccess: (response) => {
      setSaved(response.settings)
      setForm(response.settings)
      queryClient.setQueryData(privacyKeys.settings, (old: SettingsResponse | undefined) => (old ? { ...old, settings: response.settings } : old))
      void queryClient.invalidateQueries({ queryKey: privacyKeys.overview })
      onSaved('Customer privacy saved — the storefront uses it straight away')
    },
  })

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = <K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) => setForm({ ...form, [key]: value })
  const copy = form.banner_copy[language] ?? {}
  const setCopy = (key: keyof Copy, value: string) => set('banner_copy', { ...form.banner_copy, [language]: { ...copy, [key]: value } })

  return (
    <Box sx={{ maxWidth: 880 }}>
      <PageHeader
        title="Customer privacy"
        subtitle="How the store asks for consent, honours opt-outs and answers privacy requests"
        actions={
          canManage && (
            <Stack direction="row" spacing={1}>
              <Button disabled={!dirty || save.isPending} onClick={() => setForm(saved)}>Discard</Button>
              <Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate(form)} data-save-privacy>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          )
        }
      />
      {save.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(save.error)}</Alert>}

      <SectionCard
        title="Cookie banner"
        description="Asks visitors before analytics, marketing and preference cookies run. Reject is as easy as accept, nothing is pre-ticked, and visitors can change their mind from “Cookie preferences” at the foot of every page."
        actions={<Link href={`${storefront}/`} target="_blank" rel="noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>View store <OpenInNewIcon sx={{ fontSize: 16 }} /></Link>}
      >
        <Stack spacing={2.5}>
          <FormControlLabel control={<Switch checked={form.banner_enabled} disabled={!canManage} onChange={(event) => set('banner_enabled', event.target.checked)} data-banner-enabled />} label="Show the cookie banner" />
          {!form.banner_enabled && (
            <Alert severity="warning">
              With the banner off, visitors in the EU, the UK, India and other places where consent is required are not asked before non-essential cookies run. Turn it off only if the store uses no such cookies.
            </Alert>
          )}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Where it shows</Typography>
            <RadioGroup value={form.banner_regions} onChange={(event) => set('banner_regions', event.target.value as PrivacySettings['banner_regions'])}>
              <FormControlLabel value="required" disabled={!canManage || !form.banner_enabled} control={<Radio />} label={<span>Where the law requires consent <Typography component="span" variant="body2" color="text.secondary">— the EU and EEA, the UK, Switzerland, India (DPDP Act) and Brazil ({defaults.required_countries.length} countries)</Typography></span>} />
              <FormControlLabel value="all" disabled={!canManage || !form.banner_enabled} control={<Radio />} label="Everywhere" />
              <FormControlLabel value="custom" disabled={!canManage || !form.banner_enabled} control={<Radio />} label="Only in countries I choose" />
            </RadioGroup>
            {form.banner_regions === 'custom' && (
              <Box sx={{ mt: 1 }}>
                <CountryPicker label="Countries" value={form.banner_countries} disabled={!canManage || !form.banner_enabled} onChange={(next) => set('banner_countries', next)} />
              </Box>
            )}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Position" value={form.banner_position} disabled={!canManage} onChange={(event) => set('banner_position', event.target.value as PrivacySettings['banner_position'])} sx={{ minWidth: 220 }}>
              <MenuItem value="bottom">Bottom of the page</MenuItem>
              <MenuItem value="bottom_left">Bottom left</MenuItem>
              <MenuItem value="bottom_right">Bottom right</MenuItem>
              <MenuItem value="center">Centre, over the page</MenuItem>
            </TextField>
            <TextField
              label="Ask again after"
              type="number"
              value={form.consent_max_age_days}
              disabled={!canManage}
              onChange={(event) => set('consent_max_age_days', Math.max(30, Math.min(730, Number(event.target.value) || 365)))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> }, htmlInput: { min: 30, max: 730 } }}
              helperText="12 months is the usual guidance"
              sx={{ width: 220 }}
            />
          </Stack>
          <FormControlLabel control={<Switch checked={form.reprompt_on_policy_change} disabled={!canManage} onChange={(event) => set('reprompt_on_policy_change', event.target.checked)} />} label="Ask again when the privacy policy changes" />
          <Box>
            <Typography variant="subtitle2" gutterBottom>Colours</Typography>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {(['background', 'text', 'button', 'button_text'] as const).map((key) => (
                <TextField
                  key={key}
                  label={{ background: 'Background', text: 'Text', button: 'Buttons', button_text: 'Button text' }[key]}
                  type="color"
                  value={form.banner_colors[key]}
                  disabled={!canManage}
                  onChange={(event) => set('banner_colors', { ...form.banner_colors, [key]: event.target.value })}
                  sx={{ width: 140 }}
                />
              ))}
              <Button size="small" disabled={!canManage} onClick={() => set('banner_colors', defaults.banner_colors)}>Reset</Button>
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Wording</Typography>
              <TextField select size="small" value={language} onChange={(event) => setLanguage(event.target.value)} sx={{ minWidth: 160 }}>
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <MenuItem key={code} value={code}>{name}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Leave a field empty to use the wording shown, written to what regulators expect: what is used, why, and that refusing is as easy as accepting.
            </Typography>
            <Stack spacing={2}>
              {COPY_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={copy[field.key] ?? ''}
                  placeholder={defaults.banner_copy[language]?.[field.key] ?? defaults.banner_copy.en[field.key]}
                  disabled={!canManage}
                  multiline={field.multiline}
                  minRows={field.multiline ? 3 : undefined}
                  onChange={(event) => setCopy(field.key, event.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: field.key === 'message' ? 1000 : field.key === 'title' ? 120 : 60 } }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Sale and sharing opt-out"
        description="US state privacy laws (California’s CCPA/CPRA and others) let shoppers opt out of the sale or sharing of their personal information, including for targeted ads. Shoppers there get a “Your privacy choices” link and page."
        actions={<Link href={`${storefront}/pages/data-sharing-opt-out`} target="_blank" rel="noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>View page <OpenInNewIcon sx={{ fontSize: 16 }} /></Link>}
      >
        <Stack spacing={2}>
          <FormControlLabel control={<Switch checked={form.sale_opt_out_enabled} disabled={!canManage} onChange={(event) => set('sale_opt_out_enabled', event.target.checked)} />} label="Offer the opt-out" />
          <CountryPicker label="Countries" value={form.sale_opt_out_countries} disabled={!canManage || !form.sale_opt_out_enabled} onChange={(next) => set('sale_opt_out_countries', next)} />
          <FormControlLabel control={<Switch checked={form.honor_gpc} disabled={!canManage} onChange={(event) => set('honor_gpc', event.target.checked)} />} label={<span>Honour Global Privacy Control <Typography component="span" variant="body2" color="text.secondary">— a browser setting several US states require stores to treat as an opt-out</Typography></span>} />
        </Stack>
      </SectionCard>

      <SectionCard
        title="Privacy requests"
        description={<>Customers can ask to see, correct or delete their data, or withdraw consent, from their account or a request page; you handle them in <Link component={RouterLink} to="/privacy">Customers → Consents &amp; privacy</Link>.</>}
        actions={<Link href={`${storefront}/privacy/request`} target="_blank" rel="noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>View form <OpenInNewIcon sx={{ fontSize: 16 }} /></Link>}
      >
        <Stack spacing={2}>
          <FormControlLabel control={<Switch checked={form.request_form_enabled} disabled={!canManage} onChange={(event) => set('request_form_enabled', event.target.checked)} />} label="Offer a privacy request page on the store" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Respond within"
              type="number"
              value={form.request_response_days}
              disabled={!canManage}
              onChange={(event) => set('request_response_days', Math.max(1, Math.min(90, Number(event.target.value) || 30)))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }}
              helperText="GDPR: one month"
            />
            <TextField
              label="Erasure grace period"
              type="number"
              value={form.erasure_grace_days}
              disabled={!canManage}
              onChange={(event) => set('erasure_grace_days', Math.max(0, Math.min(90, Number(event.target.value) || 0)))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }}
              helperText="Time to cancel a mistake"
            />
            <TextField
              label="Wait after their last order"
              type="number"
              value={form.erasure_order_hold_days}
              disabled={!canManage}
              onChange={(event) => set('erasure_order_hold_days', Math.max(0, Math.min(730, Number(event.target.value) || 0)))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }}
              helperText="For returns and chargebacks"
            />
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Privacy contacts"
        description="India’s DPDP Act and the Consumer Protection (E-Commerce) Rules ask stores to name someone shoppers can take a grievance to — acknowledged within 48 hours, resolved within a month. These appear on the request page and in policy templates."
      >
        <Stack spacing={2}>
          <TextField label="Privacy email" type="email" value={form.privacy_email ?? ''} disabled={!canManage} onChange={(event) => set('privacy_email', event.target.value)} helperText="Where privacy questions go; falls back to your support email" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Grievance officer — name and title" value={form.grievance_officer_name ?? ''} disabled={!canManage} onChange={(event) => set('grievance_officer_name', event.target.value)} sx={{ flex: 1 }} />
            <TextField label="Grievance officer — phone" value={form.grievance_officer_phone ?? ''} disabled={!canManage} onChange={(event) => set('grievance_officer_phone', event.target.value)} sx={{ flex: 1 }} />
          </Stack>
          <TextField label="Grievance officer — email" type="email" value={form.grievance_officer_email ?? ''} disabled={!canManage} onChange={(event) => set('grievance_officer_email', event.target.value)} />
        </Stack>
      </SectionCard>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Your store’s legal pages — the privacy policy the banner links to among them — are in <Link component={RouterLink} to="/settings/policies">Settings → Policies</Link>.
      </Typography>
    </Box>
  )
}
