import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  Chip,
  Grid,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, platformApi } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { useDebounce } from '../../hooks/useDebounce'
import { useGoogleFonts } from '../../hooks/useGoogleFonts'
import { countryName } from '../../lib/format'
import { ThemeArt } from '../merchandising/themes/ThemeArt'
import { screenshotOf } from '../merchandising/themes/themeScreenshots'
import type { LibraryTheme } from '../merchandising/themes/themeTypes'
import { PASSWORD_HINT, passwordProblem } from './passwordRules'

/**
 * Opening a store, the way Shopify's onboarding does it: a few questions, one
 * per screen, each with an obvious answer and a way to skip — then the store
 * is built from the answers (its theme and style, its catalogue structure,
 * its currency, taxes and delivery) and the new owner lands in a working
 * admin with a setup guide, not a blank screen.
 */

interface SignupOptions {
  verticals: { key: string; name: string; description: string; theme: string }[]
  countries: string[]
  themes: LibraryTheme[]
}

type Stage = 'starting' | 'online' | 'in_person' | 'switching'
type Channel = 'online_store' | 'social' | 'marketplaces' | 'in_person' | 'not_sure'

interface Draft {
  stage: Stage | null
  channels: Channel[]
  vertical: string
  theme: string | null
  themeStyle: string | null
  name: string
  handle: string
  country: string
  firstName: string
  lastName: string
  email: string
  password: string
}

const STORAGE_KEY = 'veylog.signup.draft'
const STEPS = ['describe', 'channels', 'sell', 'look', 'store', 'account'] as const
type Step = (typeof STEPS)[number]

const STAGES: { value: Stage; title: string; body: string }[] = [
  { value: 'starting', title: "I'm just starting", body: 'Setting up a business for the first time.' },
  { value: 'online', title: "I'm already selling online", body: 'On social media, a marketplace or another website.' },
  { value: 'in_person', title: "I'm selling in person", body: 'At a shop, market stall or events.' },
  { value: 'switching', title: "I'm moving from another platform", body: 'Bring your products and customers with you.' },
]

const CHANNELS: { value: Channel; title: string; body: string }[] = [
  { value: 'online_store', title: 'An online store', body: 'Your own website with your own domain.' },
  { value: 'social', title: 'Social media', body: 'Instagram, Facebook and WhatsApp.' },
  { value: 'marketplaces', title: 'Marketplaces', body: 'Amazon, Flipkart and others.' },
  { value: 'in_person', title: 'In person', body: 'Retail stores, pop-ups and events.' },
  { value: 'not_sure', title: "I'm not sure yet", body: 'Start with an online store; add more later.' },
]

function loadDraft(): Draft {
  const empty: Draft = { stage: null, channels: [], vertical: 'general', theme: null, themeStyle: null, name: '', handle: '', country: 'IN', firstName: '', lastName: '', email: '', password: '' }
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Draft> | null
    // The password is never kept.
    return saved ? { ...empty, ...saved, password: '' } : empty
  } catch {
    return empty
  }
}

function Choice({ selected, title, body, onClick, multiple }: { selected: boolean; title: string; body: string; onClick(): void; multiple?: boolean }) {
  return (
    <Card variant="outlined" sx={{ borderColor: selected ? 'text.primary' : 'divider', borderWidth: selected ? 2 : 1, transition: 'border-color .15s' }}>
      <CardActionArea onClick={onClick} sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5, justifyContent: 'flex-start' }}>
        {multiple ? <Checkbox checked={selected} size="small" sx={{ p: 0, mt: 0.25 }} tabIndex={-1} /> : selected ? <CheckCircleIcon sx={{ mt: 0.25 }} /> : <RadioButtonUncheckedIcon sx={{ mt: 0.25, color: 'text.disabled' }} />}
        <Box>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {body}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  )
}

function Screen({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 650, letterSpacing: '-0.02em', mb: 1 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3.5 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Box>
  )
}

const BUILDING = ['Creating your store', 'Adding your theme', 'Setting up taxes and delivery', 'Getting your admin ready']

