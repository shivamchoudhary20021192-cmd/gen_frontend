import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  ArrowDownward as DownIcon,
  ArrowUpward as UpIcon,
  Close as RemoveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { PageHeader } from '../../../components/PageHeader'
import { LinkTargetPicker, isSearchableLinkType } from '../../../components/LinkTargetPicker'
import { tokens } from '../../../theme'
import {
  useCreateShelf,
  useShelf,
  useShelfCatalogue,
  useShelfPreview,
  useUpdateShelf,
  type ShelfInput,
} from './useShelves'

/**
 * Building one shelf.
 *
 * The form is in two halves and the split is the whole idea of the feature:
 * WHERE AND HOW on the left (the page, the layout, the words), WHAT IS IN IT
 * on the right (a rule, or a hand-picked list, or both). Underneath sits the
 * preview — what the rule chooses right now, for this catalogue, today.
 *
 * The preview is not decoration. "Most repurchased over 180 days" is an
 * abstraction until you see the four products it returns, and a merchandiser
 * who cannot see that will either not use the rules at all or use them and be
 * surprised on the front page. It also states, in words, when the rule came
 * back short and the shelf was topped up — the one thing a system like this
 * must never do quietly.
 */

const LINK_TYPES = [
  { value: 'none', label: 'Nowhere — no button' },
  { value: 'url', label: 'A web address' },
  { value: 'product', label: 'A product' },
  { value: 'category', label: 'A category' },
  { value: 'collection', label: 'A collection' },
  { value: 'page', label: 'A page' },
  { value: 'article', label: 'An article' },
  { value: 'policy', label: 'A policy' },
]

const EMPTY: ShelfInput = {
  title: '',
  eyebrow: '',
  subtitle: '',
  placement: 'home',
  scope_ref_id: null,
  layout: 'carousel',
  source: 'bestselling',
  source_collection_id: null,
  window_days: null,
  max_products: 8,
  include_sold_out: false,
  tone: 'ivory',
  cta_label: 'View all',
  link_type: 'url',
  link_url: '/shop',
  link_ref_id: null,
  starts_at: null,
  ends_at: null,
  is_active: true,
  pinned_product_ids: [],
}

