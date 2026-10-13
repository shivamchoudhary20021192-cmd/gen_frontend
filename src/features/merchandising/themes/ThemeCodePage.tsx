import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import HistoryIcon from '@mui/icons-material/History'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import SearchIcon from '@mui/icons-material/Search'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { api, ApiError } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { formatRelative } from '../../../lib/format'
import { CodeEditor } from './code/CodeEditor'
import { themeKeys, type FileVersion, type ThemeFile, type ThemeFileContent } from './themeTypes'

/**
 * Edit code: every file of a theme, as on Shopify. Saves are checked before
 * they land — Liquid must parse, JSON must be valid, templates may only use
 * sections that exist — and every save is kept as a version to go back to.
 */

const FOLDERS: { key: string; label: string }[] = [
  { key: 'layout', label: 'Layout' },
  { key: 'templates', label: 'Templates' },
  { key: 'sections', label: 'Sections' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'snippets', label: 'Snippets' },
  { key: 'assets', label: 'Assets' },
  { key: 'config', label: 'Config' },
  { key: 'locales', label: 'Locales' },
]

const TEXT = /\.(liquid|json|css|js|svg|txt|md)$/

interface OpenFile {
  path: string
  original: string
  content: string
  checksum: string | null
  url: string | null
  problems: string[]
}

function starterFor(path: string, files: Map<string, ThemeFile>): string {
  const name = path.split('/').pop()!.replace(/\.(liquid|json|css|js)$/, '')
  if (path.startsWith('sections/') && path.endsWith('.liquid')) {
    const title = name.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
    return `<div class="page-width">\n  <h2>{{ section.settings.heading | escape }}</h2>\n</div>\n\n{% schema %}\n${JSON.stringify(
      { name: title, tag: 'section', class: 'section', settings: [{ type: 'text', id: 'heading', label: 'Heading', default: title }], presets: [{ name: title }] },
      null,
      2,
    )}\n{% endschema %}\n`
  }
  if (path.startsWith('snippets/')) return `{%- comment -%}\n  ${name}\n{%- endcomment -%}\n`
  if (path.startsWith('locales/')) return '{}\n'
  if (path.startsWith('templates/') && path.endsWith('.json')) {
    const base = `templates/${name.split('.')[0]}.json`
    if (files.has(base)) return '' // filled from the default template when created
    return `${JSON.stringify({ sections: {}, order: [] }, null, 2)}\n`
  }
  return ''
}