export function SignupPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [step, setStep] = useState<Step>('describe')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [building, setBuilding] = useState<number | null>(null)
  const [handleTouched, setHandleTouched] = useState(Boolean(draft.handle))

  const options = useQuery({ queryKey: ['signup-options'], queryFn: () => platformApi.anonymousGet<SignupOptions>('/signup/options'), staleTime: Infinity })
  const themes = useMemo(() => options.data?.themes ?? [], [options.data])
  const vertical = options.data?.verticals.find((candidate) => candidate.key === draft.vertical)
  const recommended = vertical?.theme ?? 'aurora'
  const orderedThemes = useMemo(() => [...themes].sort((a, b) => Number(b.handle === recommended) - Number(a.handle === recommended)), [themes, recommended])
  useGoogleFonts([...new Set(themes.map((theme) => String((theme.presets[0]?.style ?? {}).font_heading ?? '')))])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, password: '' }))
    } catch {
      /* private mode: the draft simply does not survive a reload */
    }
  }, [draft])

  // An address suggested from the name until the person types their own.
  const debouncedName = useDebounce(draft.name, 400)
  const debouncedHandle = useDebounce(draft.handle, 400)
  const suggestion = useQuery({
    queryKey: ['suggest-handle', debouncedName],
    queryFn: () => platformApi.anonymousGet<{ handle: string }>('/signup/suggest-handle', { name: debouncedName }),
    enabled: !handleTouched && debouncedName.trim().length >= 2,
  })
  const suggested = !handleTouched ? suggestion.data?.handle : undefined
  const handle = handleTouched ? draft.handle : (suggested ?? draft.handle)
  const availability = useQuery({
    queryKey: ['handle-available', debouncedHandle],
    queryFn: () => platformApi.anonymousGet<{ available: boolean; reason?: string }>(`/signup/handles/${encodeURIComponent(debouncedHandle)}`),
    enabled: handleTouched && debouncedHandle.length >= 1,
  })
  const handleTaken = handleTouched && availability.data && !availability.data.available

  if (status === 'authenticated' && building === null) return <Navigate to="/stores/new" replace />

  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }))
  const index = STEPS.indexOf(step)
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)])
  const back = () => setStep(STEPS[Math.max(0, index - 1)])
  const passwordIssue = draft.password ? passwordProblem(draft.password) : null
  const accountReady = draft.firstName.trim() && draft.email.includes('@') && draft.password && !passwordIssue

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setError(null)
    setFieldErrors({})
    setBuilding(0)
    const ticker = setInterval(() => setBuilding((value) => (value === null ? null : Math.min(BUILDING.length - 1, value + 1))), 1400)
    try {
      await platformApi.anonymousPost('/signup', {
        email: draft.email,
        password: draft.password,
        first_name: draft.firstName,
        last_name: draft.lastName || null,
        shop: {
          name: draft.name,
          handle: handle || null,
          country_code: draft.country,
          vertical: draft.vertical,
          theme: draft.theme ?? recommended,
          theme_style: draft.themeStyle,
          stage: draft.stage,
          channels: draft.channels.length ? draft.channels : null,
        },
      })
      await login(draft.email, draft.password)
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        /* nothing to clear */
      }
      setBuilding(BUILDING.length)
      navigate('/dashboard?welcome=1', { replace: true })
    } catch (caught) {
      setBuilding(null)
      if (caught instanceof ApiError) {
        setError(caught.message)
        const fields = caught.fieldErrors()
        setFieldErrors(fields)
        if (fields.name || fields.handle || fields.country_code) setStep('store')
      } else setError('Could not reach the server. Check your connection and try again.')
    } finally {
      clearInterval(ticker)
    }
  }

  if (building !== null) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', px: 2 }}>
        <Stack spacing={3} sx={{ width: '100%', maxWidth: 420 }}>
          <Typography variant="h5" sx={{ fontWeight: 650 }}>
            Setting up {draft.name || 'your store'}…
          </Typography>
          <LinearProgress variant="determinate" value={((building + 1) / (BUILDING.length + 1)) * 100} sx={{ height: 6, borderRadius: 3 }} />
          <Stack spacing={1.25}>
            {BUILDING.map((label, position) => (
              <Stack key={label} direction="row" spacing={1.25} sx={{ alignItems: 'center', color: position <= building ? 'text.primary' : 'text.disabled' }}>
                {position < building ? <CheckCircleIcon fontSize="small" color="success" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                <Typography variant="body2">{label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Box>
    )
  }

  const canContinue: Record<Step, boolean> = {
    describe: true,
    channels: true,
    sell: Boolean(draft.vertical),
    look: true,
    store: draft.name.trim().length >= 2 && !handleTaken,
    account: Boolean(accountReady),
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', px: { xs: 2, md: 4 }, height: 64, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <StorefrontOutlinedIcon sx={{ mr: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          Veylog
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Already have a store?{' '}
          <Link component={RouterLink} to="/login">
            Sign in
          </Link>
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={((index + 1) / STEPS.length) * 100} sx={{ height: 3 }} />

      <Box component="form" onSubmit={(event: FormEvent) => { event.preventDefault(); if (step === 'account') void submit(); else if (canContinue[step]) next() }} sx={{ flex: 1, width: '100%', maxWidth: step === 'look' ? 1080 : 680, mx: 'auto', px: 2, py: { xs: 4, md: 7 } }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {step === 'describe' && (
          <Screen title="Let's get started. Which of these best describes you?" subtitle="We'll use this to set up your store and suggest the right next steps.">
            <Stack spacing={1.5}>
              {STAGES.map((option) => (
                <Choice key={option.value} selected={draft.stage === option.value} title={option.title} body={option.body} onClick={() => set({ stage: option.value })} />
              ))}
            </Stack>
          </Screen>
        )}

        {step === 'channels' && (
          <Screen title="Where would you like to sell?" subtitle="Pick as many as you like. Your online store comes with every plan.">
            <Stack spacing={1.5}>
              {CHANNELS.map((option) => (
                <Choice
                  key={option.value}
                  multiple
                  selected={draft.channels.includes(option.value)}
                  title={option.title}
                  body={option.body}
                  onClick={() => set({ channels: draft.channels.includes(option.value) ? draft.channels.filter((value) => value !== option.value) : [...draft.channels, option.value] })}
                />
              ))}
            </Stack>
          </Screen>
        )}

        {step === 'sell' && (
          <Screen title="What do you plan to sell?" subtitle="We'll set up your categories, product details and a theme made for it.">
            {options.isLoading && <LinearProgress />}
            <Grid container spacing={1.5}>
              {(options.data?.verticals ?? []).map((option) => (
                <Grid key={option.key} size={{ xs: 12, sm: 6 }}>
                  <Choice selected={draft.vertical === option.key} title={option.name} body={option.description} onClick={() => set({ vertical: option.key, theme: null, themeStyle: null })} />
                </Grid>
              ))}
            </Grid>
          </Screen>
        )}

        {step === 'look' && (
          <Screen title="Pick a look for your store" subtitle="Every theme is free and fully customisable — you can change it, or try others, at any time.">
            <Grid container spacing={2}>
              {orderedThemes.map((theme) => {
                const selected = (draft.theme ?? recommended) === theme.handle
                const style = theme.presets.find((preset) => preset.key === (selected ? draft.themeStyle : null)) ?? theme.presets[0]
                return (
                  <Grid key={theme.handle} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card variant="outlined" sx={{ borderColor: selected ? 'text.primary' : 'divider', borderWidth: selected ? 2 : 1 }}>
                      <CardActionArea onClick={() => set({ theme: theme.handle, themeStyle: selected ? draft.themeStyle : null })}>
                        <ThemeArt name={theme.name} image={theme.preview_image_url} screenshot={screenshotOf(theme, style?.key)} preset={style} height={170} />
                      </CardActionArea>
                      <Box sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                          <Typography variant="subtitle2" sx={{ flex: 1 }}>
                            {theme.name}
                          </Typography>
                          {theme.handle === recommended && <Chip size="small" color="primary" label="Recommended" sx={{ height: 20 }} />}
                        </Stack>
                        <Stack direction="row" spacing={0.75}>
                          {theme.presets.map((preset) => {
                            const colors = preset.style ?? preset.settings
                            const active = selected && (draft.themeStyle ?? theme.presets[0]?.key) === preset.key
                            return (
                              <Box
                                key={preset.key}
                                role="button"
                                tabIndex={0}
                                title={preset.name}
                                aria-label={`${theme.name}, ${preset.name} style`}
                                onClick={() => set({ theme: theme.handle, themeStyle: preset.key })}
                                onKeyDown={(event) => event.key === 'Enter' && set({ theme: theme.handle, themeStyle: preset.key })}
                                sx={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', border: 2, borderColor: active ? 'text.primary' : 'transparent', boxShadow: '0 0 0 1px rgba(0,0,0,.12) inset', background: `linear-gradient(135deg, ${String(colors.color_background ?? '#fff')} 50%, ${String(colors.color_accent ?? '#111')} 50%)` }}
                              />
                            )
                          })}
                        </Stack>
                      </Box>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Screen>
        )}

        {step === 'store' && (
          <Screen title="Name your store" subtitle="You can change the name at any time, and connect your own domain later.">
            <Stack spacing={2.5}>
              <TextField label="Store name" value={draft.name} onChange={(event) => set({ name: event.target.value })} placeholder="Lotus Botanics" autoFocus required fullWidth error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} />
              <TextField
                label="Store address"
                value={handle}
                onChange={(event) => {
                  setHandleTouched(true)
                  set({ handle: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                }}
                error={Boolean(handleTaken || fieldErrors.handle)}
                helperText={fieldErrors.handle ?? (handleTaken ? (availability.data?.reason === 'invalid' ? 'Use lowercase letters, numbers and hyphens.' : 'That address is taken.') : 'Your store opens here straight away.')}
                slotProps={{ input: { endAdornment: <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>.myveylog.com</Typography> } }}
                fullWidth
              />
              <TextField select label="Where will your business be located?" value={draft.country} onChange={(event) => set({ country: event.target.value })} helperText="Sets your currency, taxes and delivery defaults." fullWidth>
                {(options.data?.countries ?? [draft.country]).map((code) => (
                  <MenuItem key={code} value={code}>
                    {countryName(code)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Screen>
        )}

        {step === 'account' && (
          <Screen title="Create your account" subtitle={<>Your free trial starts today. No card needed until it ends.</>}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5}>
                <TextField label="First name" value={draft.firstName} onChange={(event) => set({ firstName: event.target.value })} autoComplete="given-name" required fullWidth autoFocus />
                <TextField label="Last name" value={draft.lastName} onChange={(event) => set({ lastName: event.target.value })} autoComplete="family-name" fullWidth />
              </Stack>
              <TextField label="Email" type="email" value={draft.email} onChange={(event) => set({ email: event.target.value })} autoComplete="username" required fullWidth error={Boolean(fieldErrors.email)} helperText={fieldErrors.email ?? ' '} />
              <TextField
                label="Password"
                type="password"
                value={draft.password}
                onChange={(event) => set({ password: event.target.value })}
                autoComplete="new-password"
                required
                fullWidth
                error={Boolean(passwordIssue || fieldErrors.password)}
                helperText={passwordIssue ?? fieldErrors.password ?? PASSWORD_HINT}
              />
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Your store
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {draft.name || 'Your store'} · {handle || 'your-store'}.myveylog.com · {countryName(draft.country)} · {options.data?.verticals.find((option) => option.key === draft.vertical)?.name ?? 'General'} · {themes.find((theme) => theme.handle === (draft.theme ?? recommended))?.name ?? 'Recommended theme'}
                </Typography>
              </Card>
            </Stack>
          </Screen>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 4, alignItems: 'center' }}>
          {index > 0 && (
            <Button startIcon={<ArrowBackIcon />} onClick={back} color="inherit">
              Back
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {(step === 'describe' || step === 'channels' || step === 'look') && (
            <Button color="inherit" onClick={next}>
              Skip
            </Button>
          )}
          <Button type="submit" variant="contained" size="large" disabled={!canContinue[step]}>
            {step === 'account' ? 'Create store' : 'Next'}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'right' }}>
          Step {index + 1} of {STEPS.length}
        </Typography>
      </Box>
    </Box>
  )
}
