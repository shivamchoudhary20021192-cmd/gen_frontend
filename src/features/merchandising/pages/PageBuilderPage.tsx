import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
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
  ChevronLeft as CollapseLeftIcon,
  ChevronRight as CollapseRightIcon,
  ContentCopy as DuplicateIcon,
  DeleteOutlined as DeleteIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandIcon,
  MoreHoriz as MoreIcon,
  OpenInNew as OpenIcon,
  PaletteOutlined as ThemeIcon,
  PhoneIphone as PhoneIcon,
  Laptop as DesktopIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  TabletMac as TabletIcon,
  Visibility as ShownIcon,
  VisibilityOff as HiddenIcon,
} from '@mui/icons-material'
import { api } from '../../../api/client'
import { useShop } from '../../../shop/useShop'
import { tokens } from '../../../theme'
import { themeKeys, type InstalledTheme } from '../themes/themeTypes'
import { SchemaField, useDebouncedSave } from './SchemaFields'
import { SECTION_ICONS } from './sectionIcons'
import {
  headlessStorefrontUrl,
  useAddBlock,
  useAddSection,
  useBuilderPage,
  useDeleteBlock,
  useDeleteSection,
  useDuplicateSection,
  usePageTemplates,
  useReorderSections,
  useSectionCatalogue,
  useUpdateBlock,
  useUpdateSection,
  type BuilderSection,
  type Field,
  type SectionSchema,
} from './usePageBuilder'

/**
 * The page builder.
 *
 * Three panes, which is what every builder worth using has settled on. The
 * arrangement is not the interesting part; four decisions about it are.
 *
 * **The preview gets the room.** It renders at a real device width — 1440,
 * 834 or 390 — and is *scaled* to fit whatever space is left, rather than
 * squeezed into it. A storefront rendered 340px wide is not a preview of
 * anything: every responsive rule fires at the wrong breakpoint and the page
 * you are approving is a page no visitor will ever see. Both side panes
 * collapse, so the preview can have the whole screen when what you are doing
 * is looking rather than typing.
 *
 * **Clicking a band selects it.** The storefront posts the section id back;
 * the row highlights. Shopify's editor has the same contract, and the reason
 * is the same: without it the two panes are unrelated screens that happen to
 * sit side by side, and finding a band's row means reading fifteen names.
 *
 * **A section is added where you are**, not at the end. The `+` between rows
 * inserts there. "Add a section" nearly always means "add one here", and a new
 * band that lands eight screens below the one being looked at is a band the
 * author then drags all the way back.
 *
 * **Settings are grouped.** Content, Layout, Style, Schedule — four short
 * lists instead of one wall of sixteen. The grouping comes from the API with
 * the field, so a new setting lands in the right panel without this file
 * knowing it exists.
 */

const GROUP_LABELS: Record<string, string> = {
  hero: 'Hero',
  products: 'Products',
  story: 'Story',
  media: 'Media',
  utility: 'Utility',
}

const PANEL_LABELS: { key: string; label: string }[] = [
  { key: 'content', label: 'Content' },
  { key: 'layout', label: 'Layout' },
  { key: 'style', label: 'Style' },
]

/** Real device widths, so breakpoints fire where they fire on the device. */
const DEVICES = {
  desktop: { width: 1440, label: 'Desktop', Icon: DesktopIcon },
  tablet: { width: 834, label: 'Tablet', Icon: TabletIcon },
  phone: { width: 390, label: 'Phone', Icon: PhoneIcon },
} as const

type DeviceKey = keyof typeof DEVICES

/**
 * In place of the preview when there is no headless storefront to frame.
 *
 * Page builder sections are drawn by the headless storefront app; an Online
 * Store theme never shows them. So rather than a blank (or wrong) frame, the
 * stage says where the website itself is edited: the theme editor, which
 * previews the real theme site and edits it in place.
 */
