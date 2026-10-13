import { useMemo, useState } from 'react'
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
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { LinkTargetPicker, isSearchableLinkType } from '../../../components/LinkTargetPicker'
import { countryOptions } from '../../../lib/countries'
import { Check as CheckIcon } from '@mui/icons-material'
import { countryName, storeCurrency } from '../../../lib/format'
import { ColorField } from './ColorField'
import type { AnnouncementInput, PageType } from './useAnnouncements'

const LINK_TYPES = [
  { value: 'none', label: 'Nowhere — just text' },
  { value: 'url', label: 'A web address' },
  { value: 'product', label: 'A product' },
  { value: 'category', label: 'A category' },
  { value: 'collection', label: 'A collection' },
  { value: 'page', label: 'A page' },
  { value: 'policy', label: 'A policy' },
  { value: 'article', label: 'A journal article' },
]

const PAGES: { value: PageType; label: string }[] = [
  { value: 'index', label: 'Home page' },
  { value: 'product', label: 'Product pages' },
  { value: 'collection', label: 'Collections' },
  { value: 'list-collections', label: 'All collections' },
  { value: 'cart', label: 'Cart' },
  { value: 'search', label: 'Search' },
  { value: 'page', label: 'Pages' },
  { value: 'blog', label: 'Blogs' },
  { value: 'article', label: 'Blog posts' },
  { value: 'policy', label: 'Policies' },
]

/** A stored instant as <input type="datetime-local"> wants it: the admin's own clock, not UTC. */
function forInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** And back: the local time typed, as the instant it means. */
function fromInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/**
 * One line of the bar: what it says, how it looks, and who sees it where.
 */
