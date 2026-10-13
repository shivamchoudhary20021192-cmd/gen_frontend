import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ArrowDownward as DownIcon,
  ArrowUpward as UpIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Laptop as DesktopIcon,
  PhoneIphone as PhoneIcon,
} from '@mui/icons-material'
import { errorMessage } from '../../../lib/errors'
import { tokens } from '../../../theme'
import { AnnouncementPreview } from './AnnouncementPreview'
import { ColorField } from './ColorField'
import { LineDialog } from './LineDialog'
import { formFor, payloadFor } from './lineForm'
import {
  useAnnouncementBar,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useReorderAnnouncements,
  useUpdateAnnouncement,
  useUpdateAnnouncementSettings,
  type Announcement,
  type AnnouncementInput,
  type AnnouncementSettings,
  type DeviceChoice,
} from './useAnnouncements'

/**
 * Content → Announcement bar: the strip above the header, and the lines in it.
 *
 * One screen: the bar as shoppers will see it (desktop or phone), how it
 * behaves and looks, and the lines — each with its own colours, schedule,
 * countdown, code and the pages, shoppers and countries it is for. The
 * settings are a draft until saved, and the preview follows the draft.
 */

const DEVICE_CHOICES: { value: DeviceChoice; label: string }[] = [
  { value: 'all', label: 'Desktop and phones' },
  { value: 'desktop', label: 'Desktop only' },
  { value: 'mobile', label: 'Phones only' },
  { value: 'none', label: 'Hidden' },
]

const TRANSITIONS: { value: AnnouncementSettings['transition']; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide across (smooth scroll)' },
  { value: 'slide_up', label: 'Slide up' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'none', label: 'None — switch instantly' },
]

const PAGE_LABELS: Record<string, string> = {
  index: 'Home', product: 'Products', collection: 'Collections', 'list-collections': 'All collections', cart: 'Cart',
  search: 'Search', page: 'Pages', blog: 'Blogs', article: 'Blog posts', policy: 'Policies',
}

export function AnnouncementsPage() {
  const { data, isLoading, isError, error } = useAnnouncementBar()
  if (isLoading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><CircularProgress /></Box>
  }
  if (isError || !data) return <Alert severity="error">{errorMessage(error)}</Alert>
  return <AnnouncementBarEditor announcements={data.announcements} saved={data.settings} />
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" sx={{ color: tokens.subdued, letterSpacing: '0.08em' }}>{title}</Typography>
      <Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack>
    </Box>
  )
}