function NoStorefrontPreview({
  storefront,
  themeName,
  websiteUrl,
  onCustomize,
}: {
  storefront: string | null
  themeName: string | null
  websiteUrl: string | null
  onCustomize: () => void
}) {
  return (
    <Box
      data-preview-absent
      sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3, bgcolor: tokens.rail }}
    >
      <Box
        sx={{
          maxWidth: 480,
          bgcolor: tokens.paper,
          border: `1px solid ${tokens.border}`,
          borderRadius: 2,
          p: 3,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {themeName ? `Your website is built with the ${themeName} theme` : 'Your website is built with a theme'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Page builder sections are shown by a headless storefront app, not by themes — so they can't be previewed
          here, and changing them doesn't change your website. To edit your website's pages, use the theme editor.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
          <Button variant="contained" startIcon={<ThemeIcon />} onClick={onCustomize}>
            {themeName ? 'Customize theme' : 'Choose a theme'}
          </Button>
          {websiteUrl && (
            <Button startIcon={<OpenIcon />} href={websiteUrl} target="_blank" rel="noreferrer">
              View website
            </Button>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2.5 }}>
          {storefront
            ? `Nothing answered at ${storefront}. If you run a headless storefront, start it and reload this page.`
            : 'No headless storefront is set up for this admin. If you run one, set VITE_STOREFRONT_URL to where it runs.'}
        </Typography>
      </Box>
    </Box>
  )
}

export function PageBuilderPage() {
  const templates = usePageTemplates()
  const [templateKey, setTemplateKey] = useState('home')
  const page = useBuilderPage(templateKey)
  const catalogue = useSectionCatalogue()

  const addSection = useAddSection(templateKey)
  const duplicateSection = useDuplicateSection(templateKey)
  const reorder = useReorderSections(templateKey)
  const updateSection = useUpdateSection(templateKey)
  const deleteSection = useDeleteSection(templateKey)
  const addBlock = useAddBlock(templateKey)
  const updateBlock = useUpdateBlock(templateKey)
  const deleteBlock = useDeleteBlock(templateKey)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [addingAfter, setAddingAfter] = useState<number | null | 'end'>(null)
  const [confirming, setConfirming] = useState<BuilderSection | null>(null)
  const [menuFor, setMenuFor] = useState<{ id: number; anchor: HTMLElement } | null>(null)
  const [device, setDevice] = useState<DeviceKey>('desktop')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropBefore, setDropBefore] = useState<number | null>(null)
  const [railOpen, setRailOpen] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({ content: true, layout: false, style: false })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const frame = useRef<HTMLIFrameElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const [stageWidth, setStageWidth] = useState(0)

  // The headless storefront says 'ready' once its page has loaded. Until it
  // does the frame is 'waiting'; with no storefront, or none answering, the
  // stage explains where the website is edited instead of framing nothing.
  const storefront = useMemo(() => headlessStorefrontUrl(), [])
  const [previewState, setPreviewState] = useState<'waiting' | 'ready' | 'absent'>(storefront ? 'waiting' : 'absent')
  useEffect(() => {
    if (previewState !== 'waiting') return
    const timer = setTimeout(() => setPreviewState((state) => (state === 'waiting' ? 'absent' : state)), 10000)
    return () => clearTimeout(timer)
  }, [previewState])

  const shop = useShop()
  const navigate = useNavigate()
  const themes = useQuery({
    queryKey: themeKeys.list,
    queryFn: () => api.get<{ themes: InstalledTheme[] }>('/themes'),
    enabled: previewState === 'absent',
  })
  const liveTheme = themes.data?.themes.find((theme) => theme.role === 'main') ?? null
  const websiteUrl = storefront ?? shop.summary?.shop.storefront_url ?? null

  const sections = page.data?.sections ?? []
  const selected = sections.find((section) => section.id === selectedId) ?? null
  const schema = useMemo(
    () => catalogue.data?.sections.find((item) => item.key === selected?.key) ?? null,
    [catalogue.data, selected],
  )

  useEffect(() => {
    if (selectedId === null && sections.length > 0) setSelectedId(sections[0].id)
  }, [sections, selectedId])

  // ── the preview ────────────────────────────────────────────────────────────

  /** The stage's own width, watched so the scale follows a collapsing pane. */
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width))
    observer.observe(node)
    setStageWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [])

  const deviceWidth = DEVICES[device].width
  // Never scaled up: a 390px phone blown up to 900 looks like a phone with
  // enormous type, which is a different lie from the one being avoided.
  const scale = stageWidth > 0 ? Math.min(1, (stageWidth - 48) / deviceWidth) : 1

  const post = useCallback((message: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: 'veylor-admin', ...message }, '*')
  }, [])

  const refreshPreview = useCallback(() => {
    post({ type: 'reload' })
    setSaving(false)
    setSavedAt(Date.now())
  }, [post])

  /** Clicking a band in the preview selects its row. */
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { source?: string; type?: string; sectionId?: number } | null
      if (data?.source !== 'veylor-preview') return
      if (data.type === 'ready' && event.source === frame.current?.contentWindow) setPreviewState('ready')
      if (data.type === 'select' && data.sectionId) setSelectedId(data.sectionId)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  /** And selecting a row scrolls the preview to it. */
  useEffect(() => {
    if (!selectedId) return
    const timer = setTimeout(() => post({ type: 'scroll-to', sectionId: selectedId }), 250)
    return () => clearTimeout(timer)
  }, [selectedId, post])

  // ── saving ─────────────────────────────────────────────────────────────────

  const saveSetting = useDebouncedSave<{ id: number; settings: Record<string, unknown> }>((payload) => {
    updateSection.mutate({ id: payload.id, input: { settings: payload.settings } }, { onSuccess: refreshPreview })
  })

  const saveBlock = useDebouncedSave<{ sectionId: number; blockId: number; settings: Record<string, unknown> }>(
    (payload) => updateBlock.mutate(payload, { onSuccess: refreshPreview }),
  )

  const [draft, setDraft] = useState<Record<string, unknown>>({})
  useEffect(() => setDraft({}), [selectedId])
  const settingValue = (key: string) => (key in draft ? draft[key] : selected?.settings[key])

  // ── ordering ───────────────────────────────────────────────────────────────

  function onDrop(targetId: number) {
    setDropBefore(null)
    if (dragging === null || dragging === targetId) return
    const ids = sections.map((section) => section.id)
    ids.splice(ids.indexOf(targetId), 0, ids.splice(ids.indexOf(dragging), 1)[0])
    reorder.mutate(ids, { onSuccess: refreshPreview })
    setDragging(null)
  }

  function insert(sectionKey: string) {
    const after = addingAfter === 'end' ? null : addingAfter
    setSaving(true)
    addSection.mutate(
      { sectionKey, afterSectionId: after },
      {
        onSuccess: (result) => {
          setSelectedId((result as { section_id: number }).section_id)
          refreshPreview()
        },
      },
    )
    setAddingAfter(null)
  }

  const panels = useMemo(() => {
    const fields = schema?.settings ?? []
    return PANEL_LABELS.map((panel) => ({
      ...panel,
      fields: fields.filter((field) => (field.group ?? 'content') === panel.key),
    })).filter((panel) => panel.fields.length > 0)
  }, [schema])

  return (
    <Box sx={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ── the bar ──────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
        <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
          Page builder
        </Typography>
        <Select
          size="small"
          value={templateKey}
          onChange={(event) => {
            setTemplateKey(event.target.value)
            setSelectedId(null)
          }}
          data-template-picker
          sx={{ minWidth: 150 }}
        >
          {(templates.data?.templates ?? [{ key: 'home', name: 'Home page' }]).map((template) => (
            <MenuItem key={template.key} value={template.key}>
              {template.name}
            </MenuItem>
          ))}
        </Select>

        <Box sx={{ flex: 1 }} />

        <SaveState saving={saving || updateSection.isPending} savedAt={savedAt} />

        <ToggleButtonGroup
          size="small"
          exclusive
          value={device}
          onChange={(_event, next) => next && setDevice(next)}
          data-device-picker
        >
          {(Object.keys(DEVICES) as DeviceKey[]).map((key) => {
            const { Icon, label } = DEVICES[key]
            return (
              <ToggleButton key={key} value={key} aria-label={`${label} preview`}>
                <Icon fontSize="small" />
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>

        <Tooltip title="Reload the preview">
          <IconButton size="small" onClick={refreshPreview} aria-label="Reload the preview">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {websiteUrl && (
          <Button size="small" startIcon={<OpenIcon />} href={websiteUrl} target="_blank" rel="noreferrer">
            Open storefront
          </Button>
        )}
      </Stack>

      {page.isError && <Alert severity="error">This page could not be loaded.</Alert>}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1.5 }}>
        {/* ── what is on the page ──────────────────────────────────────── */}
        <Box
          sx={{
            width: railOpen ? 288 : 44,
            flexShrink: 0,
            transition: 'width 180ms ease',
            bgcolor: tokens.paper,
            border: `1px solid ${tokens.border}`,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          data-rail
        >
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.75, flexShrink: 0 }}
          >
            {railOpen && (
              <Typography variant="subtitle2" sx={{ pl: 0.5 }}>
                Sections
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={() => setRailOpen((open) => !open)}
              aria-label={railOpen ? 'Hide the section list' : 'Show the section list'}
            >
              {railOpen ? <CollapseLeftIcon fontSize="small" /> : <CollapseRightIcon fontSize="small" />}
            </IconButton>
          </Stack>

          {railOpen && (
            <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1 }} data-section-list>
              {page.isLoading && <CircularProgress size={18} sx={{ m: 1 }} />}

              {sections.map((section) => (
                <Box key={section.id}>
                  <DropLine active={dropBefore === section.id} />
                  <SectionRow
                    section={section}
                    selected={section.id === selectedId}
                    dragging={dragging === section.id}
                    onSelect={() => setSelectedId(section.id)}
                    onHover={(over) => post({ type: 'highlight', sectionId: over ? section.id : null })}
                    onDragStart={() => setDragging(section.id)}
                    onDragOver={() => setDropBefore(section.id)}
                    onDrop={() => onDrop(section.id)}
                    onMenu={(anchor) => setMenuFor({ id: section.id, anchor })}
                    onInsert={() => setAddingAfter(section.id)}
                  />
                </Box>
              ))}

              <Button
                fullWidth
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddingAfter('end')}
                data-add-at-end
                sx={{ mt: 1, justifyContent: 'center' }}
              >
                Add section
              </Button>
            </Box>
          )}
        </Box>

        {/* ── the page itself ──────────────────────────────────────────── */}
        <Box
          ref={stage}
          data-preview-stage
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: tokens.rail,
            border: `1px solid ${tokens.border}`,
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* The frame is the real device width and the wrapper scales it.
              Sizing the frame to the pane instead would fire every responsive
              rule at the wrong breakpoint — a preview of a page nobody sees. */}
          {storefront && (
            <Box
              sx={{
                width: deviceWidth * scale,
                height: '100%',
                overflow: 'hidden',
                transition: 'width 180ms ease',
              }}
            >
              <iframe
                ref={frame}
                title="Storefront preview"
                src={`${storefront}/?preview=1`}
                data-preview-frame
                style={{
                  width: deviceWidth,
                  height: `${100 / scale}%`,
                  border: 'none',
                  background: '#fff',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  display: 'block',
                }}
              />
            </Box>
          )}

          {previewState === 'absent' && (
            <NoStorefrontPreview
              storefront={storefront}
              themeName={liveTheme?.name ?? null}
              websiteUrl={websiteUrl}
              onCustomize={() => navigate(liveTheme ? `/merchandising/themes/${liveTheme.id}` : '/merchandising/themes')}
            />
          )}

          {storefront && previewState !== 'absent' && scale < 1 && (
            <Chip
              size="small"
              label={`${deviceWidth}px · ${Math.round(scale * 100)}%`}
              data-preview-scale
              sx={{ position: 'absolute', bottom: 8, right: 8, bgcolor: tokens.paper }}
            />
          )}
        </Box>

        {/* ── the settings of the one being edited ─────────────────────── */}
        <Box
          sx={{
            width: panelOpen ? 372 : 44,
            flexShrink: 0,
            transition: 'width 180ms ease',
            bgcolor: tokens.paper,
            border: `1px solid ${tokens.border}`,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          data-settings-pane
        >
          <Stack direction="row" sx={{ alignItems: 'center', px: 1, py: 0.75, flexShrink: 0 }}>
            <IconButton
              size="small"
              onClick={() => setPanelOpen((open) => !open)}
              aria-label={panelOpen ? 'Hide the settings' : 'Show the settings'}
            >
              {panelOpen ? <CollapseRightIcon fontSize="small" /> : <CollapseLeftIcon fontSize="small" />}
            </IconButton>
            {panelOpen && selected && schema && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                  {schema.label}
                </Typography>
                <Tooltip title={selected.is_enabled ? 'On the page' : 'Hidden'}>
                  <Switch
                    size="small"
                    checked={selected.is_enabled}
                    onChange={(event) => {
                      setSaving(true)
                      updateSection.mutate(
                        { id: selected.id, input: { is_enabled: event.target.checked } },
                        { onSuccess: refreshPreview },
                      )
                    }}
                    slotProps={{ input: { 'aria-label': 'Show this section' } }}
                  />
                </Tooltip>
              </Stack>
            )}
          </Stack>
          <Divider />

          {panelOpen && (
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {!selected && (
                <Typography variant="body2" sx={{ color: tokens.subdued }}>
                  Choose a section on the left, or click one in the preview.
                </Typography>
              )}

              {selected && schema && (
                <Stack spacing={2}>
                  <Typography variant="caption" sx={{ color: tokens.subdued }}>
                    {schema.description}
                  </Typography>

                  {panels.map((panel) => (
                    <Panel
                      key={panel.key}
                      label={panel.label}
                      open={openPanels[panel.key] ?? false}
                      onToggle={() =>
                        setOpenPanels((current) => ({ ...current, [panel.key]: !(current[panel.key] ?? false) }))
                      }
                      count={panel.fields.length}
                    >
                      <Stack spacing={2}>
                        {panel.fields.map((field: Field) => (
                          <SchemaField
                            key={field.key}
                            field={field}
                            value={settingValue(field.key)}
                            onChange={(value) => {
                              setDraft((current) => ({ ...current, [field.key]: value }))
                              setSaving(true)
                              saveSetting({ id: selected.id, settings: { [field.key]: value } })
                            }}
                          />
                        ))}
                      </Stack>
                    </Panel>
                  ))}

                  {schema.blocks.length > 0 && (
                    <Panel
                      label={`${schema.blocks[0].label}s`}
                      open={openPanels.blocks ?? true}
                      onToggle={() => setOpenPanels((current) => ({ ...current, blocks: !(current.blocks ?? true) }))}
                      count={selected.blocks.length}
                    >
                      <Stack spacing={1.5}>
                        {selected.blocks.map((block, index) => {
                          const blockSchema = schema.blocks.find((item) => item.key === block.key)
                          if (!blockSchema) return null
                          return (
                            <Box
                              key={block.id}
                              data-builder-block={block.id}
                              sx={{ border: `1px solid ${tokens.border}`, borderRadius: 1.5, p: 1.5 }}
                            >
                              <Stack
                                direction="row"
                                sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                              >
                                <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.subdued }}>
                                  {blockSchema.label} {index + 1}
                                </Typography>
                                <IconButton
                                  size="small"
                                  aria-label={`Remove ${blockSchema.label} ${index + 1}`}
                                  onClick={() => {
                                    setSaving(true)
                                    deleteBlock.mutate(
                                      { sectionId: selected.id, blockId: block.id },
                                      { onSuccess: refreshPreview },
                                    )
                                  }}
                                >
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              </Stack>
                              <Stack spacing={1.5}>
                                {blockSchema.fields.map((field) => (
                                  <SchemaField
                                    key={field.key}
                                    field={field}
                                    value={block.settings[field.key]}
                                    onChange={(value) => {
                                      setSaving(true)
                                      saveBlock({
                                        sectionId: selected.id,
                                        blockId: block.id,
                                        settings: { [field.key]: value },
                                      })
                                    }}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          )
                        })}

                        <Stack direction="row" spacing={0.5}>
                          {schema.blocks.map((blockSchema) => (
                            <Button
                              key={blockSchema.key}
                              size="small"
                              startIcon={<AddIcon />}
                              disabled={schema.max_blocks !== null && selected.blocks.length >= schema.max_blocks}
                              onClick={() => {
                                setSaving(true)
                                addBlock.mutate(
                                  { sectionId: selected.id, blockKey: blockSchema.key },
                                  { onSuccess: refreshPreview },
                                )
                              }}
                            >
                              {blockSchema.label}
                            </Button>
                          ))}
                        </Stack>
                      </Stack>
                    </Panel>
                  )}

                  <Panel
                    label="Name and schedule"
                    open={openPanels.schedule ?? false}
                    onToggle={() =>
                      setOpenPanels((current) => ({ ...current, schedule: !(current.schedule ?? false) }))
                    }
                  >
                    <Stack spacing={2}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Name in the list"
                        defaultValue={selected.name}
                        onChange={(event) =>
                          updateSection.mutate({ id: selected.id, input: { name: event.target.value } })
                        }
                        helperText="Only you see this."
                      />
                      <Stack direction="row" spacing={1.5}>
                        <TextField
                          size="small"
                          fullWidth
                          type="datetime-local"
                          label="Show from"
                          defaultValue={forInput(selected.visible_from)}
                          onChange={(event) =>
                            updateSection.mutate(
                              { id: selected.id, input: { visible_from: event.target.value || null } },
                              { onSuccess: refreshPreview },
                            )
                          }
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                          size="small"
                          fullWidth
                          type="datetime-local"
                          label="Until"
                          defaultValue={forInput(selected.visible_until)}
                          onChange={(event) =>
                            updateSection.mutate(
                              { id: selected.id, input: { visible_until: event.target.value || null } },
                              { onSuccess: refreshPreview },
                            )
                          }
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Stack>
                      {selected.hidden_because && (
                        <Alert severity="info" sx={{ py: 0.5 }}>
                          Not on the site — {selected.hidden_because.toLowerCase()}.
                        </Alert>
                      )}
                    </Stack>
                  </Panel>
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── the row menu ─────────────────────────────────────────────────── */}
      <Menu anchorEl={menuFor?.anchor ?? null} open={menuFor !== null} onClose={() => setMenuFor(null)}>
        <MenuItem
          onClick={() => {
            if (menuFor) {
              setSaving(true)
              duplicateSection.mutate(menuFor.id, {
                onSuccess: (result) => {
                  setSelectedId((result as { section_id: number }).section_id)
                  refreshPreview()
                },
              })
            }
            setMenuFor(null)
          }}
          data-duplicate-section
        >
          <ListItemIcon>
            <DuplicateIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const section = sections.find((item) => item.id === menuFor?.id)
            if (section) {
              setSaving(true)
              updateSection.mutate(
                { id: section.id, input: { is_enabled: !section.is_enabled } },
                { onSuccess: refreshPreview },
              )
            }
            setMenuFor(null)
          }}
        >
          <ListItemIcon>
            {sections.find((item) => item.id === menuFor?.id)?.is_enabled ? (
              <HiddenIcon fontSize="small" />
            ) : (
              <ShownIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {sections.find((item) => item.id === menuFor?.id)?.is_enabled ? 'Hide' : 'Show'}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            const section = sections.find((item) => item.id === menuFor?.id)
            if (section) setConfirming(section)
            setMenuFor(null)
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Remove</ListItemText>
        </MenuItem>
      </Menu>

      <AddSectionDialog
        open={addingAfter !== null}
        catalogue={catalogue.data?.sections ?? []}
        onClose={() => setAddingAfter(null)}
        onPick={insert}
      />

      <Dialog open={confirming !== null} onClose={() => setConfirming(null)}>
        <DialogTitle>Remove this section?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            “{confirming?.name || confirming?.label}” will stop appearing on the page. Its words and pictures go with
            it.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setConfirming(null)}>Keep it</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                if (confirming) {
                  deleteSection.mutate(confirming.id, {
                    onSuccess: () => {
                      setSelectedId(null)
                      refreshPreview()
                    },
                  })
                }
                setConfirming(null)
              }}
            >
              Remove
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

/** `2026-09-23T16:00:00.000Z` → `2026-09-23T16:00`, which is what the input wants. */
function forInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * One row of the page.
 *
 * The icon is the section's kind, which is how a list of fifteen becomes
 * scannable — "the one with the picture icon" is findable, "Home — our
 * promise" is something you have to read.
 */
function SectionRow({
  section,
  selected,
  dragging,
  onSelect,
  onHover,
  onDragStart,
  onDragOver,
  onDrop,
  onMenu,
  onInsert,
}: {
  section: BuilderSection
  selected: boolean
  dragging: boolean
  onSelect: () => void
  onHover: (over: boolean) => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onMenu: (anchor: HTMLElement) => void
  onInsert: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const Icon = SECTION_ICONS[section.key] ?? SECTION_ICONS.default

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        data-builder-section={section.id}
        // Stated rather than inferred from the border colour: which row is
        // selected is a fact about the screen, and anything driving it — a
        // test, a keyboard shortcut later — should be able to read it.
        data-selected={selected ? 'true' : 'false'}
        draggable
        onDragStart={onDragStart}
        onDragOver={(event) => {
          event.preventDefault()
          onDragOver()
        }}
        onDrop={onDrop}
        onClick={onSelect}
        onMouseEnter={() => {
          setHovered(true)
          onHover(true)
        }}
        onMouseLeave={() => {
          setHovered(false)
          onHover(false)
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 0.75,
          py: 0.85,
          borderRadius: 1.5,
          cursor: 'pointer',
          border: `1px solid ${selected ? tokens.inkStrong : 'transparent'}`,
          bgcolor: selected ? tokens.hover : 'transparent',
          opacity: dragging ? 0.35 : section.is_enabled ? 1 : 0.5,
          '&:hover': { bgcolor: tokens.hover },
        }}
      >
        <DragIcon sx={{ fontSize: 15, color: hovered ? tokens.subdued : 'transparent', cursor: 'grab' }} />
        <Icon sx={{ fontSize: 17, color: selected ? tokens.inkStrong : tokens.subdued, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 600 : 400, lineHeight: 1.3 }}>
            {section.name || section.label}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.faint, display: 'block', lineHeight: 1.3 }} noWrap>
            {section.label}
          </Typography>
        </Box>
        {!section.is_enabled && (
          <Tooltip title={section.hidden_because ?? 'Hidden'}>
            <HiddenIcon sx={{ fontSize: 15, color: tokens.warning }} />
          </Tooltip>
        )}
        <IconButton
          size="small"
          aria-label={`More for ${section.name || section.label}`}
          sx={{ opacity: hovered || selected ? 1 : 0, transition: 'opacity 120ms' }}
          onClick={(event) => {
            event.stopPropagation()
            onMenu(event.currentTarget)
          }}
        >
          <MoreIcon fontSize="inherit" />
        </IconButton>
      </Box>

      {/* The insert point. Appears on hover in the gap under the row, which is
          where a person is already pointing when they think "and one here". */}
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          height: 10,
          display: 'grid',
          placeItems: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 120ms',
        }}
      >
        <IconButton
          size="small"
          data-insert-after={section.id}
          aria-label={`Add a section after ${section.name || section.label}`}
          onClick={onInsert}
          sx={{
            width: 18,
            height: 18,
            bgcolor: tokens.inkStrong,
            color: '#fff',
            '&:hover': { bgcolor: tokens.ink },
          }}
        >
          <AddIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>
    </Box>
  )
}

