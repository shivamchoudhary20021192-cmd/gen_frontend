import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CodeIcon from '@mui/icons-material/Code'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { api, tokenStore } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { UpgradeNotice } from '../../../components/UpgradeNotice'
import { useFlash } from '../../../hooks/useFlash'
import { useGoogleFonts } from '../../../hooks/useGoogleFonts'
import { errorMessage, isPlanError } from '../../../lib/errors'
import { formatDate, formatMoneyIn, formatRelative } from '../../../lib/format'
import { ThemeArt } from './ThemeArt'
import { screenshotOf } from './themeScreenshots'
import { themeKeys, type InstalledTheme, type LibraryTheme, type PreviewUrls, type ThemeDetail, type ThemePreset } from './themeTypes'

/**
 * Online Store → Themes, as in Shopify: the live theme, the themes added and
 * waiting in the library, and the theme store. Customising, previewing and
 * editing code never touch the live store until a theme is published.
 */

const API_BASE = `${(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')}/admin/api/v1`

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.access
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`)
  }
  return response
}

async function downloadTheme(theme: InstalledTheme) {
  const response = await authed(`/themes/${theme.id}/download`)
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${theme.name}.zip`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function ThemesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('themes.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [menu, setMenu] = useState<{ anchor: HTMLElement; theme: InstalledTheme } | null>(null)
  const [renaming, setRenaming] = useState<InstalledTheme | null>(null)
  const [deleting, setDeleting] = useState<InstalledTheme | null>(null)
  const [publishing, setPublishing] = useState<InstalledTheme | null>(null)
  const [viewing, setViewing] = useState<LibraryTheme | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const upload = useRef<HTMLInputElement | null>(null)
  const storeRef = useRef<HTMLDivElement | null>(null)

  const installed = useQuery({ queryKey: themeKeys.list, queryFn: () => api.get<{ themes: InstalledTheme[] }>('/themes') })
  const library = useQuery({ queryKey: themeKeys.library, queryFn: () => api.get<{ themes: LibraryTheme[] }>('/themes/library'), staleTime: 10 * 60_000 })
  const list = installed.data?.themes ?? []
  const live = list.find((theme) => theme.role === 'main')
  const others = list.filter((theme) => theme.role !== 'main')
  const livePreview = useQuery({
    queryKey: ['themes', 'preview', live?.id],
    queryFn: () => api.get<{ preview: PreviewUrls }>(`/themes/${live!.id}/preview`),
    enabled: Boolean(live),
    staleTime: 10 * 60_000,
  })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: themeKeys.all })
  const onError = (caught: unknown) => {
    if (isPlanError(caught)) setPlanError(errorMessage(caught))
    else flashError(errorMessage(caught))
  }

  const action = useMutation({
    mutationFn: ({ theme, kind }: { theme: InstalledTheme; kind: 'publish' | 'upgrade' | 'duplicate' }) =>
      api.post<ThemeDetail>(`/themes/${theme.id}/${kind}`, kind === 'duplicate' ? { name: `Copy of ${theme.name}` } : undefined),
    onSuccess: (result, { theme, kind }) => {
      setPublishing(null)
      success(
        kind === 'publish'
          ? `${theme.name} is now live`
          : kind === 'upgrade'
            ? `${result.theme.name} added with your customisations — publish it when you're happy`
            : `${theme.name} duplicated`,
      )
      refresh()
    },
    onError,
  })
  const rename = useMutation({
    mutationFn: ({ theme, name }: { theme: InstalledTheme; name: string }) => api.patch(`/themes/${theme.id}`, { name }),
    onSuccess: () => {
      setRenaming(null)
      refresh()
    },
    onError,
  })
  const remove = useMutation({
    mutationFn: (theme: InstalledTheme) => api.delete(`/themes/${theme.id}`),
    onSuccess: (_result, theme) => {
      setDeleting(null)
      success(`${theme.name} deleted`)
      refresh()
    },
    onError,
  })
  const install = useMutation({
    mutationFn: ({ theme, preset }: { theme: LibraryTheme; preset: string | null }) => api.post<ThemeDetail>('/themes', { handle: theme.handle, preset }),
    onSuccess: (result) => {
      setViewing(null)
      success(`${result.theme.name} added to your theme library`)
      refresh()
    },
    onError: (caught) => {
      setViewing(null)
      onError(caught)
    },
  })
  const uploadZip = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const response = await authed('/themes/upload', { method: 'POST', body: form })
      return (await response.json()) as ThemeDetail
    },
    onSuccess: (result) => {
      success(`${result.theme.name} uploaded to your theme library`)
      refresh()
    },
    onError: (caught) => flashError(caught instanceof Error ? caught.message : errorMessage(caught)),
  })

  const themes = useMemo(() => library.data?.themes ?? [], [library.data])
  const industries = useMemo(() => [...new Set(themes.flatMap((theme) => theme.industries))].sort(), [themes])
  const shown = industry ? themes.filter((theme) => theme.industries.includes(industry)) : themes
  useGoogleFonts([...new Set(themes.flatMap((theme) => theme.presets.slice(0, 1).map((preset) => String((preset.style ?? preset.settings).font_heading ?? ''))))].filter(Boolean))

  const libraryFor = (theme: InstalledTheme) => themes.find((candidate) => candidate.handle === theme.theme)

  return (
    <>
      <PageHeader
        title="Themes"
        actions={
          livePreview.data && (
            <Button variant="outlined" endIcon={<OpenInNewIcon />} href={livePreview.data.preview.origin} target="_blank" rel="noopener">
              View your store
            </Button>
          )
        }
      />
      {planError && <UpgradeNotice message={planError} />}
      {installed.isError && <Alert severity="error">{errorMessage(installed.error)}</Alert>}

      {live && (
        <Card sx={{ mb: 2, overflow: 'hidden' }}>
          <Grid container>
            <Grid size={{ xs: 12, md: 6 }}>
              <LivePreview url={livePreview.data?.preview.preview_url ?? null} fallback={<ThemeArt name={live.theme_name} preset={libraryFor(live)?.presets.find((preset) => preset.key === live.preset) ?? libraryFor(live)?.presets[0]} height={260} />} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <Chip size="small" label="Current theme" color="success" />
                  {live.update_available && <Chip size="small" label={`Update available · ${live.latest_version}`} color="info" variant="outlined" />}
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {live.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {live.theme_name} {live.version}
                  {live.preset ? ` · ${live.preset} style` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Last saved {formatRelative(live.updated_at)}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                  <Button variant="contained" component={RouterLink} to={`/merchandising/themes/${live.id}`}>
                    Customize
                  </Button>
                  {canManage && live.update_available && (
                    <Button variant="outlined" startIcon={<SystemUpdateAltIcon />} onClick={() => action.mutate({ theme: live, kind: 'upgrade' })} disabled={action.isPending}>
                      Update theme
                    </Button>
                  )}
                  <IconButton onClick={(event) => setMenu({ anchor: event.currentTarget, theme: live })} aria-label="More actions">
                    <MoreHorizIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Grid>
          </Grid>
        </Card>
      )}

      <SectionCard
        title="Theme library"
        description="Themes you have added. Customize and preview them before you publish."
        flush={others.length > 0}
        actions={
          canManage && (
            <>
              <Button size="small" variant="outlined" onClick={(event) => setAddMenu(event.currentTarget)}>
                Add theme
              </Button>
              <Menu anchorEl={addMenu} open={Boolean(addMenu)} onClose={() => setAddMenu(null)}>
                <MenuItem onClick={() => { setAddMenu(null); storeRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>Explore free themes</MenuItem>
                <MenuItem onClick={() => { setAddMenu(null); upload.current?.click() }}>
                  <ListItemIcon>
                    <UploadFileIcon fontSize="small" />
                  </ListItemIcon>
                  Upload zip file
                </MenuItem>
              </Menu>
              <input
                ref={upload}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) uploadZip.mutate(file)
                  event.target.value = ''
                }}
              />
            </>
          )
        }
      >
        {uploadZip.isPending && <LinearProgress sx={{ mb: 1 }} />}
        {others.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Only your current theme is installed. Add a theme from the store below to try a new look without changing your live store.
          </Typography>
        ) : (
          <Box>
            {others.map((theme, index) => {
              const source = libraryFor(theme)
              return (
                <Box key={theme.id}>
                  {index > 0 && <Divider />}
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center', px: 2, py: 1.5 }}>
                    <Box sx={{ width: 96, flexShrink: 0, borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
                      <ThemeArt name={theme.theme_name} preset={source?.presets.find((preset) => preset.key === theme.preset) ?? source?.presets[0]} height={60} compact />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {theme.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {theme.theme_name} {theme.version} · {theme.source === 'upload' ? 'uploaded' : theme.source === 'duplicate' ? 'copied' : 'added'} {formatDate(theme.created_at)} · saved {formatRelative(theme.updated_at)}
                      </Typography>
                      {theme.update_available && <Chip size="small" label={`Update ${theme.latest_version}`} color="info" variant="outlined" sx={{ ml: 1, height: 20 }} />}
                    </Box>
                    {canManage && (
                      <Button size="small" onClick={() => setPublishing(theme)}>
                        Publish
                      </Button>
                    )}
                    <Button size="small" variant="outlined" onClick={() => navigate(`/merchandising/themes/${theme.id}`)}>
                      Customize
                    </Button>
                    <IconButton size="small" onClick={(event) => setMenu({ anchor: event.currentTarget, theme })} aria-label="More actions">
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              )
            })}
          </Box>
        )}
      </SectionCard>

      <Box ref={storeRef} sx={{ mt: 4, mb: 1.5 }}>
        <Typography variant="h6">Free themes</Typography>
        <Typography variant="body2" color="text.secondary">
          Made by Veylog, with every feature a modern store needs. Each comes in several styles, and every section can be moved, hidden and restyled.
        </Typography>
        {industries.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Chip label="All" color={industry === null ? 'primary' : 'default'} variant={industry === null ? 'filled' : 'outlined'} onClick={() => setIndustry(null)} />
            {industries.map((name) => (
              <Chip key={name} label={name} color={industry === name ? 'primary' : 'default'} variant={industry === name ? 'filled' : 'outlined'} onClick={() => setIndustry(name)} />
            ))}
          </Stack>
        )}
      </Box>
      <Grid container spacing={2}>
        {shown.map((theme) => (
          <Grid key={theme.handle} size={{ xs: 12, sm: 6, lg: 4 }}>
            <StoreCard theme={theme} installed={list.some((item) => item.theme === theme.handle)} onOpen={() => setViewing(theme)} />
          </Grid>
        ))}
      </Grid>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu && [
          <MenuItem key="preview" onClick={() => { const theme = menu.theme; setMenu(null); void api.get<{ preview: PreviewUrls }>(`/themes/${theme.id}/preview`).then((result) => window.open(result.preview.preview_url, '_blank', 'noopener')) }}>
            <ListItemIcon><VisibilityOutlinedIcon fontSize="small" /></ListItemIcon>
            Preview
          </MenuItem>,
          canManage ? (
            <MenuItem key="rename" onClick={() => { setRenaming(menu.theme); setMenu(null) }}>
              <ListItemIcon><DriveFileRenameOutlineIcon fontSize="small" /></ListItemIcon>
              Rename
            </MenuItem>
          ) : null,
          canManage ? (
            <MenuItem key="duplicate" onClick={() => { action.mutate({ theme: menu.theme, kind: 'duplicate' }); setMenu(null) }}>
              <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
              Duplicate
            </MenuItem>
          ) : null,
          <MenuItem key="download" onClick={() => { const theme = menu.theme; setMenu(null); downloadTheme(theme).then(() => success('Theme file downloaded'), (caught) => flashError(String(caught instanceof Error ? caught.message : caught))) }}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
            Download theme file
          </MenuItem>,
          <MenuItem key="code" component={RouterLink} to={`/merchandising/themes/${menu.theme.id}/code`} onClick={() => setMenu(null)}>
            <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
            Edit code
          </MenuItem>,
          canManage && menu.theme.update_available && menu.theme.role !== 'main' ? (
            <MenuItem key="upgrade" onClick={() => { action.mutate({ theme: menu.theme, kind: 'upgrade' }); setMenu(null) }}>
              <ListItemIcon><SystemUpdateAltIcon fontSize="small" /></ListItemIcon>
              Update to {menu.theme.latest_version}
            </MenuItem>
          ) : null,
          canManage && menu.theme.role !== 'main' ? (
            <MenuItem key="delete" sx={{ color: 'error.main' }} onClick={() => { setDeleting(menu.theme); setMenu(null) }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
              Delete
            </MenuItem>
          ) : null,
        ]}
      </Menu>

      {renaming && <RenameDialog theme={renaming} busy={rename.isPending} onClose={() => setRenaming(null)} onSave={(name) => rename.mutate({ theme: renaming, name })} />}
      {viewing && <ThemeStoreDialog theme={viewing} canAdd={canManage} busy={install.isPending} onClose={() => setViewing(null)} onAdd={(preset) => install.mutate({ theme: viewing, preset })} />}

      <ConfirmDialog
        open={Boolean(publishing)}
        title={`Publish ${publishing?.name ?? ''}?`}
        body={`It replaces ${live?.name ?? 'your current theme'} as the theme shoppers see. ${live?.name ?? 'The current theme'} moves to your theme library, so you can switch back at any time.`}
        confirmLabel="Publish"
        busy={action.isPending}
        onConfirm={() => publishing && action.mutate({ theme: publishing, kind: 'publish' })}
        onClose={() => setPublishing(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="The theme and its customisations are removed. Download the theme file first if you might want it back."
        confirmLabel="Delete theme"
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

/** The live store, rendered small: what shoppers see right now. */
function LivePreview({ url, fallback }: { url: string | null; fallback: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  if (!url) return <>{fallback}</>
  const scale = 0.4
  return (
    <Box sx={{ position: 'relative', height: 300, overflow: 'hidden', bgcolor: 'grey.100', borderRight: { md: 1 }, borderColor: 'divider' }}>
      {!loaded && <Box sx={{ position: 'absolute', inset: 0 }}>{fallback}</Box>}
      <iframe
        title="Your store"
        src={url}
        loading="lazy"
        tabIndex={-1}
        onLoad={() => setLoaded(true)}
        style={{ border: 0, width: `${100 / scale}%`, height: `${300 / scale}px`, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none', opacity: loaded ? 1 : 0, transition: 'opacity .3s' }}
      />
    </Box>
  )
}

function StoreCard({ theme, installed, onOpen }: { theme: LibraryTheme; installed: boolean; onOpen(): void }) {
  const [preset, setPreset] = useState<ThemePreset | undefined>(theme.presets[0])
  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow .2s', '&:hover': { boxShadow: 3 } }}>
      <Box onClick={onOpen} sx={{ cursor: 'pointer' }}>
        <ThemeArt name={theme.name} image={theme.preview_image_url} screenshot={screenshotOf(theme, preset?.key)} preset={preset} height={190} />
      </Box>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, cursor: 'pointer' }} onClick={onOpen}>
            {theme.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {theme.price.amount === 0 ? 'Free' : formatMoneyIn(theme.price.amount, theme.price.currency)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {theme.presets.map((option) => (
            <Box
              key={option.key}
              role="button"
              tabIndex={0}
              aria-label={`${option.name} style`}
              title={option.name}
              onClick={() => setPreset(option)}
              onKeyDown={(event) => event.key === 'Enter' && setPreset(option)}
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                cursor: 'pointer',
                border: 2,
                borderColor: preset?.key === option.key ? 'text.primary' : 'transparent',
                boxShadow: '0 0 0 1px rgba(0,0,0,.12) inset',
                background: `linear-gradient(135deg, ${String((option.style ?? option.settings).color_background ?? '#fff')} 50%, ${String((option.style ?? option.settings).color_accent ?? '#111')} 50%)`,
              }}
            />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {preset?.name}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {theme.description}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {theme.recommended && <Chip size="small" label="Suits your store" color="primary" variant="outlined" />}
          {installed && <Chip size="small" label="In your library" icon={<CheckIcon />} variant="outlined" />}
          {theme.industries.slice(0, 2).map((name) => (
            <Chip key={name} size="small" label={name} variant="outlined" />
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

/** A theme store listing: what it is for, what it can do, its styles. */
function ThemeStoreDialog({ theme, canAdd, busy, onClose, onAdd }: { theme: LibraryTheme; canAdd: boolean; busy: boolean; onClose(): void; onAdd(preset: string | null): void }) {
  const [preset, setPreset] = useState<string | null>(theme.presets[0]?.key ?? null)
  const chosen = theme.presets.find((option) => option.key === preset)
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        {theme.name}
        <Typography variant="body2" color="text.secondary">
          by {theme.author} · version {theme.version} · {theme.price.amount === 0 ? 'Free' : formatMoneyIn(theme.price.amount, theme.price.currency)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ position: 'relative', pb: screenshotOf(theme, preset, 'mobile') ? 3 : 0 }}>
              <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
                <ThemeArt name={theme.name} image={theme.preview_image_url} screenshot={screenshotOf(theme, preset)} preset={chosen} height={300} />
              </Box>
              {screenshotOf(theme, preset, 'mobile') && (
                // The same style on a phone, as the theme store shows it.
                <Box sx={{ position: 'absolute', right: 16, bottom: 0, width: 96, height: 192, borderRadius: 2.5, overflow: 'hidden', border: '4px solid', borderColor: 'grey.900', boxShadow: 6, bgcolor: 'common.white' }}>
                  <Box component="img" src={screenshotOf(theme, preset, 'mobile')!} alt={`${theme.name} on a phone`} sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </Box>
              )}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>
              {theme.description}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            {theme.presets.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Styles
                </Typography>
                <Stack spacing={1} sx={{ mb: 2.5 }}>
                  {theme.presets.map((option) => {
                    const style = option.style ?? option.settings
                    const colors = ['color_background', 'color_cream', 'color_text', 'color_accent'].map((key) => String(style[key] ?? '#ffffff'))
                    return (
                      <Card
                        key={option.key}
                        variant="outlined"
                        onClick={() => setPreset(option.key)}
                        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderColor: preset === option.key ? 'primary.main' : undefined, borderWidth: preset === option.key ? 2 : 1 }}
                      >
                        <Stack direction="row" sx={{ borderRadius: 0.75, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
                          {colors.map((color, index) => (
                            <Box key={index} sx={{ width: 18, height: 26, bgcolor: color }} />
                          ))}
                        </Stack>
                        <Typography variant="body2" sx={{ fontFamily: style.font_heading ? `"${String(style.font_heading)}", serif` : undefined, fontWeight: 600 }}>
                          {option.name}
                        </Typography>
                      </Card>
                    )
                  })}
                </Stack>
              </>
            )}
            <Typography variant="subtitle2" gutterBottom>
              Made for
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {theme.industries.map((name) => (
                <Chip key={name} size="small" label={name} />
              ))}
            </Stack>
            <Typography variant="subtitle2" gutterBottom>
              Features
            </Typography>
            <Stack spacing={0.5}>
              {theme.features.map((feature) => (
                <Stack key={feature} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <Typography variant="body2">{feature}</Typography>
                </Stack>
              ))}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2">{theme.section_count} sections, all editable in the theme editor</Typography>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        {canAdd && (
          <Button variant="contained" disabled={busy} onClick={() => onAdd(preset)}>
            {busy ? 'Adding…' : `Add ${chosen ? `${chosen.name} style` : 'theme'} to library`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

function RenameDialog({ theme, busy, onClose, onSave }: { theme: InstalledTheme; busy: boolean; onClose(): void; onSave(name: string): void }) {
  const [name, setName] = useState(theme.name)
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rename theme</DialogTitle>
      <DialogContent>
        <TextField value={name} onChange={(event) => setName(event.target.value)} label="Name" fullWidth autoFocus sx={{ mt: 1 }} slotProps={{ htmlInput: { maxLength: 120 } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !name.trim()} onClick={() => onSave(name.trim())}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