export function ThemeCodePage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('themes.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<OpenFile[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [versionsFor, setVersionsFor] = useState<{ anchor: HTMLElement; path: string } | null>(null)
  const [viewingVersion, setViewingVersion] = useState<{ id: number; path: string; content: string | null; created_at: string } | null>(null)
  const [fileMenu, setFileMenu] = useState<HTMLElement | null>(null)

  const listing = useQuery({ queryKey: themeKeys.files(id), queryFn: () => api.get<{ theme: { id: string; name: string; role: string }; files: ThemeFile[] }>(`/themes/${id}/files`) })
  const files = useMemo(() => new Map((listing.data?.files ?? []).map((file) => [file.path, file])), [listing.data])
  const current = open.find((file) => file.path === active) ?? null
  const dirty = current ? current.content !== current.original : false

  const openFile = async (path: string) => {
    setActive(path)
    if (open.some((file) => file.path === path)) return
    try {
      const { file } = await queryClient.fetchQuery({ queryKey: themeKeys.file(id, path), queryFn: () => api.get<{ file: ThemeFileContent }>(`/themes/${id}/files/content`, { path }), staleTime: 0 })
      setOpen((list) => [...list.filter((item) => item.path !== path), { path, original: file.content ?? '', content: file.content ?? '', checksum: file.checksum, url: file.url, problems: [] }])
    } catch (caught) {
      flashError(errorMessage(caught))
    }
  }

  const update = (path: string, change: Partial<OpenFile>) => setOpen((list) => list.map((file) => (file.path === path ? { ...file, ...change } : file)))

  const save = useMutation({
    mutationFn: (file: OpenFile) => api.put<{ file: ThemeFileContent }>(`/themes/${id}/files`, { path: file.path, content: file.content, checksum: file.checksum }),
    onSuccess: (result, file) => {
      update(file.path, { original: file.content, checksum: result.file.checksum, problems: [] })
      void queryClient.invalidateQueries({ queryKey: themeKeys.files(id) })
      void queryClient.invalidateQueries({ queryKey: ['themes', 'editor', id] })
      success(`${file.path} saved`)
    },
    onError: (caught, file) => {
      if (caught instanceof ApiError && caught.status === 422) {
        const problems = (caught.details as { content?: string[] } | undefined)?.content ?? [caught.message]
        update(file.path, { problems })
        flashError('Not saved — fix the problems shown above the code.')
      } else if (caught instanceof ApiError && caught.code === 'STALE_FILE') {
        flashError(caught.message)
      } else flashError(errorMessage(caught))
    },
  })

  const create = useMutation({
    mutationFn: async (path: string) => {
      let content = starterFor(path, files)
      if (!content && path.startsWith('templates/')) {
        const base = `templates/${path.split('/').pop()!.split('.')[0]}.json`
        const result = await api.get<{ file: ThemeFileContent }>(`/themes/${id}/files/content`, { path: base })
        content = result.file.content ?? ''
      }
      return api.put<{ file: ThemeFileContent }>(`/themes/${id}/files`, { path, content })
    },
    onSuccess: (_result, path) => {
      setCreating(null)
      void queryClient.invalidateQueries({ queryKey: themeKeys.files(id) }).then(() => openFile(path))
      success(`${path} created`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => api.post(`/themes/${id}/files/rename`, { from, to }),
    onSuccess: (_result, { from, to }) => {
      setRenaming(null)
      setOpen((list) => list.map((file) => (file.path === from ? { ...file, path: to } : file)))
      if (active === from) setActive(to)
      void queryClient.invalidateQueries({ queryKey: themeKeys.files(id) })
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (path: string) => api.delete(`/themes/${id}/files?path=${encodeURIComponent(path)}`),
    onSuccess: (_result, path) => {
      setDeleting(null)
      setOpen((list) => list.filter((file) => file.path !== path))
      if (active === path) setActive(null)
      void queryClient.invalidateQueries({ queryKey: themeKeys.files(id) })
      success(`${path} deleted`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const versions = useQuery({
    queryKey: themeKeys.versions(id, versionsFor?.path ?? ''),
    queryFn: () => api.get<{ versions: FileVersion[] }>(`/themes/${id}/files/versions`, { path: versionsFor!.path }),
    enabled: Boolean(versionsFor),
  })
  const restore = useMutation({
    mutationFn: (versionId: number) => api.post<{ file: ThemeFileContent }>(`/themes/${id}/versions/${versionId}/restore`),
    onSuccess: (result) => {
      setViewingVersion(null)
      update(result.file.path, { original: result.file.content ?? '', content: result.file.content ?? '', checksum: result.file.checksum, problems: [] })
      void queryClient.invalidateQueries({ queryKey: themeKeys.files(id) })
      success('Restored')
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const errorLine = useMemo(() => {
    const match = current?.problems.map((problem) => /line:(\d+)/.exec(problem)).find(Boolean)
    return match ? Number(match[1]) : null
  }, [current?.problems])

  const term = filter.trim().toLowerCase()

  return (
    // The whole window, as Shopify's editor: the preview needs the room, and nothing behind it should scroll.
    <Box sx={{ position: 'fixed', inset: 0, zIndex: (theme) => theme.zIndex.modal - 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, height: 52, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Tooltip title="Back to themes">
          <IconButton component={RouterLink} to="/merchandising/themes" size="small" aria-label="Back to themes">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="subtitle2">{listing.data?.theme.name ?? 'Theme'}</Typography>
        <Chip size="small" label="Edit code" sx={{ height: 20, fontSize: 11 }} />
        {listing.data?.theme.role === 'main' && <Chip size="small" color="success" label="Live" sx={{ height: 20, fontSize: 11 }} />}
        <Box sx={{ flex: 1 }} />
        <Button size="small" component={RouterLink} to={`/merchandising/themes/${id}`}>
          Customize
        </Button>
      </Stack>

      {listing.data?.theme.role === 'main' && (
        <Alert severity="warning" sx={{ borderRadius: 0, py: 0 }}>
          This is your live theme — saved changes reach shoppers straight away. Duplicate it to experiment safely.
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '280px 1fr' }}>
        <Box sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowY: 'auto' }}>
          <Box sx={{ p: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search files"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
          </Box>
          {listing.isLoading && <CircularProgress size={20} sx={{ m: 2 }} />}
          {FOLDERS.map((folder) => {
            const entries = (listing.data?.files ?? []).filter((file) => file.path.startsWith(`${folder.key}/`) && (!term || file.path.toLowerCase().includes(term)))
            if (term && entries.length === 0) return null
            const isOpen = !collapsed.has(folder.key) || Boolean(term)
            return (
              <Box key={folder.key}>
                <Stack direction="row" sx={{ alignItems: 'center', px: 1, py: 0.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => setCollapsed((set) => { const next = new Set(set); if (next.has(folder.key)) next.delete(folder.key); else next.add(folder.key); return next })}>
                  {isOpen ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
                  <FolderOutlinedIcon sx={{ fontSize: 16, mx: 0.75, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                    {folder.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                    {entries.length}
                  </Typography>
                  {canManage && (
                    <Tooltip title={`Add a new ${folder.label.toLowerCase().replace(/s$/, '')}`}>
                      <IconButton size="small" onClick={(event) => { event.stopPropagation(); setCreating(folder.key) }} aria-label={`Add to ${folder.label}`}>
                        <AddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Collapse in={isOpen}>
                  <List dense disablePadding>
                    {entries.map((file) => {
                      const name = file.path.slice(folder.key.length + 1)
                      const openEntry = open.find((item) => item.path === file.path)
                      return (
                        <ListItemButton key={file.path} selected={active === file.path} onClick={() => void openFile(file.path)} sx={{ pl: 4.5, py: 0.25 }}>
                          <InsertDriveFileOutlinedIcon sx={{ fontSize: 14, mr: 1, color: 'text.disabled' }} />
                          <ListItemText primary={name} slotProps={{ primary: { noWrap: true, sx: { fontSize: 13, fontFamily: 'ui-monospace, monospace' } } }} />
                          {openEntry && openEntry.content !== openEntry.original && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'warning.main', ml: 1 }} />}
                          {file.has_draft && <Chip size="small" label="draft" sx={{ height: 16, fontSize: 10, ml: 0.5 }} />}
                        </ListItemButton>
                      )
                    })}
                  </List>
                </Collapse>
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {open.length > 0 && (
            <Tabs value={active ?? false} onChange={(_event, value) => setActive(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 38, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              {open.map((file) => (
                <Tab
                  key={file.path}
                  value={file.path}
                  sx={{ minHeight: 38, textTransform: 'none', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, py: 0, pr: 0.5 }}
                  label={
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <span>{file.path.split('/').pop()}</span>
                      {file.content !== file.original && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'warning.main' }} />}
                      <Box
                        component="span"
                        role="button"
                        aria-label={`Close ${file.path}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (file.content !== file.original && !window.confirm(`Close ${file.path} without saving?`)) return
                          setOpen((list) => list.filter((item) => item.path !== file.path))
                          if (active === file.path) setActive(open.find((item) => item.path !== file.path)?.path ?? null)
                        }}
                        sx={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          )}

          {current ? (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, monospace', flex: 1 }} noWrap>
                  {current.path}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {files.get(current.path) ? `Saved ${formatRelative(files.get(current.path)!.updated_at)}` : ''}
                </Typography>
                <Tooltip title="Older versions">
                  <IconButton size="small" onClick={(event) => setVersionsFor({ anchor: event.currentTarget, path: current.path })} aria-label="Older versions">
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {canManage && (
                  <>
                    <IconButton size="small" onClick={(event) => setFileMenu(event.currentTarget)} aria-label="File actions">
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                    <Button size="small" variant="contained" disabled={!dirty || save.isPending || !TEXT.test(current.path)} onClick={() => save.mutate(current)}>
                      {save.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                )}
              </Stack>
              {current.problems.length > 0 && (
                <Alert severity="error" sx={{ borderRadius: 0 }} onClose={() => update(current.path, { problems: [] })}>
                  {current.problems.slice(0, 6).map((problem) => (
                    <div key={problem}>{problem}</div>
                  ))}
                </Alert>
              )}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                {TEXT.test(current.path) ? (
                  <CodeEditor value={current.content} readOnly={!canManage} errorLine={errorLine} onChange={(content) => update(current.path, { content })} onSave={() => dirty && save.mutate(current)} />
                ) : current.url ? (
                  <Box sx={{ p: 3 }}>
                    <img src={current.url} alt={current.path} style={{ maxWidth: '100%', maxHeight: 480 }} />
                  </Box>
                ) : (
                  <Typography sx={{ p: 3 }} color="text.secondary">
                    This file cannot be shown here.
                  </Typography>
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary', p: 4, textAlign: 'center' }}>
              <Box>
                <Typography variant="subtitle1" color="text.primary">
                  Choose a file to edit
                </Typography>
                <Typography variant="body2" sx={{ maxWidth: 440, mt: 1 }}>
                  Sections live in <code>sections/</code> with their settings in a <code>{'{% schema %}'}</code> tag; page layouts are the JSON files in <code>templates/</code>; shared pieces are in <code>snippets/</code>.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Menu anchorEl={fileMenu} open={Boolean(fileMenu)} onClose={() => setFileMenu(null)}>
        <MenuItem disabled={files.get(current?.path ?? '')?.required} onClick={() => { setFileMenu(null); if (current) setRenaming(current.path) }}>
          Rename
        </MenuItem>
        <MenuItem disabled={files.get(current?.path ?? '')?.required} sx={{ color: 'error.main' }} onClick={() => { setFileMenu(null); if (current) setDeleting(current.path) }}>
          Delete
        </MenuItem>
      </Menu>

      <Menu anchorEl={versionsFor?.anchor} open={Boolean(versionsFor)} onClose={() => setVersionsFor(null)}>
        {versions.isLoading && <MenuItem disabled>Loading…</MenuItem>}
        {versions.data?.versions.length === 0 && <MenuItem disabled>No older versions yet</MenuItem>}
        {versions.data?.versions.map((version, index) => (
          <MenuItem
            key={version.id}
            onClick={async () => {
              const path = versionsFor!.path
              setVersionsFor(null)
              const result = await api.get<{ version: { id: number; path: string; content: string | null; created_at: string } }>(`/themes/${id}/versions/${version.id}`)
              setViewingVersion({ ...result.version, path })
            }}
          >
            <ListItemText primary={`${formatRelative(version.created_at)}${index === 0 ? ' · current' : ''}`} secondary={{ install: 'Installed', editor: 'Theme editor', code: 'Code editor', upgrade: 'Update', restore: 'Restored', api: 'API / CLI' }[version.source]} />
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={Boolean(viewingVersion)} onClose={() => setViewingVersion(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {viewingVersion?.path}
          <Typography variant="body2" color="text.secondary">
            Version from {viewingVersion ? formatRelative(viewingVersion.created_at) : ''}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: '60vh' }}>
          {viewingVersion && <CodeEditor value={viewingVersion.content ?? ''} readOnly onChange={() => undefined} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingVersion(null)}>Close</Button>
          {canManage && (
            <Button variant="contained" disabled={restore.isPending || viewingVersion?.content === null} onClick={() => viewingVersion && restore.mutate(viewingVersion.id)}>
              Restore this version
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {creating && <NewFileDialog folder={creating} busy={create.isPending} onClose={() => setCreating(null)} onCreate={(path) => create.mutate(path)} />}
      {renaming && <RenameFileDialog path={renaming} busy={rename.isPending} onClose={() => setRenaming(null)} onRename={(to) => rename.mutate({ from: renaming, to })} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting ?? ''}?`}
        body="Its last version is kept under Older versions, so it can be brought back."
        confirmLabel="Delete file"
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

const EXTENSIONS: Record<string, string[]> = {
  layout: ['.liquid'],
  templates: ['.json', '.liquid'],
  sections: ['.liquid', '.json'],
  blocks: ['.liquid'],
  snippets: ['.liquid'],
  assets: ['.css', '.js', '.css.liquid', '.js.liquid', '.svg'],
  config: ['.json'],
  locales: ['.json'],
}

function NewFileDialog({ folder, busy, onClose, onCreate }: { folder: string; busy: boolean; onClose(): void; onCreate(path: string): void }) {
  const extensions = EXTENSIONS[folder] ?? ['.liquid']
  const [name, setName] = useState('')
  const [extension, setExtension] = useState(extensions[0])
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  const path = `${folder}/${clean}${extension}`
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{folder === 'templates' ? 'Add a new template' : `Add a new ${folder.replace(/s$/, '')}`}</DialogTitle>
      <DialogContent>
        {folder === 'templates' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            An alternate template: name it <code>product.gift</code> to use for chosen products. It starts as a copy of the default one.
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField autoFocus fullWidth size="small" label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder={folder === 'templates' ? 'product.gift' : 'my-section'} />
          <TextField select size="small" value={extension} onChange={(event) => setExtension(event.target.value)} sx={{ width: 130 }}>
            {extensions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontFamily: 'ui-monospace, monospace' }}>
          {clean ? path : ' '}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !clean} onClick={() => onCreate(path)}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RenameFileDialog({ path, busy, onClose, onRename }: { path: string; busy: boolean; onClose(): void; onRename(to: string): void }) {
  const folder = path.split('/')[0]
  const [name, setName] = useState(path.slice(folder.length + 1))
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rename file</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth size="small" sx={{ mt: 1 }} label="Name" value={name} onChange={(event) => setName(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start">{folder}/</InputAdornment> } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !name.trim()} onClick={() => onRename(`${folder}/${name.trim()}`)}>
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  )
}