/** Where a dragged row would land. */
function DropLine({ active }: { active: boolean }) {
  return (
    <Box
      sx={{
        height: 2,
        my: 0.25,
        borderRadius: 1,
        bgcolor: active ? tokens.inkStrong : 'transparent',
        transition: 'background-color 120ms',
      }}
    />
  )
}

/** A collapsible group of settings. */
function Panel({
  label,
  open,
  onToggle,
  count,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 1.5, overflow: 'hidden' }} data-panel={label}>
      <Stack
        direction="row"
        onClick={onToggle}
        sx={{
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          bgcolor: open ? tokens.hover : 'transparent',
          '&:hover': { bgcolor: tokens.hover },
        }}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {label}
        </Typography>
        {count !== undefined && (
          <Typography variant="caption" sx={{ color: tokens.faint }}>
            {count}
          </Typography>
        )}
        <ExpandIcon
          fontSize="small"
          sx={{ color: tokens.subdued, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
        />
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ p: 1.5, pt: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  )
}

/**
 * "Saved", quietly.
 *
 * Nothing here has a Save button — every change is already on the server — so
 * the screen has to say so, or the author is left wondering whether to press
 * something before navigating away.
 */
function SaveState({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 15000)
    return () => clearInterval(timer)
  }, [])

  if (saving) {
    return (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }} data-save-state="saving">
        <CircularProgress size={13} />
        <Typography variant="caption" sx={{ color: tokens.subdued }}>
          Saving…
        </Typography>
      </Stack>
    )
  }
  if (!savedAt) return null
  const seconds = Math.round((Date.now() - savedAt) / 1000)
  return (
    <Typography variant="caption" sx={{ color: tokens.subdued }} data-save-state="saved">
      {seconds < 30 ? 'All changes saved' : `Saved ${seconds < 120 ? 'a minute' : `${Math.round(seconds / 60)} minutes`} ago`}
    </Typography>
  )
}