function AnnouncementBarEditor({ announcements, saved }: { announcements: Announcement[]; saved: AnnouncementSettings }) {
  const create = useCreateAnnouncement()
  const update = useUpdateAnnouncement()
  const remove = useDeleteAnnouncement()
  const reorder = useReorderAnnouncements()
  const saveSettings = useUpdateAnnouncementSettings()

  const [draft, setDraft] = useState<AnnouncementSettings>(saved)
  const [baseline, setBaseline] = useState<AnnouncementSettings>(saved)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)
  const [form, setForm] = useState<AnnouncementInput>(formFor('new'))
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  const set = <K extends keyof AnnouncementSettings>(key: K, value: AnnouncementSettings[K]) => setDraft({ ...draft, [key]: value })

  const open = (target: Announcement | 'new') => {
    setEditing(target)
    setForm(formFor(target))
  }
  const saveLine = async () => {
    const payload = payloadFor(form)
    if (editing === 'new') await create.mutateAsync(payload)
    else if (editing) await update.mutateAsync({ id: editing.id, input: payload })
    setEditing(null)
  }
  const move = async (index: number, delta: number) => {
    const next = [...announcements]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await reorder.mutateAsync(next.map((item) => item.id))
  }
  const saveBar = async () => {
    await saveSettings.mutateAsync(draft)
    setBaseline(draft)
  }

  const live = announcements.filter((item) => !item.hidden_because).length

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>Announcement bar</Typography>
          <Typography variant="body2" sx={{ color: tokens.subdued, mt: 0.5 }}>
            The strip above the header: rotating lines or a scrolling ticker, with codes, countdowns and a free-shipping line — each line for the pages, shoppers and devices you choose.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => open('new')} sx={{ flexShrink: 0, whiteSpace: 'nowrap', ml: 2 }}>Add a line</Button>
      </Stack>

      {/* ── the bar as shoppers see it ───────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Preview</Typography>
              <Typography variant="body2" sx={{ color: tokens.subdued }}>
                {live} live line{live === 1 ? '' : 's'}, all shown here — a line for particular pages, shoppers or countries shows only there{dirty ? ' · with your unsaved settings' : ''}
              </Typography>
            </Box>
            <ToggleButtonGroup size="small" exclusive value={device} onChange={(_event, next) => next && setDevice(next)}>
              <ToggleButton value="desktop" aria-label="Desktop preview"><DesktopIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="mobile" aria-label="Phone preview"><PhoneIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box sx={{ bgcolor: tokens.rail, p: 2, borderRadius: 2, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ width: device === 'mobile' ? 390 : '100%', maxWidth: '100%', bgcolor: '#fff', boxShadow: 1, borderRadius: 1, overflow: 'hidden', transition: 'width 0.2s' }}>
              <AnnouncementPreview settings={draft} lines={announcements} device={device} />
              <Box sx={{ height: 44, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2, gap: 2 }}>
                <Box sx={{ width: 64, height: 10, borderRadius: 1, bgcolor: 'grey.300' }} />
                <Box sx={{ flex: 1 }} />
                <Box sx={{ width: 120, height: 8, borderRadius: 1, bgcolor: 'grey.200' }} />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── how the bar behaves and looks ────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>How the bar behaves and looks</Typography>
              <Typography variant="body2" sx={{ color: tokens.subdued }}>For the whole bar. Lines can override colours and devices.</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button disabled={!dirty || saveSettings.isPending} onClick={() => setDraft(baseline)}>Discard</Button>
              <Button variant="contained" disabled={!dirty || saveSettings.isPending} onClick={() => void saveBar()} data-save-bar>
                {saveSettings.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          </Stack>
          {saveSettings.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(saveSettings.error)}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
            <Section title="Showing">
              <FormControlLabel control={<Switch checked={draft.is_enabled} onChange={(event) => set('is_enabled', event.target.checked)} />} label="Show the bar" />
              <TextField select size="small" label="On" value={draft.bar_visibility} onChange={(event) => set('bar_visibility', event.target.value as AnnouncementSettings['bar_visibility'])}>
                <MenuItem value="all">Desktop and phones</MenuItem>
                <MenuItem value="desktop">Desktop only</MenuItem>
                <MenuItem value="mobile">Phones only</MenuItem>
              </TextField>
            </Section>

            <Section title="Motion">
              <ToggleButtonGroup exclusive size="small" value={draft.display_mode} onChange={(_event, next) => next && set('display_mode', next)}>
                <ToggleButton value="rotate" data-mode-rotate>Rotating lines</ToggleButton>
                <ToggleButton value="marquee" data-mode-marquee>Scrolling ticker</ToggleButton>
              </ToggleButtonGroup>
              {draft.display_mode === 'rotate' ? (
                <>
                  <TextField select size="small" label="How a line changes" value={draft.transition} onChange={(event) => set('transition', event.target.value as AnnouncementSettings['transition'])} data-transition>
                    {TRANSITIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                  </TextField>
                  <FormControlLabel control={<Switch checked={draft.autoplay} onChange={(event) => set('autoplay', event.target.checked)} />} label="Move on by itself" />
                  <Box sx={{ opacity: draft.autoplay ? 1 : 0.5 }}>
                    <Typography variant="body2">Each line shows for <strong>{draft.rotation_seconds} seconds</strong></Typography>
                    <Slider
                      value={draft.rotation_seconds}
                      disabled={!draft.autoplay}
                      min={3}
                      max={30}
                      step={1}
                      marks={[{ value: 3, label: '3s' }, { value: 5, label: '5s' }, { value: 10, label: '10s' }, { value: 30, label: '30s' }]}
                      onChange={(_event, value) => set('rotation_seconds', value as number)}
                      aria-label="Seconds per line"
                    />
                  </Box>
                </>
              ) : (
                <>
                  <Box>
                    <Typography variant="body2">Speed: <strong>{draft.marquee_speed} px/s</strong> {draft.marquee_speed <= 40 ? '(calm)' : draft.marquee_speed >= 120 ? '(fast)' : ''}</Typography>
                    <Slider value={draft.marquee_speed} min={10} max={300} step={5} onChange={(_event, value) => set('marquee_speed', value as number)} aria-label="Ticker speed" />
                  </Box>
                  <Stack direction="row" spacing={2}>
                    <TextField select size="small" label="Direction" value={draft.marquee_direction} onChange={(event) => set('marquee_direction', event.target.value as AnnouncementSettings['marquee_direction'])} sx={{ flex: 1 }}>
                      <MenuItem value="left">Right to left</MenuItem>
                      <MenuItem value="right">Left to right</MenuItem>
                    </TextField>
                    <TextField size="small" label="Between lines" value={draft.marquee_separator} onChange={(event) => set('marquee_separator', event.target.value.slice(0, 8))} sx={{ width: 140 }} helperText="• ✦ | ★ ·" />
                  </Stack>
                </>
              )}
              <FormControlLabel control={<Switch checked={draft.pause_on_hover} onChange={(event) => set('pause_on_hover', event.target.checked)} />} label="Pause while the pointer is over it" />
              <Typography variant="caption" color="text.secondary">Moving bars always get a pause button, and stop for shoppers who ask their device for less motion.</Typography>
            </Section>

            <Section title="Size">
              <RadioGroup value={draft.height_mode} onChange={(event) => set('height_mode', event.target.value as AnnouncementSettings['height_mode'])}>
                <FormControlLabel value="uniform" control={<Radio />} label={<span>Same height for every line <Typography component="span" variant="body2" color="text.secondary">— as tall as the longest; the page never jumps</Typography></span>} />
                <FormControlLabel value="fixed" control={<Radio />} label={<span>Fixed height <Typography component="span" variant="body2" color="text.secondary">— always this size; longer lines are shortened to fit</Typography></span>} data-height-fixed />
                <FormControlLabel value="auto" control={<Radio />} label={<span>Fit each line <Typography component="span" variant="body2" color="text.secondary">— grows and shrinks with the line</Typography></span>} />
              </RadioGroup>
              {draft.height_mode === 'fixed' && (
                <Stack direction="row" spacing={2}>
                  <TextField size="small" type="number" label="Desktop" value={draft.fixed_height_desktop} onChange={(event) => set('fixed_height_desktop', Math.max(24, Math.min(160, Number(event.target.value) || 40)))} slotProps={{ input: { endAdornment: <InputAdornment position="end">px</InputAdornment> } }} />
                  <TextField size="small" type="number" label="Phones" value={draft.fixed_height_mobile} onChange={(event) => set('fixed_height_mobile', Math.max(24, Math.min(160, Number(event.target.value) || 44)))} slotProps={{ input: { endAdornment: <InputAdornment position="end">px</InputAdornment> } }} />
                  <TextField size="small" select label="Text lines" value={draft.max_lines} onChange={(event) => set('max_lines', Number(event.target.value))} sx={{ minWidth: 110 }}>
                    {[1, 2, 3].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                  </TextField>
                </Stack>
              )}
              <Stack direction="row" spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">Text on desktop: <strong>{draft.font_size_desktop}px</strong></Typography>
                  <Slider value={draft.font_size_desktop} min={10} max={24} step={1} onChange={(_event, value) => set('font_size_desktop', value as number)} aria-label="Desktop text size" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">Text on phones: <strong>{draft.font_size_mobile}px</strong></Typography>
                  <Slider value={draft.font_size_mobile} min={10} max={22} step={1} onChange={(_event, value) => set('font_size_mobile', value as number)} aria-label="Phone text size" />
                </Box>
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField select size="small" label="Weight" value={draft.font_weight} onChange={(event) => set('font_weight', event.target.value as AnnouncementSettings['font_weight'])} sx={{ flex: 1 }}>
                  <MenuItem value="regular">Regular</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                </TextField>
                <TextField select size="small" label="Alignment" value={draft.text_align} onChange={(event) => set('text_align', event.target.value as AnnouncementSettings['text_align'])} sx={{ flex: 1 }}>
                  <MenuItem value="center">Centred</MenuItem>
                  <MenuItem value="left">Left</MenuItem>
                </TextField>
              </Stack>
              <FormControlLabel control={<Switch checked={draft.text_transform === 'uppercase'} onChange={(event) => set('text_transform', event.target.checked ? 'uppercase' : 'none')} />} label="Capital letters" />
            </Section>

            <Section title="Colours">
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.background_hex !== null || draft.text_hex !== null}
                    onChange={(event) => setDraft({ ...draft, background_hex: event.target.checked ? '#1a1a1a' : null, text_hex: event.target.checked ? '#ffffff' : null, background_gradient_hex: null })}
                    data-custom-colours
                  />
                }
                label="Choose the bar’s colours"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>Off: the theme’s colour scheme for the bar (Online Store → Customize).</Typography>
              {(draft.background_hex !== null || draft.text_hex !== null) && (
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <ColorField label="Background" value={draft.background_hex ?? '#1a1a1a'} onChange={(value) => set('background_hex', value)} />
                  <ColorField label="Text" value={draft.text_hex ?? '#ffffff'} onChange={(value) => set('text_hex', value)} />
                  <FormControlLabel control={<Switch size="small" checked={draft.background_gradient_hex !== null} onChange={(event) => set('background_gradient_hex', event.target.checked ? '#7a1f3d' : null)} />} label="Gradient" />
                  {draft.background_gradient_hex !== null && (
                    <ColorField label="Blends into" value={draft.background_gradient_hex} onChange={(value) => set('background_gradient_hex', value)} />
                  )}
                </Stack>
              )}
            </Section>

            <Section title="Arrows and closing">
              <FormControl size="small">
                <InputLabel id="bar-arrows-label">Previous / next arrows</InputLabel>
                <Select labelId="bar-arrows-label" label="Previous / next arrows" value={draft.arrows_visibility} disabled={draft.display_mode === 'marquee'} onChange={(event) => set('arrows_visibility', event.target.value as DeviceChoice)} data-arrows>
                  {DEVICE_CHOICES.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel id="bar-link-arrow-label">Arrow after a link</InputLabel>
                <Select labelId="bar-link-arrow-label" label="Arrow after a link" value={draft.link_arrow_visibility} onChange={(event) => set('link_arrow_visibility', event.target.value as DeviceChoice)} data-link-arrow>
                  {DEVICE_CHOICES.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControlLabel control={<Switch checked={draft.is_dismissible} onChange={(event) => set('is_dismissible', event.target.checked)} />} label="Let shoppers close it" />
              {draft.is_dismissible && (
                <TextField
                  size="small"
                  type="number"
                  label="Stays closed for"
                  value={draft.dismiss_days}
                  onChange={(event) => set('dismiss_days', Math.max(0, Math.min(365, Number(event.target.value) || 0)))}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }}
                  helperText="0: until they close the browser. New lines always show again."
                  sx={{ maxWidth: 260 }}
                />
              )}
            </Section>
          </Box>
        </CardContent>
      </Card>

      {/* ── the lines ─────────────────────────────────────────────────────── */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="subtitle1">Nothing in the bar yet</Typography>
            <Typography variant="body2" sx={{ color: tokens.subdued, mt: 1, mb: 3 }}>
              Until there is, the storefront shows the theme’s own lines.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => open('new')}>Write the first one</Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {announcements.map((item, index) => {
            const ctr = item.stats.views ? Math.round((item.stats.clicks / item.stats.views) * 1000) / 10 : null
            return (
              <Card key={item.id} data-announcement-row={item.id}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <Stack sx={{ flexShrink: 0 }}>
                    <IconButton size="small" disabled={index === 0} onClick={() => void move(index, -1)} aria-label={`Move "${item.message}" up`}><UpIcon fontSize="small" /></IconButton>
                    <IconButton size="small" disabled={index === announcements.length - 1} onClick={() => void move(index, 1)} aria-label={`Move "${item.message}" down`}><DownIcon fontSize="small" /></IconButton>
                  </Stack>
                  {(item.background_hex || item.text_hex) && (
                    <Box sx={{ width: 28, height: 28, borderRadius: 1, flexShrink: 0, bgcolor: item.background_hex ?? 'transparent', color: item.text_hex ?? 'inherit', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, border: 1, borderColor: 'divider' }}>Aa</Box>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{item.message}</Typography>
                    <Stack direction="row" sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.75 }}>
                      {item.kind === 'free_shipping' && <Chip size="small" color="info" label="Free-shipping progress" />}
                      {item.coupon && <Chip size="small" label={item.coupon.code ?? `Coupon ${item.coupon.id}`} color={item.coupon.live ? 'success' : 'default'} variant={item.coupon.live ? 'filled' : 'outlined'} />}
                      {item.link.type !== 'none' && <Chip size="small" variant="outlined" label={`→ ${item.link.label || 'Linked'}`} />}
                      {item.show_countdown && <Chip size="small" variant="outlined" label="Countdown" />}
                      {item.visibility !== 'all' && <Chip size="small" variant="outlined" label={item.visibility === 'desktop' ? 'Desktop only' : 'Phones only'} />}
                      {item.show_on.length > 0 && <Chip size="small" variant="outlined" label={item.show_on.map((page) => PAGE_LABELS[page] ?? page).join(', ')} />}
                      {item.audience !== 'all' && <Chip size="small" variant="outlined" label={item.audience === 'customers' ? 'Signed-in customers' : 'Guests'} />}
                      {item.countries.length > 0 && <Chip size="small" variant="outlined" label={item.countries.length > 3 ? `${item.countries.length} countries` : item.countries.join(', ')} />}
                      {(item.starts_at || item.ends_at) && (
                        <Chip size="small" variant="outlined" label={`${item.starts_at ? new Date(item.starts_at).toLocaleDateString() : 'now'} – ${item.ends_at ? new Date(item.ends_at).toLocaleDateString() : 'no end'}`} />
                      )}
                      {item.hidden_because ? <Chip size="small" color="warning" variant="outlined" label={item.hidden_because} /> : <Chip size="small" color="success" variant="outlined" label="Live" />}
                    </Stack>
                  </Box>
                  <Tooltip title="Last 30 days, from shoppers who allowed analytics">
                    <Box sx={{ textAlign: 'right', flexShrink: 0, minWidth: 110 }} data-line-stats>
                      <Typography variant="body2">{item.stats.views.toLocaleString()} views</Typography>
                      <Typography variant="caption" sx={{ color: tokens.subdued }}>{item.stats.clicks.toLocaleString()} clicks{ctr !== null ? ` · ${ctr}%` : ''}</Typography>
                    </Box>
                  </Tooltip>
                  <Stack direction="row" sx={{ flexShrink: 0 }}>
                    <Tooltip title={item.is_active ? 'Switch off' : 'Switch on'}>
                      <Switch checked={item.is_active} onChange={(event) => void update.mutateAsync({ id: item.id, input: { is_active: event.target.checked } })} slotProps={{ input: { 'aria-label': `Show "${item.message}"` } }} />
                    </Tooltip>
                    <IconButton onClick={() => open(item)} aria-label={`Edit "${item.message}"`}><EditIcon fontSize="small" /></IconButton>
                    <IconButton onClick={() => setConfirmDelete(item)} aria-label={`Delete "${item.message}"`}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}

      <LineDialog
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        open={editing !== null}
        title={editing === 'new' ? 'A new line' : 'Edit this line'}
        form={form}
        onChange={setForm}
        onClose={() => setEditing(null)}
        onSave={() => void saveLine().catch(() => undefined)}
        saving={create.isPending || update.isPending}
        error={create.isError ? errorMessage(create.error) : update.isError ? errorMessage(update.error) : null}
      />

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Remove this line?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">“{confirmDelete?.message}” comes off the storefront straight away.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (confirmDelete) await remove.mutateAsync(confirmDelete.id)
              setConfirmDelete(null)
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
