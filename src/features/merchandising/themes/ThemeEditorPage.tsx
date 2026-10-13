import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CodeIcon from '@mui/icons-material/Code'
import DesktopWindowsOutlinedIcon from '@mui/icons-material/DesktopWindowsOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import ViewQuiltOutlinedIcon from '@mui/icons-material/ViewQuiltOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { useFlash } from '../../../hooks/useFlash'
import { useGoogleFonts } from '../../../hooks/useGoogleFonts'
import { errorMessage } from '../../../lib/errors'
import { FONT_FAMILIES } from '../../../lib/googleFonts'
import { themeKeys, type AppBlock, type AppEmbedEntry, type EditorState, type JsonTemplate, type SettingValue } from './themeTypes'
import { AddSectionDialog } from './editor/AddSectionDialog'
import {
  addBlock,
  addSection,
  duplicateBlock,
  duplicateSection,
  moveBlock,
  moveInOrder,
  removeBlock,
  removeSection,
  sectionLabel,
  blockLabel,
  serialise,
  setBlockSetting,
  setSectionSetting,
  TEMPLATE_GROUPS,
  toggleBlock,
  toggleSection,
  valueOf,
  embedId,
  withAppBlocks,
  type Target,
} from './editor/editorModel'
import { SectionTree, type Selection, type TreeTarget } from './editor/SectionTree'
import { SettingField } from './editor/SettingField'

/**
 * The theme editor — Shopify's "Customize".
 *
 * Left: the page's sections (header group, template, footer group) and the
 * theme's global settings. Right: the selected section's or block's
 * settings, generated from its {% schema %}. Centre: the store itself,
 * rendered by the server from this theme with the unsaved changes laid over
 * it.
 *
 * Every change is written to the theme as a draft half a second after it is
 * made (so nothing is lost if the tab closes), and the preview re-renders
 * only the section that changed, through the Section Rendering API. Nothing
 * reaches shoppers until Save — and for a theme that is not published, not
 * until it is published.
 */

interface Model {
  docs: Record<string, JsonTemplate>
  settings: Record<string, SettingValue>
}

type PreviewOp = { refresh?: string[]; reload?: boolean; reorder?: string[]; select?: string }

const SETTINGS_FILE = 'config/settings_data.json'
const DEVICES = { desktop: { width: '100%', Icon: DesktopWindowsOutlinedIcon, label: 'Desktop' }, mobile: { width: '390px', Icon: PhoneIphoneIcon, label: 'Mobile' } } as const