/**
 * The catalogue, searchable and grouped.
 *
 * Searchable because fifteen kinds is past the number anyone scans, and a
 * merchandiser who wants a picture beside products types "product" — matching
 * on the description as well as the name, since that is where the words they
 * would think of actually are.
 */
function AddSectionDialog({
  open,
  catalogue,
  onClose,
  onPick,
}: {
  open: boolean
  catalogue: SectionSchema[]
  onClose: () => void
  onPick: (key: string) => void
}) {
  const [term, setTerm] = useState('')
  useEffect(() => {
    if (open) setTerm('')
  }, [open])

  const groups = useMemo(() => {
    const needle = term.trim().toLowerCase()
    const matched = needle
      ? catalogue.filter(
          (schema) =>
            schema.label.toLowerCase().includes(needle) || schema.description.toLowerCase().includes(needle),
        )
      : catalogue
    const map = new Map<string, SectionSchema[]>()
    for (const schema of matched) {
      const list = map.get(schema.group) ?? []
      list.push(schema)
      map.set(schema.group, list)
    }
    return [...map.entries()]
  }, [catalogue, term])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Add a section</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search sections…"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            // Enter picks the only thing left, which is what a search box that
            // has narrowed to one result should obviously do.
            if (event.key === 'Enter' && groups.length === 1 && groups[0][1].length === 1) {
              onPick(groups[0][1][0].key)
            }
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: tokens.faint }} />
                </InputAdornment>
              ),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            htmlInput: { 'data-section-search': true },
          }}
          sx={{ mb: 2 }}
        />

        <Stack spacing={2.5}>
          {groups.map(([group, schemas]) => (
            <Box key={group}>
              <Typography
                variant="caption"
                sx={{ color: tokens.subdued, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {GROUP_LABELS[group] ?? group}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {schemas.map((schema) => {
                  const Icon = SECTION_ICONS[schema.key] ?? SECTION_ICONS.default
                  return (
                    <Stack
                      key={schema.key}
                      direction="row"
                      spacing={1.5}
                      data-add-section={schema.key}
                      onClick={() => onPick(schema.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => event.key === 'Enter' && onPick(schema.key)}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        border: `1px solid ${tokens.border}`,
                        alignItems: 'flex-start',
                        '&:hover': { borderColor: tokens.inkStrong, bgcolor: tokens.hover },
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: 1,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: tokens.rail,
                        }}
                      >
                        <Icon sx={{ fontSize: 18, color: tokens.ink }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {schema.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.subdued }}>
                          {schema.description}
                        </Typography>
                      </Box>
                    </Stack>
                  )
                })}
              </Stack>
            </Box>
          ))}

          {groups.length === 0 && (
            <Typography variant="body2" sx={{ color: tokens.subdued }}>
              Nothing matches “{term}”.
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