/** `2026-09-22T16:00:00.000Z` → `2026-09-22T16:00`, which is what the input wants. */
function forInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ShelfFormPage() {
  const { id } = useParams()
  const shelfId = id && id !== 'new' ? Number(id) : null
  const navigate = useNavigate()

  const catalogue = useShelfCatalogue()
  const existing = useShelf(shelfId)
  const create = useCreateShelf()
  const update = useUpdateShelf()
  const preview = useShelfPreview(shelfId)

  const [form, setForm] = useState<ShelfInput>(EMPTY)
  const [pinNames, setPinNames] = useState<Record<number, string>>({})
  const [pinToAdd, setPinToAdd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const shelf = existing.data?.shelf
    if (!shelf) return
    setForm({
      title: shelf.title,
      eyebrow: shelf.eyebrow ?? '',
      subtitle: shelf.subtitle ?? '',
      placement: shelf.placement,
      scope_ref_id: shelf.scope_ref_id,
      layout: shelf.layout,
      source: shelf.source,
      source_collection_id: shelf.source_collection_id,
      window_days: shelf.window_days,
      max_products: shelf.max_products,
      include_sold_out: shelf.include_sold_out,
      tone: shelf.tone,
      cta_label: shelf.cta_label ?? '',
      link_type: shelf.link_type,
      link_url: shelf.link_url ?? '',
      link_ref_id: shelf.link_ref_id,
      starts_at: shelf.starts_at,
      ends_at: shelf.ends_at,
      is_active: shelf.is_active,
      pinned_product_ids: (shelf.pins ?? []).map((pin) => pin.product_id),
    })
    setPinNames(Object.fromEntries((shelf.pins ?? []).map((pin) => [pin.product_id, pin.name])))
  }, [existing.data])

  const sources = catalogue.data?.sources ?? []
  const rule = useMemo(() => sources.find((item) => item.key === form.source), [sources, form.source])
  const placement = catalogue.data?.placements.find((item) => item.key === form.placement)
  const ceiling = catalogue.data?.max_products_ceiling ?? 24

  function set<K extends keyof ShelfInput>(key: K, value: ShelfInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function movePin(index: number, delta: number) {
    const pins = [...(form.pinned_product_ids ?? [])]
    const target = index + delta
    if (target < 0 || target >= pins.length) return
    ;[pins[index], pins[target]] = [pins[target], pins[index]]
    set('pinned_product_ids', pins)
  }

  function submit() {
    setError(null)
    // Empty strings are sent as nulls: an eyebrow the author cleared should
    // become "no eyebrow", not the empty string, or every read of the row has
    // to know both spellings of nothing.
    const payload: ShelfInput = {
      ...form,
      eyebrow: form.eyebrow?.trim() ? form.eyebrow.trim() : null,
      subtitle: form.subtitle?.trim() ? form.subtitle.trim() : null,
      cta_label: form.cta_label?.trim() ? form.cta_label.trim() : null,
      link_url: form.link_url?.trim() ? form.link_url.trim() : null,
      scope_ref_id: placement?.scope ? form.scope_ref_id : null,
      source_collection_id: rule?.needs_collection ? form.source_collection_id : null,
      window_days: rule?.window ? form.window_days : null,
      pinned_product_ids: form.pinned_product_ids ?? [],
    }

    const onError = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'That could not be saved.')

    if (shelfId === null) {
      create.mutate(payload, {
        onSuccess: (result) => {
          navigate(`/merchandising/shelves/${result.shelf.id}`)
        },
        onError,
      })
    } else {
      update.mutate(
        { id: shelfId, input: payload },
        { onSuccess: () => void preview.refetch(), onError },
      )
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Box>
      <PageHeader
        title={shelfId === null ? 'New shelf' : form.title || 'Shelf'}
        subtitle="Where it goes, how it is drawn, and what decides which products are in it"
        back={
          <Button
            component={RouterLink}
            to="/merchandising/shelves"
            size="small"
            startIcon={<BackIcon />}
            sx={{ mb: 1 }}
          >
            Shelves
          </Button>
        }
        actions={
          <Button variant="contained" onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? 'Saving…' : shelfId === null ? 'Create shelf' : 'Save'}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* ── where and how ─────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader
              title="Where it goes"
              subheader="The page it belongs to, and how the row is drawn"
              slotProps={{ title: { variant: 'subtitle2' }, subheader: { variant: 'caption' } }}
            />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="Heading"
                  placeholder="e.g. The ones people come back for"
                  value={form.title}
                  onChange={(event) => set('title', event.target.value)}
                  size="small"
                  fullWidth
                  required
                />
                <TextField
                  label="Small line above it"
                  placeholder="e.g. Most loved"
                  value={form.eyebrow ?? ''}
                  onChange={(event) => set('eyebrow', event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Line underneath"
                  placeholder="Optional — one sentence at most"
                  value={form.subtitle ?? ''}
                  onChange={(event) => set('subtitle', event.target.value)}
                  size="small"
                  fullWidth
                />

                <FormControl size="small" fullWidth>
                  <InputLabel id="shelf-placement-label">Page</InputLabel>
                  <Select
                    labelId="shelf-placement-label"
                    label="Page"
                    value={form.placement ?? 'home'}
                    onChange={(event) => {
                      set('placement', event.target.value)
                      set('scope_ref_id', null)
                    }}
                  >
                    {(catalogue.data?.placements ?? []).map((item) => (
                      <MenuItem key={item.key} value={item.key}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Only the placements that *have* many pages ask which one. */}
                {placement?.scope && (
                  <Box>
                    <LinkTargetPicker
                      type={placement.scope}
                      value={form.scope_ref_id}
                      onChange={(value) => set('scope_ref_id', value)}
                      label={placement.scope === 'category' ? 'On which category' : 'On which collection'}
                      helperText="Leave empty to show this shelf on every one of them."
                    />
                  </Box>
                )}

                <FormControl size="small" fullWidth>
                  <InputLabel id="shelf-layout-label">Layout</InputLabel>
                  <Select
                    labelId="shelf-layout-label"
                    label="Layout"
                    value={form.layout ?? 'carousel'}
                    onChange={(event) => set('layout', event.target.value)}
                    data-shelf-layout
                  >
                    {(catalogue.data?.layouts ?? []).map((item) => (
                      <MenuItem key={item.key} value={item.key}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" sx={{ color: tokens.subdued, mt: -1 }}>
                  {catalogue.data?.layouts.find((item) => item.key === form.layout)?.description}
                </Typography>

                <FormControl size="small" fullWidth>
                  <InputLabel id="shelf-tone-label">Background</InputLabel>
                  <Select
                    labelId="shelf-tone-label"
                    label="Background"
                    value={form.tone ?? 'ivory'}
                    onChange={(event) => set('tone', event.target.value)}
                  >
                    <MenuItem value="ivory">Ivory</MenuItem>
                    <MenuItem value="cream">Cream</MenuItem>
                  </Select>
                </FormControl>

                <Divider />

                <FormControl size="small" fullWidth>
                  <InputLabel id="shelf-link-type-label">“View all” goes to</InputLabel>
                  <Select
                    labelId="shelf-link-type-label"
                    label="“View all” goes to"
                    value={form.link_type ?? 'none'}
                    onChange={(event) => {
                      set('link_type', event.target.value)
                      set('link_ref_id', null)
                      set('link_url', '')
                    }}
                  >
                    {LINK_TYPES.map((item) => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {form.link_type === 'url' && (
                  <TextField
                    label="Web address"
                    placeholder="/shop?sort=newest"
                    value={form.link_url ?? ''}
                    onChange={(event) => set('link_url', event.target.value)}
                    size="small"
                    fullWidth
                  />
                )}
                {isSearchableLinkType(form.link_type ?? 'none') && (
                  <LinkTargetPicker
                    type={(form.link_type ?? 'none') as 'product'}
                    value={form.link_ref_id}
                    onChange={(value) => set('link_ref_id', value)}
                    label="Which one"
                  />
                )}
                {form.link_type !== 'none' && (
                  <TextField
                    label="Button text"
                    placeholder="View all"
                    value={form.cta_label ?? ''}
                    onChange={(event) => set('cta_label', event.target.value)}
                    size="small"
                    fullWidth
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardHeader
              title="When"
              subheader="Leave both empty for a shelf that simply stays"
              slotProps={{ title: { variant: 'subtitle2' }, subheader: { variant: 'caption' } }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Starts"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    value={forInput(form.starts_at)}
                    onChange={(event) => set('starts_at', event.target.value || null)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Ends"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    value={forInput(form.ends_at)}
                    onChange={(event) => set('ends_at', event.target.value || null)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.is_active ?? true}
                      onChange={(event) => set('is_active', event.target.checked)}
                    />
                  }
                  label="Live on the storefront"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ── what is in it ─────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader
              title="What is in it"
              subheader="A rule the shop states once, or a list you keep by hand — or both"
              slotProps={{ title: { variant: 'subtitle2' }, subheader: { variant: 'caption' } }}
            />
            <CardContent>
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="shelf-source-label">Chosen by</InputLabel>
                  <Select
                    labelId="shelf-source-label"
                    label="Chosen by"
                    value={form.source ?? 'bestselling'}
                    onChange={(event) => {
                      set('source', event.target.value)
                      set('window_days', null)
                    }}
                    data-shelf-source
                  >
                    {sources.map((item) => (
                      <MenuItem key={item.key} value={item.key}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {rule && (
                  <Typography variant="caption" sx={{ color: tokens.subdued, mt: -1 }}>
                    {rule.description}
                  </Typography>
                )}

                {rule?.needs_collection && (
                  <LinkTargetPicker
                    type="collection"
                    value={form.source_collection_id}
                    onChange={(value) => set('source_collection_id', value)}
                    label="Which collection"
                    helperText="Smart collections work too — their membership keeps itself up to date."
                  />
                )}

                {/* The window only appears for rules that have one. A "last 30
                    days" slider under "Highest rated" would be a control that
                    does nothing, which is worse than no control. */}
                {rule?.window && (
                  <Box>
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      Counting the last {form.window_days ?? rule.window.default} days
                    </Typography>
                    <Slider
                      size="small"
                      min={rule.window.min}
                      max={rule.window.max}
                      value={form.window_days ?? rule.window.default}
                      onChange={(_event, value) => set('window_days', Number(value))}
                      valueLabelDisplay="auto"
                      aria-label="Days counted"
                      data-shelf-window
                    />
                  </Box>
                )}

                <Box>
                  <Typography variant="caption" sx={{ color: tokens.subdued }}>
                    Show up to {form.max_products ?? 8} products
                  </Typography>
                  <Slider
                    size="small"
                    min={1}
                    max={ceiling}
                    value={form.max_products ?? 8}
                    onChange={(_event, value) => set('max_products', Number(value))}
                    valueLabelDisplay="auto"
                    aria-label="How many products"
                  />
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.include_sold_out ?? false}
                      onChange={(event) => set('include_sold_out', event.target.checked)}
                    />
                  }
                  label="Include products that are sold out"
                />

                {rule && rule.key !== 'manual' && (
                  <Alert severity={rule.fallback ? 'info' : 'warning'} sx={{ py: 0.5 }}>
                    {rule.fallback
                      ? 'If this rule finds too few products, the rest are filled in and the preview below says so.'
                      : 'If this rule finds too few products, the shelf simply shows fewer — nothing is filled in.'}
                  </Alert>
                )}

                <Divider />

                {/* Pins work on automatic shelves too, which is the point. */}
                <Typography variant="subtitle2">
                  {form.source === 'manual' ? 'The products' : 'Pinned to the front'}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.subdued, mt: -1.5 }}>
                  {form.source === 'manual'
                    ? 'Exactly these, in this order.'
                    : 'These go first, in this order; the rule fills whatever is left.'}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <LinkTargetPicker
                      type="product"
                      value={pinToAdd}
                      onChange={(value) => setPinToAdd(value)}
                      label="Find a product"
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    disabled={pinToAdd === null || (form.pinned_product_ids ?? []).includes(pinToAdd)}
                    onClick={() => {
                      if (pinToAdd === null) return
                      set('pinned_product_ids', [...(form.pinned_product_ids ?? []), pinToAdd])
                      setPinToAdd(null)
                    }}
                  >
                    Add
                  </Button>
                </Stack>

                <Stack spacing={0.5} data-shelf-pins>
                  {(form.pinned_product_ids ?? []).map((productId, index) => (
                    <Stack
                      key={productId}
                      direction="row"
                      spacing={0.5}
                      sx={{
                        alignItems: 'center',
                        border: `1px solid ${tokens.border}`,
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                      }}
                    >
                      <Chip size="small" label={index + 1} />
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {pinNames[productId] ?? `Product #${productId}`}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`Move pin ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => movePin(index, -1)}
                      >
                        <UpIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Move pin ${index + 1} down`}
                        disabled={index === (form.pinned_product_ids ?? []).length - 1}
                        onClick={() => movePin(index, 1)}
                      >
                        <DownIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Remove pin ${index + 1}`}
                        onClick={() =>
                          set(
                            'pinned_product_ids',
                            (form.pinned_product_ids ?? []).filter((value) => value !== productId),
                          )
                        }
                      >
                        <RemoveIcon fontSize="inherit" />
                      </IconButton>
                    </Stack>
                  ))}
                  {(form.pinned_product_ids ?? []).length === 0 && (
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      Nothing pinned.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ── the preview ───────────────────────────────────────────────── */}
        <Grid size={12}>
          <Card variant="outlined">
            <CardHeader
              title="What this shelf shows right now"
              subheader={
                shelfId === null
                  ? 'Create the shelf to see what its rule chooses'
                  : 'Run against today’s catalogue, the moment you ask'
              }
              slotProps={{ title: { variant: 'subtitle2' }, subheader: { variant: 'caption' } }}
              action={
                shelfId !== null && (
                  <IconButton
                    onClick={() => void preview.refetch()}
                    aria-label="Refresh the preview"
                    disabled={preview.isFetching}
                  >
                    <RefreshIcon />
                  </IconButton>
                )
              }
            />
            <CardContent>
              {shelfId === null && (
                <Typography variant="body2" sx={{ color: tokens.subdued }}>
                  Save the shelf first — the preview runs the rule against the shop’s own data.
                </Typography>
              )}
              {preview.isFetching && <CircularProgress size={20} />}
              {preview.data && !preview.isFetching && (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                    <Chip
                      size="small"
                      color="primary"
                      label={`${preview.data.preview.products.length} shown`}
                      data-preview-count
                    />
                    {preview.data.preview.from_pins > 0 && (
                      <Chip size="small" label={`${preview.data.preview.from_pins} pinned`} />
                    )}
                    {preview.data.preview.from_rule > 0 && (
                      <Chip size="small" label={`${preview.data.preview.from_rule} from the rule`} />
                    )}
                    {preview.data.preview.from_fallback > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        data-preview-fallback
                        label={`${preview.data.preview.from_fallback} filled in`}
                      />
                    )}
                  </Stack>

                  {/* The honest sentence. A shelf topped up from another rule
                      looks exactly like one the rule filled by itself, and the
                      only place that difference can be told is here. */}
                  {preview.data.preview.from_fallback > 0 && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      This rule found only {preview.data.preview.from_rule} product
                      {preview.data.preview.from_rule === 1 ? '' : 's'}, so the shelf was filled up with
                      {preview.data.preview.fallback === 'newest'
                        ? ' the newest'
                        : preview.data.preview.fallback === 'rating'
                          ? ' the best rated'
                          : ' best sellers'}
                      . Narrow the shelf, widen the window, or wait for the data.
                    </Alert>
                  )}
                  {preview.data.preview.shortfall > 0 && preview.data.preview.from_fallback === 0 && (
                    <Alert severity="info" sx={{ py: 0.5 }}>
                      {preview.data.preview.shortfall} fewer than asked for — this rule leaves the shelf
                      short rather than filling it with products that do not qualify.
                    </Alert>
                  )}

                  <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
                    {preview.data.preview.products.map((product, index) => (
                      <Box
                        key={product.id}
                        data-preview-product={product.id}
                        sx={{ width: 120, flexShrink: 0 }}
                      >
                        <Box
                          sx={{
                            position: 'relative',
                            aspectRatio: '3 / 4',
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: tokens.hover,
                          }}
                        >
                          {product.image && (
                            <Box
                              component="img"
                              src={product.image}
                              alt={product.image_alt}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          )}
                          <Chip
                            size="small"
                            label={index + 1}
                            sx={{ position: 'absolute', top: 4, left: 4, height: 20 }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }} noWrap>
                          {product.name}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>

                  {preview.data.preview.products.length === 0 && (
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      Nothing qualifies today, so this shelf will not appear on the storefront at all.
                    </Typography>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