export function LineDialog({ open, title, form, onChange, onClose, onSave, saving, error }: {
  open: boolean
  title: string
  form: AnnouncementInput
  onChange(next: AnnouncementInput): void
  onClose(): void
  onSave(): void
  saving: boolean
  error: string | null
}) {
  const [tab, setTab] = useState<'content' | 'style' | 'where'>('content')
  const countries = useMemo(() => countryOptions(), [])
  const set = <K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) => onChange({ ...form, [key]: value })
  const freeShipping = form.kind === 'free_shipping'
  const ownColours = Boolean(form.background_hex || form.text_hex)
  const ratio = form.background_hex && form.text_hex ? contrast(form.background_hex, form.text_hex) : null
  const valid = form.message.trim() !== '' && (!freeShipping || (Number(form.free_shipping_threshold) > 0 && form.message.includes('{amount}')))

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-line-dialog>
      <DialogTitle>{title}</DialogTitle>
      <Tabs value={tab} onChange={(_event, next) => setTab(next)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="content" label="Content" />
        <Tab value="style" label="Colours" />
        <Tab value="where" label="Where it shows" />
      </Tabs>
      <DialogContent>
        {tab === 'content' && (
          <Stack spacing={2.5} sx={{ pt: 2 }}>
            <ToggleButtonGroup exclusive size="small" value={form.kind ?? 'message'} onChange={(_event, next) => next && set('kind', next)}>
              <ToggleButton value="message">A message</ToggleButton>
              <ToggleButton value="free_shipping" data-kind-free-shipping>Free-shipping progress</ToggleButton>
            </ToggleButtonGroup>
            {freeShipping && (
              <Alert severity="info" variant="outlined">
                Follows each shopper’s cart: “Spend ₹200 more for free delivery”, then your success message once they get there. Write <strong>{'{amount}'}</strong> where the amount left goes.
              </Alert>
            )}
            <TextField
              label={freeShipping ? 'While they are short of it' : 'What it says'}
              value={form.message}
              onChange={(event) => set('message', event.target.value)}
              placeholder={freeShipping ? 'Spend {amount} more for free delivery' : '20% off for students'}
              helperText={
                freeShipping && !form.message.includes('{amount}')
                  ? 'Include {amount}'
                  : `${form.message.length}/255 — with a fixed-height bar, longer lines are shortened to fit`
              }
              error={freeShipping && form.message !== '' && !form.message.includes('{amount}')}
              slotProps={{ htmlInput: { maxLength: 255 } }}
              fullWidth
              autoFocus
            />
            {freeShipping && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Free shipping from"
                  type="number"
                  value={form.free_shipping_threshold ?? ''}
                  onChange={(event) => set('free_shipping_threshold', event.target.value === '' ? null : Number(event.target.value))}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">{storeCurrency()}</InputAdornment> }, htmlInput: { min: 1 } }}
                  helperText="In your store currency; converted for other markets"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Once they reach it"
                  value={form.success_message ?? ''}
                  onChange={(event) => set('success_message', event.target.value)}
                  placeholder="You’ve unlocked free delivery!"
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                  sx={{ flex: 1.4 }}
                />
              </Stack>
            )}

            {/* The code is chosen, not typed: a code typed by hand outlives the offer it belongs to. */}
            <LinkTargetPicker
              type="coupon"
              value={form.coupon_id ?? null}
              onChange={(id) => set('coupon_id', id)}
              label="Discount code (optional)"
              helperText="Shown as a chip shoppers can tap to copy. When the offer ends or runs out, the line stops showing by itself."
            />

            <Divider />

            <FormControl fullWidth size="small">
              <InputLabel id="announcement-link-type-label">Where it goes when clicked</InputLabel>
              <Select
                labelId="announcement-link-type-label"
                value={form.link_type ?? 'none'}
                onChange={(event) => onChange({ ...form, link_type: event.target.value, link_ref_id: null })}
                label="Where it goes when clicked"
              >
                {LINK_TYPES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {(form.link_type === 'url' || form.link_type === 'policy') && (
              <TextField
                label={form.link_type === 'policy' ? 'Policy address' : 'Web address'}
                value={form.link_url ?? ''}
                onChange={(event) => set('link_url', event.target.value)}
                placeholder={form.link_type === 'policy' ? '/policies/shipping-policy' : 'https://…'}
                size="small"
                fullWidth
              />
            )}
            {form.link_type && form.link_type !== 'none' && form.link_type !== 'url' && form.link_type !== 'policy' && isSearchableLinkType(form.link_type) && (
              <LinkTargetPicker type={form.link_type} value={form.link_ref_id ?? null} onChange={(id) => set('link_ref_id', id)} />
            )}
            {form.link_type !== 'none' && (
              <TextField
                label="Link wording (optional)"
                value={form.cta_label ?? ''}
                onChange={(event) => set('cta_label', event.target.value)}
                placeholder="Shop now"
                helperText="Underlined words at the end of the line. Left empty, the whole line is the link."
                size="small"
                fullWidth
              />
            )}

            <Divider />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="datetime-local"
                  label="Starts"
                  value={forInput(form.starts_at)}
                  onChange={(event) => set('starts_at', fromInput(event.target.value))}
                  helperText="Empty: now"
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="datetime-local"
                  label="Ends"
                  value={forInput(form.ends_at)}
                  onChange={(event) => set('ends_at', fromInput(event.target.value))}
                  helperText="Empty: no end"
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                  fullWidth
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Switch checked={Boolean(form.show_countdown)} disabled={!form.ends_at} onChange={(event) => set('show_countdown', event.target.checked)} />}
              label={<span>Count down to the end <Typography component="span" variant="body2" color="text.secondary">{form.ends_at ? '— “Ends in 2d 04:05:06”, then the line disappears' : '— set an end first'}</Typography></span>}
            />
            <FormControlLabel control={<Switch checked={form.is_active ?? true} onChange={(event) => set('is_active', event.target.checked)} />} label="Show this line" />
          </Stack>
        )}

        {tab === 'style' && (
          <Stack spacing={2.5} sx={{ pt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={ownColours}
                  onChange={(event) => onChange({ ...form, background_hex: event.target.checked ? '#7a1f3d' : null, text_hex: event.target.checked ? '#ffffff' : null })}
                  data-own-colours
                />
              }
              label="Give this line its own colours"
            />
            <Typography variant="body2" color="text.secondary">
              With rotating lines the whole bar changes colour when this line shows; in a ticker, it shows as a coloured pill. Without, it uses the bar’s colours.
            </Typography>
            {ownColours && (
              <Stack direction="row" spacing={2}>
                <ColorField label="Background" value={form.background_hex ?? '#000000'} onChange={(value) => set('background_hex', value)} />
                <ColorField label="Text" value={form.text_hex ?? '#ffffff'} onChange={(value) => set('text_hex', value)} />
                {ratio !== null && (
                  <Chip
                    sx={{ alignSelf: 'center' }}
                    color={ratio >= 4.5 ? 'success' : 'warning'}
                    label={`Contrast ${ratio.toFixed(1)}:1${ratio >= 4.5 ? ' — readable' : ' — too faint (aim for 4.5)'}`}
                  />
                )}
              </Stack>
            )}
          </Stack>
        )}

        {tab === 'where' && (
          <Stack spacing={3} sx={{ pt: 2 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Devices</Typography>
              <RadioGroup row value={form.visibility ?? 'all'} onChange={(event) => set('visibility', event.target.value as AnnouncementInput['visibility'])}>
                <FormControlLabel value="all" control={<Radio />} label="Desktop and phones" />
                <FormControlLabel value="desktop" control={<Radio />} label="Desktop only" />
                <FormControlLabel value="mobile" control={<Radio />} label="Phones only" />
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">Handy for a long line: the full wording on desktop, a short one on phones.</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Pages</Typography>
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
                {PAGES.map((page) => {
                  const selected = (form.show_on ?? []).includes(page.value)
                  return (
                    <Chip
                      key={page.value}
                      label={page.label}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      icon={selected ? <CheckIcon /> : undefined}
                      aria-pressed={selected}
                      onClick={() => set('show_on', selected ? (form.show_on ?? []).filter((value) => value !== page.value) : [...(form.show_on ?? []), page.value])}
                    />
                  )
                })}
              </Stack>
              <Typography variant="caption" color="text.secondary">{(form.show_on ?? []).length ? 'Only on the pages chosen.' : 'None chosen: every page.'}</Typography>
            </Box>
            <FormControl size="small" sx={{ maxWidth: 320 }}>
              <InputLabel id="announcement-audience-label">Who sees it</InputLabel>
              <Select labelId="announcement-audience-label" label="Who sees it" value={form.audience ?? 'all'} onChange={(event) => set('audience', event.target.value as AnnouncementInput['audience'])}>
                <MenuItem value="all">Everyone</MenuItem>
                <MenuItem value="guests">Guests — not signed in</MenuItem>
                <MenuItem value="customers">Signed-in customers</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={countries.map((option) => option.code)}
              value={form.countries ?? []}
              onChange={(_event, next) => set('countries', next)}
              getOptionLabel={(code) => `${countryName(code)} (${code})`}
              renderValue={(selected, getItemProps) => selected.map((code, index) => <Chip {...getItemProps({ index })} key={code} size="small" label={countryName(code)} />)}
              renderInput={(params) => <TextField {...params} label="Countries" helperText="The country the shopper is buying in. None: everywhere." />}
            />
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!valid || saving} data-line-save>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