export function ThemeEditorPage() {
  const { id = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const template = search.get('template') ?? 'index'
  const [followPath, setFollowPath] = useState<string | null>(null)
  const state = useQuery({
    queryKey: themeKeys.editor(id, template),
    queryFn: () => api.get<EditorState>(`/themes/${id}/editor`, { template }),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  if (state.isError) return <Alert severity="error" sx={{ m: 3 }}>{errorMessage(state.error)}</Alert>
  if (!state.data) {
    return (
      <Box sx={{ height: 'calc(100dvh - 64px)', display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }
  return (
    <Editor
      key={`${id}:${state.data.template?.key ?? template}:${state.dataUpdatedAt}`}
      state={state.data}
      initialPreview={followPath}
      onTemplate={(key, previewPath) => {
        setFollowPath(previewPath ?? null)
        setSearch({ template: key })
      }}
      onReload={() => void state.refetch()}
    />
  )
}

function Editor({ state, initialPreview, onTemplate, onReload }: { state: EditorState; initialPreview: string | null; onTemplate(key: string, previewPath?: string): void; onReload(): void }) {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('themes.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const themeId = state.theme.id
  const previewOrigin = state.preview.origin
  // Installed apps' blocks appear wherever a section accepts "@app".
  const schemas = useMemo(() => withAppBlocks(state.schemas, state.app_blocks ?? []), [state.schemas, state.app_blocks])

  // ── the documents being edited ──────────────────────────────────────────
  const initial = useMemo<Model>(() => {
    const docs: Record<string, JsonTemplate> = {}
    if (state.template?.data) docs[state.template.file] = state.template.data
    for (const group of state.groups) if (group.data) docs[group.file] = group.data
    return { docs, settings: state.settings }
  }, [state])
  const [model, setModel] = useState<Model>(initial)
  const modelRef = useRef(model)
  const past = useRef<Model[]>([])
  const future = useRef<Model[]>([])
  const [history, setHistory] = useState({ past: 0, future: 0 })
  const [dirty, setDirty] = useState(state.drafts.length > 0)
  const [saving, setSaving] = useState<'idle' | 'drafting' | 'saving'>('idle')

  const targets = useMemo<TreeTarget[]>(() => {
    const out: TreeTarget[] = []
    const groups = state.groups.filter((group) => model.docs[group.file])
    const header = groups.filter((group) => (model.docs[group.file] as JsonTemplate & { type?: string }).type === 'header' || /header/.test(group.name))
    const rest = groups.filter((group) => !header.includes(group))
    for (const group of header) out.push({ kind: 'group', file: group.file, scope: 'header', label: 'Header', document: model.docs[group.file] })
    if (state.template?.json && model.docs[state.template.file]) {
      out.push({ kind: 'template', file: state.template.file, scope: state.template.type, label: 'Template', document: model.docs[state.template.file] })
    }
    for (const group of rest) {
      const type = String((model.docs[group.file] as JsonTemplate & { type?: string }).type ?? 'footer')
      out.push({ kind: 'group', file: group.file, scope: type, label: type.charAt(0).toUpperCase() + type.slice(1), document: model.docs[group.file] })
    }
    return out
  }, [model.docs, state.groups, state.template])

  // ── drafts: saved half a second after each change ───────────────────────
  const pending = useRef(new Map<string, string>())
  const ops = useRef<PreviewOp>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const frame = useRef<HTMLIFrameElement | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)

  const post = useCallback(
    (message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ source: 'veylog-editor', ...message }, previewOrigin),
    [previewOrigin],
  )

  const applyOps = useCallback(
    (op: PreviewOp) => {
      if (op.reload) {
        setPreviewLoading(true)
        post({ type: 'reload' })
        return
      }
      if (op.reorder?.length) post({ type: 'sections:reorder', order: op.reorder })
      if (op.refresh?.length) post({ type: 'sections:refresh', ids: [...new Set(op.refresh)], select: op.select })
    },
    [post],
  )

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    chain.current = chain.current.then(async () => {
      if (pending.current.size === 0) return
      const files = [...pending.current.entries()].map(([path, content]) => ({ path, content }))
      const op = ops.current
      pending.current = new Map()
      ops.current = {}
      setSaving('drafting')
      try {
        await api.put(`/themes/${themeId}/drafts`, { files })
        setDirty(true)
        applyOps(op)
      } catch (caught) {
        flashError(errorMessage(caught))
      } finally {
        setSaving('idle')
      }
    })
    return chain.current
  }, [themeId, applyOps, flashError])

  const queue = useCallback(
    (next: Model, files: string[], op: PreviewOp) => {
      for (const file of files) {
        if (file === SETTINGS_FILE) pending.current.set(file, serialise({ ...state.settings_data, current: next.settings }))
        else if (next.docs[file]) pending.current.set(file, serialise(next.docs[file]))
      }
      const merged = ops.current
      ops.current = {
        reload: merged.reload || op.reload,
        refresh: [...(merged.refresh ?? []), ...(op.refresh ?? [])],
        reorder: op.reorder ?? merged.reorder,
        select: op.select ?? merged.select,
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), op.reload ? 650 : 450)
    },
    [flush, state],
  )

  const commit = useCallback(
    (update: (current: Model) => Model, files: string[], op: PreviewOp) => {
      const previous = modelRef.current
      const next = update(previous)
      if (next === previous) return
      past.current = [...past.current.slice(-59), previous]
      future.current = []
      modelRef.current = next
      setModel(next)
      setHistory({ past: past.current.length, future: 0 })
      queue(next, files, op)
    },
    [queue],
  )

  const changedFiles = (a: Model, b: Model) => {
    const files = new Set<string>()
    for (const file of new Set([...Object.keys(a.docs), ...Object.keys(b.docs)])) if (JSON.stringify(a.docs[file]) !== JSON.stringify(b.docs[file])) files.add(file)
    if (JSON.stringify(a.settings) !== JSON.stringify(b.settings)) files.add(SETTINGS_FILE)
    return [...files]
  }
  const undo = useCallback(() => {
    const previous = past.current.pop()
    if (!previous) return
    future.current.push(modelRef.current)
    const files = changedFiles(modelRef.current, previous)
    modelRef.current = previous
    setModel(previous)
    queue(previous, files, { reload: true })
    setHistory({ past: past.current.length, future: future.current.length })
  }, [queue])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(modelRef.current)
    const files = changedFiles(modelRef.current, next)
    modelRef.current = next
    setModel(next)
    queue(next, files, { reload: true })
    setHistory({ past: past.current.length, future: future.current.length })
  }, [queue])

  // Save what is pending when the editor closes; the drafts survive either way.
  useEffect(() => () => void flush(), [flush])

  // ── save, discard, publish ──────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      setSaving('saving')
      await flush()
      return api.post<{ saved: string[] }>(`/themes/${themeId}/drafts/publish`)
    },
    onSuccess: () => {
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: themeKeys.list })
      success(state.theme.role === 'main' ? 'Saved — your store has the changes' : 'Saved')
    },
    onError: (caught) => flashError(errorMessage(caught)),
    onSettled: () => setSaving('idle'),
  })
  const [confirm, setConfirm] = useState<'discard' | 'publish' | null>(null)
  const discard = useMutation({
    mutationFn: async () => {
      if (timer.current) clearTimeout(timer.current)
      pending.current = new Map()
      await chain.current
      return api.delete(`/themes/${themeId}/drafts`)
    },
    onSuccess: () => {
      setConfirm(null)
      onReload()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await save.mutateAsync()
      return api.post(`/themes/${themeId}/publish`)
    },
    onSuccess: () => {
      setConfirm(null)
      void queryClient.invalidateQueries({ queryKey: themeKeys.all })
      success(`${state.theme.name} is now live`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  // ── selection and the preview ───────────────────────────────────────────
  const [selection, setSelection] = useState<Selection>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [panel, setPanel] = useState<'sections' | 'settings'>('sections')
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop')
  const [adding, setAdding] = useState<Target | null>(null)
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [previewSrc] = useState(() => (initialPreview ? `${previewOrigin}${initialPreview}` : state.preview.design_url))

  const select = useCallback(
    (next: Selection) => {
      setSelection(next)
      setPanel('sections')
      if (!next) return
      setExpanded((current) => new Set(current).add(`${next.file}::${next.section}`))
      if (next.block) post({ type: 'block:select', section: next.section, block: next.block })
      else post({ type: 'section:select', id: next.section })
    },
    [post],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== previewOrigin) return
      const data = event.data as { source?: string; type?: string; section?: string; block?: string; template?: string | null; path?: string }
      if (data?.source !== 'veylog-preview') return
      if (data.type === 'ready') {
        setPreviewLoading(false)
        // Following a link to another kind of page switches the template, as in Shopify.
        if (data.template && data.template !== state.template?.key && data.path) onTemplate(data.template, data.path)
      } else if (data.type === 'select' && data.section) {
        const file = targets.find((target) => target.document.sections[data.section!])?.file
        if (file) select({ file, section: data.section, block: data.block ?? undefined })
      } else if (data.type === 'reload-needed') {
        post({ type: 'reload' })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [previewOrigin, targets, select, post, state.template?.key, onTemplate])

  // Keyboard: undo, redo, save.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const tag = (event.target as HTMLElement | null)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (canManage && dirty) save.mutate()
      } else if (event.key.toLowerCase() === 'z' && !typing) {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, save, canManage, dirty])

  useGoogleFonts(panel === 'settings' ? Object.keys(FONT_FAMILIES) : [])

  // ── edits ───────────────────────────────────────────────────────────────
  const docOf = (file: string) => modelRef.current.docs[file]
  const editDoc = (file: string, change: (doc: JsonTemplate) => JsonTemplate, op: PreviewOp) =>
    commit((current) => ({ ...current, docs: { ...current.docs, [file]: change(current.docs[file]) } }), [file], op)

  const selectedSection = selection ? model.docs[selection.file]?.sections[selection.section] : undefined
  const selectedSchema = selectedSection ? schemas[selectedSection.type] : undefined
  const selectedBlock = selection?.block ? selectedSection?.blocks?.[selection.block] : undefined
  const selectedBlockDef = selectedBlock ? selectedSchema?.blocks?.find((block) => block.type === selectedBlock.type) : undefined

  const onSetting = (key: string, value: SettingValue) => {
    if (!selection) return
    const { file, section, block } = selection
    editDoc(file, (doc) => (block ? setBlockSetting(doc, section, block, key, value) : setSectionSetting(doc, section, key, value)), { refresh: [section], select: section })
  }

  const templateOptions = useMemo(() => {
    const byType = new Map<string, EditorState['templates']>()
    for (const option of state.templates) byType.set(option.type, [...(byType.get(option.type) ?? []), option])
    return TEMPLATE_GROUPS.filter((group) => byType.has(group.type)).map((group) => ({ ...group, options: byType.get(group.type)! }))
  }, [state.templates])

  const readOnly = !canManage

  return (
    // The whole window, as Shopify's editor: the preview needs the room, and nothing behind it should scroll.
    <Box sx={{ position: 'fixed', inset: 0, zIndex: (theme) => theme.zIndex.modal - 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, height: 52, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Tooltip title="Back to themes">
          <IconButton component={RouterLink} to="/merchandising/themes" size="small" aria-label="Back to themes">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" noWrap sx={{ maxWidth: 220 }}>
              {state.theme.name}
            </Typography>
            <Chip size="small" label={state.theme.role === 'main' ? 'Live' : 'Draft'} color={state.theme.role === 'main' ? 'success' : 'default'} sx={{ height: 20, fontSize: 11 }} />
          </Stack>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Select
            size="small"
            value={state.template?.key ?? ''}
            onChange={(event) => {
              void flush()
              onTemplate(String(event.target.value))
            }}
            sx={{ minWidth: 240, '& .MuiSelect-select': { py: 0.75 } }}
            inputProps={{ 'aria-label': 'Template' }}
          >
            {templateOptions.flatMap((group) => [
              <ListSubheader key={`h-${group.type}`} sx={{ lineHeight: '30px', fontSize: 12 }}>
                {group.label}
              </ListSubheader>,
              ...group.options.map((option) => (
                <MenuItem key={option.key} value={option.key} sx={{ pl: 3 }}>
                  {option.suffix ? option.suffix : `Default ${group.label.toLowerCase().replace(/s$/, '')}`}
                  {!option.json && <Chip size="small" label="Liquid" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                </MenuItem>
              )),
            ])}
          </Select>
        </Box>

        <ToggleButtonGroup size="small" exclusive value={device} onChange={(_event, next) => next && setDevice(next)}>
          {Object.entries(DEVICES).map(([key, { Icon, label }]) => (
            <ToggleButton key={key} value={key} aria-label={`${label} preview`} sx={{ px: 1 }}>
              <Icon sx={{ fontSize: 18 }} />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton size="small" onClick={undo} disabled={readOnly || history.past === 0} aria-label="Undo">
              <UndoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton size="small" onClick={redo} disabled={readOnly || history.future === 0} aria-label="Redo">
              <RedoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={(event) => setMenu(event.currentTarget)} aria-label="More actions">
          <MoreHorizIcon fontSize="small" />
        </IconButton>
        {canManage && (
          <Button variant="contained" size="small" disabled={!dirty || save.isPending} onClick={() => save.mutate()} sx={{ minWidth: 84 }}>
            {saving === 'saving' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
        )}
      </Stack>

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem component="a" href={state.preview.preview_url} target="_blank" rel="noopener" onClick={() => setMenu(null)}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5 }} /> Preview in new tab
        </MenuItem>
        <MenuItem component={RouterLink} to={`/merchandising/themes/${themeId}/code`} onClick={() => setMenu(null)}>
          <CodeIcon fontSize="small" sx={{ mr: 1.5 }} /> Edit code
        </MenuItem>
        {canManage && state.theme.role !== 'main' && (
          <MenuItem onClick={() => { setMenu(null); setConfirm('publish') }}>Publish</MenuItem>
        )}
        {canManage && (
          <MenuItem disabled={!dirty} onClick={() => { setMenu(null); setConfirm('discard') }} sx={{ color: 'error.main' }}>
            Discard unsaved changes
          </MenuItem>
        )}
      </Menu>

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '48px 300px 1fr 320px' }}>
        {/* ── rail ──────────────────────────────────────────────────────── */}
        <Stack sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', alignItems: 'center', pt: 1 }} spacing={0.5}>
          <Tooltip title="Sections" placement="right">
            <IconButton color={panel === 'sections' ? 'primary' : 'default'} onClick={() => setPanel('sections')} aria-label="Sections">
              <ViewQuiltOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Theme settings" placement="right">
            <IconButton color={panel === 'settings' ? 'primary' : 'default'} onClick={() => setPanel('settings')} aria-label="Theme settings">
              <PaletteOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* ── left pane ─────────────────────────────────────────────────── */}
        <Box sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowY: 'auto' }}>
          {panel === 'sections' ? (
            <>
              <Typography variant="subtitle2" sx={{ px: 1.5, pt: 1.5 }}>
                {state.template?.label ?? 'Page'}
                {state.template?.suffix ? ` · ${state.template.suffix}` : ''}
              </Typography>
              {!state.template?.json && (
                <Alert severity="info" sx={{ m: 1.5 }}>
                  This template is written in Liquid, so its content is edited in the code editor. The header and footer are still editable here.
                </Alert>
              )}
              <SectionTree
                targets={targets}
                schemas={schemas}
                selection={selection}
                expanded={expanded}
                disabled={readOnly}
                onSelect={select}
                onToggleExpand={(key) => setExpanded((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}
                onToggleSection={(file, section) => editDoc(file, (doc) => toggleSection(doc, section), { reload: true })}
                onToggleBlock={(file, section, block) => editDoc(file, (doc) => toggleBlock(doc, section, block), { refresh: [section] })}
                onAddSection={(target) => setAdding(target)}
                onAddBlock={(file, section, type) => {
                  let created = ''
                  editDoc(file, (doc) => { const result = addBlock(doc, section, type); created = result.id; return result.template }, { refresh: [section], select: section })
                  if (created) setSelection({ file, section, block: created })
                }}
                onMoveSection={(file, section, index) => {
                  const order = moveInOrder(docOf(file).order, section, index)
                  editDoc(file, (doc) => ({ ...doc, order }), { reorder: order })
                }}
                onMoveBlock={(file, section, block, index) => editDoc(file, (doc) => moveBlock(doc, section, block, index), { refresh: [section] })}
              />
            </>
          ) : (
            <ThemeSettingsPanel
              state={state}
              values={model.settings}
              disabled={readOnly}
              onChange={(key, value) => commit((current) => ({ ...current, settings: { ...current.settings, [key]: value } }), [SETTINGS_FILE], { reload: true })}
              onPreset={(preset) => {
                const values = state.settings_data.presets?.[preset]
                // A style changes the look; the app embeds that are switched on stay on.
                if (values) commit((current) => ({ ...current, settings: { ...values, ...(current.settings.blocks ? { blocks: current.settings.blocks } : {}) } }), [SETTINGS_FILE], { reload: true })
              }}
              onEmbeds={(embeds) => commit((current) => ({ ...current, settings: { ...current.settings, blocks: embeds as unknown as SettingValue } }), [SETTINGS_FILE], { reload: true })}
            />
          )}
        </Box>

        {/* ── preview ───────────────────────────────────────────────────── */}
        <Box sx={{ position: 'relative', minWidth: 0, bgcolor: 'grey.100', display: 'flex', justifyContent: 'center', p: device === 'mobile' ? 3 : 1.5 }}>
          <Box sx={{ width: DEVICES[device].width, maxWidth: '100%', height: '100%', borderRadius: device === 'mobile' ? 4 : 1.5, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.12), 0 12px 32px -12px rgba(0,0,0,.25)', bgcolor: 'common.white', transition: 'width .25s ease', position: 'relative' }}>
            <iframe
              ref={frame}
              title="Store preview"
              src={previewSrc}
              onLoad={() => setPreviewLoading(false)}
              style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
            />
            {previewLoading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.55)', pointerEvents: 'none' }}>
                <CircularProgress size={26} />
              </Box>
            )}
          </Box>
          {saving === 'drafting' && (
            <Typography variant="caption" sx={{ position: 'absolute', bottom: 6, right: 14, color: 'text.secondary' }}>
              Saving draft…
            </Typography>
          )}
        </Box>

        {/* ── right pane: the selection's settings ─────────────────────── */}
        <Box sx={{ borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowY: 'auto' }}>
          {selection && selectedSection ? (
            <SelectionPanel
              key={`${selection.file}:${selection.section}:${selection.block ?? ''}`}
              title={selectedBlock ? blockLabel(selectedBlock, selectedBlockDef) : sectionLabel(selectedSection, selectedSchema)}
              subtitle={selectedBlock ? (selectedBlockDef?.name ?? selectedBlock.type) : undefined}
              settings={(selectedBlock ? selectedBlockDef?.settings : selectedSchema?.settings) ?? []}
              values={(selectedBlock ? selectedBlock.settings : selectedSection.settings) ?? {}}
              disabled={readOnly}
              removable={selectedBlock ? true : !selectedSection.type.startsWith('main-')}
              hidden={Boolean(selectedBlock ? selectedBlock.disabled : selectedSection.disabled)}
              onBack={selectedBlock ? () => select({ file: selection.file, section: selection.section }) : undefined}
              onChange={onSetting}
              onDuplicate={() => {
                const { file, section, block } = selection
                if (block) {
                  let created = block
                  editDoc(file, (doc) => { const result = duplicateBlock(doc, section, block); created = result.id; return result.template }, { refresh: [section] })
                  setSelection({ file, section, block: created })
                } else {
                  let created = section
                  editDoc(file, (doc) => { const result = duplicateSection(doc, section); created = result.id; return result.template }, { reload: true })
                  setSelection({ file, section: created })
                }
              }}
              onToggle={() => {
                const { file, section, block } = selection
                if (block) editDoc(file, (doc) => toggleBlock(doc, section, block), { refresh: [section] })
                else editDoc(file, (doc) => toggleSection(doc, section), { reload: true })
              }}
              onRemove={() => {
                const { file, section, block } = selection
                if (block) {
                  editDoc(file, (doc) => removeBlock(doc, section, block), { refresh: [section] })
                  setSelection({ file, section })
                } else {
                  editDoc(file, (doc) => removeSection(doc, section), { reload: true })
                  setSelection(null)
                }
              }}
            />
          ) : (
            <Box sx={{ p: 3, color: 'text.secondary' }}>
              <Typography variant="subtitle2" color="text.primary" gutterBottom>
                Customize your {state.template?.label.toLowerCase() ?? 'page'}
              </Typography>
              <Typography variant="body2">Select a section on the left, or click anything in the preview, to edit it here.</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" sx={{ display: 'block' }}>
                Changes are kept as a draft while you work. Shoppers see them when you press Save{state.theme.role === 'main' ? '' : ' and publish this theme'}.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <AddSectionDialog
        open={Boolean(adding)}
        target={adding}
        document={adding ? model.docs[adding.file] : null}
        schemas={schemas}
        onClose={() => setAdding(null)}
        onAdd={(type, presetIndex) => {
          const target = adding!
          const afterId = selection?.file === target.file ? selection.section : null
          let created = ''
          editDoc(target.file, (doc) => { const result = addSection(doc, type, schemas[type], presetIndex, afterId); created = result.id; return result.template }, { reload: true })
          setAdding(null)
          if (created) {
            setSelection({ file: target.file, section: created })
            setExpanded((current) => new Set(current).add(`${target.file}::${created}`))
          }
        }}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Discard unsaved changes?"
        body="The theme goes back to how it was last saved. This cannot be undone."
        confirmLabel="Discard"
        destructive
        busy={discard.isPending}
        onConfirm={() => discard.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'publish'}
        title={`Publish ${state.theme.name}?`}
        body="It replaces your current theme as the theme shoppers see. The current theme moves to your theme library."
        confirmLabel="Publish"
        busy={publish.isPending}
        onConfirm={() => publish.mutate()}
        onClose={() => setConfirm(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

function SelectionPanel({
  title,
  subtitle,
  settings,
  values,
  disabled,
  removable,
  hidden,
  onBack,
  onChange,
  onDuplicate,
  onToggle,
  onRemove,
}: {
  title: string
  subtitle?: string
  settings: NonNullable<EditorState['schemas'][string]['settings']>
  values: Record<string, SettingValue>
  disabled: boolean
  removable: boolean
  hidden: boolean
  onBack?: () => void
  onChange(key: string, value: SettingValue): void
  onDuplicate(): void
  onToggle(): void
  onRemove(): void
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
        {onBack && (
          <IconButton size="small" onClick={onBack} aria-label="Back to section">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {hidden && <Chip size="small" label="Hidden" sx={{ height: 20, fontSize: 11 }} />}
        {!disabled && (
          <IconButton size="small" onClick={(event) => setMenu(event.currentTarget)} aria-label="Section actions">
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setMenu(null); onDuplicate() }}>Duplicate</MenuItem>
        {removable && <MenuItem onClick={() => { setMenu(null); onToggle() }}>{hidden ? 'Show' : 'Hide'}</MenuItem>}
        {removable && (
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { setMenu(null); onRemove() }}>
            Remove
          </MenuItem>
        )}
      </Menu>
      <Stack spacing={2.25} sx={{ p: 2 }}>
        {settings.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            This has no settings to change.
          </Typography>
        )}
        {settings.map((definition, index) => (
          <SettingField key={definition.id ?? `${definition.type}-${index}`} definition={definition} value={valueOf(definition, values)} disabled={disabled} onChange={(value) => definition.id && onChange(definition.id, value)} />
        ))}
      </Stack>
    </Box>
  )
}

function ThemeSettingsPanel({
  state,
  values,
  disabled,
  onChange,
  onPreset,
  onEmbeds,
}: {
  state: EditorState
  values: Record<string, SettingValue>
  disabled: boolean
  onChange(key: string, value: SettingValue): void
  onPreset(name: string): void
  onEmbeds(embeds: Record<string, AppEmbedEntry>): void
}) {
  const [presetMenu, setPresetMenu] = useState<HTMLElement | null>(null)
  const embeds = (state.app_blocks ?? []).filter((block) => block.target !== 'section')
  const saved = ((values.blocks as unknown as Record<string, AppEmbedEntry> | undefined) ?? {})
  const entryOf = (block: AppBlock) => Object.entries(saved).find(([, entry]) => entry?.type === block.type)
  const setEmbed = (block: AppBlock, change: (entry: AppEmbedEntry) => AppEmbedEntry) => {
    const found = entryOf(block)
    const id = found?.[0] ?? embedId(block)
    const current: AppEmbedEntry = found?.[1] ?? { type: block.type, disabled: true, settings: {} }
    onEmbeds({ ...saved, [id]: change(current) })
  }
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.5, pt: 1.5, pb: 1 }}>
        <Typography variant="subtitle2">Theme settings</Typography>
        {state.presets.length > 0 && !disabled && (
          <>
            <Button size="small" onClick={(event) => setPresetMenu(event.currentTarget)} sx={{ textTransform: 'none' }}>
              Change style
            </Button>
            <Menu anchorEl={presetMenu} open={Boolean(presetMenu)} onClose={() => setPresetMenu(null)}>
              {state.presets.map((preset) => (
                <MenuItem key={preset} onClick={() => { setPresetMenu(null); onPreset(preset) }}>
                  {preset}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
      {embeds.length > 0 && (
        <Accordion disableGutters elevation={0} square defaultExpanded sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              App embeds
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Features from your installed apps that work across every page, like a chat button or a tracking pixel.
            </Typography>
            <Stack spacing={1.5} divider={<Divider flexItem />}>
              {embeds.map((block) => {
                const entry = entryOf(block)?.[1]
                const on = Boolean(entry && entry.disabled !== true)
                return (
                  <Box key={block.type}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {block.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {block.app.name}
                        </Typography>
                      </Box>
                      <Switch
                        size="small"
                        checked={on}
                        disabled={disabled}
                        slotProps={{ input: { 'aria-label': `${on ? 'Turn off' : 'Turn on'} ${block.name}` } }}
                        onChange={(event) => setEmbed(block, (current) => ({ ...current, disabled: !event.target.checked }))}
                      />
                    </Stack>
                    {on && block.settings.length > 0 && (
                      <Stack spacing={2} sx={{ mt: 1.5 }}>
                        {block.settings.map((definition, index) => (
                          <SettingField
                            key={definition.id ?? `${definition.type}-${index}`}
                            definition={definition}
                            value={valueOf(definition, entry?.settings ?? {})}
                            disabled={disabled}
                            onChange={(value) => definition.id && setEmbed(block, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [definition.id!]: value } }))}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                )
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
      {state.settings_schema.map((group) => (
        <Accordion key={group.name} disableGutters elevation={0} square sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {group.name}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2.25}>
              {(group.settings ?? []).map((definition, index) => (
                <SettingField key={definition.id ?? `${definition.type}-${index}`} definition={definition} value={valueOf(definition, values)} disabled={disabled} onChange={(value) => definition.id && onChange(definition.id, value)} />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  )
}
