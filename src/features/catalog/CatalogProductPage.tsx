import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Link,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { RichTextEditor } from '../content/pages/RichTextEditor'
import { MediaPicker } from '../media/MediaPicker'
import { emptyForm, formFromProduct, payloadOf, type FormState } from './editorState'
import { FieldInput } from './FieldInput'
import { STATUS_LABEL, type CatalogStatus, type Category, type Definition } from './types'
import {
  detailErrors,
  useBlankProduct,
  useCatalogProduct,
  useDeleteCatalogProduct,
  useDuplicateCatalogProduct,
  useSaveCatalogProduct,
  useSuggestions,
  useTaxonomy,
} from './useCatalog'
import { VariantDetails, VariantsCard } from './VariantsCard'

const NO_FIELDS = { product: [] as Definition[], variant: [] as Definition[] }

/** Does this definition show for a product of this type and category? (the API's appliesTo) */
function applies(definition: Definition, form: FormState): boolean {
  const constraints = definition.constraints
  if (!constraints) return true
  const types = constraints.product_types ?? []
  const categories = constraints.categories ?? []
  if (types.length === 0 && categories.length === 0) return true
  const type = form.product_type.trim().toLowerCase()
  const code = form.category?.code ?? ''
  return types.some((t) => t.toLowerCase() === type) || categories.some((c) => code === c || code.startsWith(`${c}/`))
}

export function CatalogProductPage() {
  const { id: rawId } = useParams()
  const id = rawId && rawId !== 'new' ? Number(rawId) : null
  const navigate = useNavigate()
  const { can } = useAuth()
  const { flash, success, error: flashError, clear } = useFlash()

  const loaded = useCatalogProduct(id ?? undefined)
  const blank = useBlankProduct(id === null)
  const save = useSaveCatalogProduct(id)
  const remove = useDeleteCatalogProduct()
  const duplicate = useDuplicateCatalogProduct()

  const [form, setFormState] = useState<FormState>(emptyForm)
  const [initial, setInitial] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ title: string; body: string; conflict?: boolean } | null>(null)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const product = loaded.data?.product ?? null
  const fields = useMemo(() => loaded.data?.fields ?? blank.data?.fields ?? NO_FIELDS, [loaded.data, blank.data])
  const locations = product?.locations ?? blank.data?.locations ?? []
  const canEdit = id ? can('products.update') : can('products.create')

  // The server's copy goes into the form when it loads, and again after each
  // save (a new version) — during render, keyed so it happens once per version.
  const serverKey = product ? `${product.id}:${product.version}` : id === null ? 'new' : null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  if (serverKey && serverKey !== loadedKey) {
    const next = product ? formFromProduct(product) : emptyForm()
    setLoadedKey(serverKey)
    setFormState(next)
    setInitial(JSON.stringify(payloadOf(next, null, fields)))
  }

  const setForm = (update: (current: FormState) => FormState) => setFormState((current) => update(current))
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setFormState((current) => ({ ...current, [key]: value }))
  const payload = useMemo(() => payloadOf(form, null, fields), [form, fields])
  const dirty = JSON.stringify(payload) !== initial

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const productFields = fields.product.filter((definition) => applies(definition, form))
  const pinned = productFields.filter((definition) => definition.pinned).sort((a, b) => (a.pinned_position ?? 0) - (b.pinned_position ?? 0))
  const unpinned = productFields.filter((definition) => !definition.pinned)
  const single = form.options.length === 0 ? form.variants[0] : null

  const submit = () => {
    setErrors({})
    setBanner(null)
    save.mutate(payloadOf(form, product?.version ?? null, fields), {
      onSuccess: (data) => {
        success(id ? 'Product saved' : 'Product created')
        if (!id) navigate(`/catalog/products/${data.product.id}`, { replace: true })
      },
      onError: (caught) => {
        if (caught instanceof ApiError && caught.code === 'VERSION_CONFLICT') {
          setBanner({ title: 'Someone else saved this product', body: 'Reload to see their changes, then make yours again.', conflict: true })
          return
        }
        const found = detailErrors(caught)
        setErrors(found)
        setBanner({ title: Object.keys(found).length ? 'Some fields need attention' : 'The product was not saved', body: errorMessage(caught) })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    })
  }

  if (id && loaded.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (id && loaded.isError) return <Alert severity="error">{errorMessage(loaded.error, 'This product could not be loaded.')}</Alert>

  const moveMedia = (from: number, to: number) => {
    if (to < 0 || to >= form.media.length) return
    const next = [...form.media]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    set('media', next)
  }

  return (
    <Box>
      <PageHeader
        back={
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/catalog/products')} sx={{ mb: 1, ml: -1 }}>
            Products (new)
          </Button>
        }
        title={id ? form.title || product?.title || 'Product' : 'Add product'}
        subtitle={product ? `/products/${product.handle}${product.origin === 'classic' ? ' · moved from Products (classic)' : ''}` : 'Draft until you make it active'}
        actions={
          <>
            {id && (
              <IconButton aria-label="More actions" onClick={(event) => setMenu(event.currentTarget)}>
                <MoreHorizIcon />
              </IconButton>
            )}
            {dirty && id && (
              <Button onClick={() => product && setFormState(formFromProduct(product))} disabled={save.isPending}>
                Discard
              </Button>
            )}
            <Button variant="contained" onClick={submit} disabled={!canEdit || save.isPending || (!dirty && Boolean(id))}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          disabled={!can('products.create') || duplicate.isPending}
          onClick={() => {
            setMenu(null)
            if (!id) return
            duplicate.mutate({ id }, { onSuccess: (data) => navigate(`/catalog/products/${data.product.id}`), onError: (caught) => flashError(errorMessage(caught)) })
          }}
        >
          <ListItemText primary="Duplicate" secondary="A draft copy with new SKUs and no stock" />
        </MenuItem>
        <MenuItem
          disabled={!can('products.delete')}
          onClick={() => {
            setMenu(null)
            setConfirmDelete(true)
          }}
        >
          <ListItemText primary="Delete product" slotProps={{ primary: { color: 'error' } }} />
        </MenuItem>
      </Menu>

      {banner && (
        <Alert
          severity={banner.conflict ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setBanner(null)}
          action={
            banner.conflict ? (
              <Button color="inherit" size="small" onClick={() => void loaded.refetch().then(() => setBanner(null))}>
                Reload
              </Button>
            ) : undefined
          }
        >
          <AlertTitle>{banner.title}</AlertTitle>
          {banner.body}
          {!banner.conflict && Object.keys(errors).length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {Object.entries(errors)
                .slice(0, 8)
                .map(([path, message]) => (
                  <li key={path}>
                    <Typography variant="body2">{message}</Typography>
                  </li>
                ))}
            </Box>
          )}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Title" placeholder="Short-sleeve linen shirt" value={form.title} onChange={(event) => set('title', event.target.value)} error={Boolean(errors.title)} helperText={errors.title} disabled={!canEdit} required />
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
                    Description
                  </Typography>
                  <RichTextEditor key={product?.version ?? 'new'} content={form.description_html} onChange={(html) => set('description_html', html)} disabled={!canEdit} error={Boolean(errors.description_html)} helperText={errors.description_html} />
                </Box>
                <TextField label="Short description" value={form.summary} onChange={(event) => set('summary', event.target.value)} disabled={!canEdit} helperText="Product cards, search results and feeds. Up to 500 characters." slotProps={{ htmlInput: { maxLength: 500 } }} multiline minRows={2} />
              </Stack>
            </CardContent>
          </Card>

          <SectionCard
            title="Media"
            description="The first image is the main one. Images can be picked for each variant."
            actions={
              <Button size="small" onClick={() => setMediaOpen(true)} disabled={!canEdit}>
                Add media
              </Button>
            }
          >
            {errors.media && <Alert severity="error" sx={{ mb: 1 }}>{errors.media}</Alert>}
            {form.media.length === 0 ? (
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, py: 4, textAlign: 'center' }}>
                <Button onClick={() => setMediaOpen(true)} disabled={!canEdit}>
                  Add images or video
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1.5 }}>
                {form.media.map((item, index) => (
                  <Box key={item.media_id} sx={{ position: 'relative', border: 1, borderColor: index === 0 ? 'primary.main' : 'divider', borderRadius: 1, overflow: 'hidden', aspectRatio: '1', bgcolor: 'action.hover' }}>
                    {item.url && <Box component="img" src={item.url} alt={item.alt ?? ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <Stack direction="row" sx={{ position: 'absolute', bottom: 2, left: 2, right: 2, justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.85)', borderRadius: 0.5 }}>
                      <IconButton size="small" aria-label="Move earlier" onClick={() => moveMedia(index, index - 1)} disabled={!canEdit || index === 0}>
                        <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                      <IconButton size="small" aria-label="Remove" onClick={() => set('media', form.media.filter((other) => other.media_id !== item.media_id))} disabled={!canEdit}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton size="small" aria-label="Move later" onClick={() => moveMedia(index, index + 1)} disabled={!canEdit || index === form.media.length - 1}>
                        <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>

          {single && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <VariantDetails
                  variant={single}
                  index={0}
                  errors={errors}
                  locations={locations}
                  media={form.media}
                  variantFields={[]}
                  disabled={!canEdit}
                  onChange={(patch) => setForm((current) => ({ ...current, variants: current.variants.map((variant, at) => (at === 0 ? { ...variant, ...patch } : variant)) }))}
                  sections={['pricing', 'inventory', 'shipping']}
                />
              </CardContent>
            </Card>
          )}

          <VariantsCard form={form} setForm={setForm} errors={errors} locations={locations} variantFields={fields.variant} disabled={!canEdit} />

          <SectionCard
            title="Custom fields"
            description={
              <>
                Details of your own, for any kind of product.{' '}
                <Link component={RouterLink} to="/catalog/custom-fields">
                  Manage fields
                </Link>
              </>
            }
          >
            {productFields.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No fields yet. Add fields like material, care instructions or a size chart in Custom fields, and they show here.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {[...pinned, ...unpinned].map((definition) => (
                  <FieldInput
                    key={definition.id}
                    field={definition}
                    value={form.metafields[definition.full_key] ?? null}
                    onChange={(value) => set('metafields', { ...form.metafields, [definition.full_key]: value })}
                    error={errors[`metafields.${definition.full_key}`]}
                    disabled={!canEdit}
                  />
                ))}
              </Stack>
            )}
            {single && fields.variant.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <VariantDetails
                  variant={single}
                  index={0}
                  errors={errors}
                  locations={locations}
                  media={form.media}
                  variantFields={fields.variant}
                  disabled={!canEdit}
                  onChange={(patch) => setForm((current) => ({ ...current, variants: current.variants.map((variant, at) => (at === 0 ? { ...variant, ...patch } : variant)) }))}
                  sections={['fields']}
                />
              </Box>
            )}
          </SectionCard>

          <SectionCard title="Search engine listing" description="How the product shows in Google and when shared.">
            <Stack spacing={2}>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: '#1a0dab' }}>
                  {form.seo_title || form.title || 'Product title'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#006621', display: 'block' }}>
                  /products/{form.handle || product?.handle || 'handle'}
                </Typography>
                <Typography variant="caption">{form.seo_description || form.summary || 'A description from the product’s own text.'}</Typography>
              </Box>
              <TextField label="Page title" value={form.seo_title} onChange={(event) => set('seo_title', event.target.value)} disabled={!canEdit} helperText={`${form.seo_title.length} of 70 characters used`} />
              <TextField label="Meta description" value={form.seo_description} onChange={(event) => set('seo_description', event.target.value)} disabled={!canEdit} multiline minRows={2} helperText={`${form.seo_description.length} of 320 characters used`} slotProps={{ htmlInput: { maxLength: 320 } }} />
              <TextField label="URL handle" value={form.handle} onChange={(event) => set('handle', event.target.value)} disabled={!canEdit} helperText={errors.handle ?? 'Made from the title if left empty'} error={Boolean(errors.handle)} />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="Status">
            <TextField select fullWidth size="small" value={form.status} onChange={(event) => set('status', event.target.value as CatalogStatus)} disabled={!canEdit}>
              {(['active', 'draft', 'unlisted', 'archived'] as CatalogStatus[]).map((status) => (
                <MenuItem key={status} value={status}>
                  <ListItemText
                    primary={STATUS_LABEL[status]}
                    secondary={
                      { active: 'Sold on the store', draft: 'Hidden until it is ready', unlisted: 'Sold by direct link only, not listed or searched', archived: 'Kept for records, not sold' }[status]
                    }
                  />
                </MenuItem>
              ))}
            </TextField>
          </SectionCard>

          <SectionCard title="Product organisation">
            <Stack spacing={2}>
              <CategoryPicker value={form.category} onChange={(category) => set('category', category)} disabled={!canEdit} error={errors.category_code} />
              <SuggestField field="product_type" label="Type" value={form.product_type} onChange={(value) => set('product_type', value)} disabled={!canEdit} helperText="Your own grouping, e.g. T-shirt. Custom fields can show only for a type." />
              <SuggestField field="vendor" label="Vendor" value={form.vendor} onChange={(value) => set('vendor', value)} disabled={!canEdit} />
              <FieldInput
                field={{ name: 'Collections', type: 'list.collection_reference', validations: {}, description: errors.collection_ids ?? 'Manual collections. Automatic ones pick products by their rules.' }}
                value={form.collection_ids}
                onChange={(value) => set('collection_ids', (Array.isArray(value) ? value : []).map(Number))}
                error={errors.collection_ids}
                disabled={!canEdit}
              />
              <TagsField value={form.tags} onChange={(tags) => set('tags', tags)} disabled={!canEdit} />
            </Stack>
          </SectionCard>

          <SectionCard title="Theme template">
            <TextField
              fullWidth
              size="small"
              label="Template suffix"
              placeholder="Default product"
              value={form.template_suffix}
              onChange={(event) => set('template_suffix', event.target.value)}
              disabled={!canEdit}
              error={Boolean(errors.template_suffix)}
              helperText={errors.template_suffix ?? 'Use templates/product.<suffix>.liquid or .json from the theme'}
            />
          </SectionCard>
        </Grid>
      </Grid>

      <MediaPicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        multiple
        defaultMediaType=""
        initialSelectedIds={form.media.map((item) => item.media_id)}
        title="Add product media"
        confirmLabel="Add"
        onSelect={(picked) => {
          const have = new Set(form.media.map((item) => item.media_id))
          set('media', [...form.media, ...picked.filter((item) => !have.has(item.id)).map((item) => ({ media_id: item.id, alt: item.alt_text ?? null, url: item.url }))])
          setMediaOpen(false)
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this product?"
        body="It leaves the store and both product lists. Past orders keep their lines."
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          id &&
          remove.mutate(id, {
            onSuccess: () => navigate('/catalog/products'),
            onError: (caught) => {
              setConfirmDelete(false)
              flashError(errorMessage(caught))
            },
          })
        }
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

function SuggestField({ field, label, value, onChange, disabled, helperText }: { field: 'vendor' | 'product_type'; label: string; value: string; onChange(value: string): void; disabled?: boolean; helperText?: string }) {
  const suggestions = useSuggestions(field, value)
  return (
    <Autocomplete
      freeSolo
      options={suggestions.data?.values ?? []}
      inputValue={value}
      onInputChange={(_event, next) => onChange(next)}
      disabled={disabled}
      renderInput={(params) => <TextField {...params} size="small" label={label} helperText={helperText} />}
    />
  )
}

function TagsField({ value, onChange, disabled }: { value: string[]; onChange(value: string[]): void; disabled?: boolean }) {
  const [input, setInput] = useState('')
  const suggestions = useSuggestions('tag', input)
  return (
    <Autocomplete
      multiple
      freeSolo
      options={(suggestions.data?.values ?? []).filter((tag) => !value.some((have) => have.toLowerCase() === tag.toLowerCase()))}
      value={value}
      inputValue={input}
      onInputChange={(_event, next) => {
        // A comma ends a tag, as in Shopify.
        if (next.includes(',')) {
          const parts = next.split(',').map((part) => part.trim()).filter(Boolean)
          onChange([...value, ...parts.filter((part) => !value.some((have) => have.toLowerCase() === part.toLowerCase()))])
          setInput('')
        } else setInput(next)
      }}
      onChange={(_event, next) => onChange(next.map(String))}
      disabled={disabled}
      renderValue={(tags, getItemProps) => tags.map((tag, index) => <Chip {...getItemProps({ index })} key={tag} size="small" label={tag} />)}
      renderInput={(params) => <TextField {...params} size="small" label="Tags" placeholder={value.length ? '' : 'summer, linen'} />}
    />
  )
}

/** The standard category tree: search it, or walk it level by level. */
function CategoryPicker({ value, onChange, disabled, error }: { value: Category | null; onChange(value: Category | null): void; disabled?: boolean; error?: string }) {
  const [input, setInput] = useState('')
  const [parent, setParent] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)
  const typed = input && input !== value?.full_name ? input : ''
  const tree = useTaxonomy(typed, parent?.code ?? null)
  const options = tree.data?.categories ?? []
  return (
    <Box>
      <Autocomplete<Category, false, false, false>
        open={open}
        onOpen={() => setOpen(true)}
        onClose={(_event, reason) => reason !== 'selectOption' && setOpen(false)}
        options={options}
        loading={tree.isFetching}
        filterOptions={(all) => all}
        value={value}
        getOptionLabel={(option) => option.full_name}
        isOptionEqualToValue={(option, current) => option.code === current.code}
        inputValue={open ? input : (value?.full_name ?? '')}
        onInputChange={(_event, next, reason) => reason === 'input' && setInput(next)}
        onChange={(_event, next) => {
          if (next && next.is_leaf === false && !typed) {
            // A branch opens its children; pick it with the button beside it.
            setParent(next)
            return
          }
          onChange(next)
          setParent(null)
          setInput('')
          setOpen(false)
        }}
        disabled={disabled}
        renderOption={(props, option) => (
          <li {...props} key={option.code}>
            <Stack direction="row" sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2">{typed ? option.full_name : option.name}</Typography>
              </Box>
              {option.is_leaf === false && !typed && (
                <Tooltip title="Choose this category itself">
                  <Button
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation()
                      onChange(option)
                      setParent(null)
                      setOpen(false)
                    }}
                  >
                    Select
                  </Button>
                </Tooltip>
              )}
            </Stack>
          </li>
        )}
        slotProps={{
          listbox: {
            // Walking back up the tree sits above the list.
            component: (props: React.HTMLAttributes<HTMLElement>) => (
              <Box component="ul" {...props}>
                {parent && !typed && (
                  <Box component="li" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <Button size="small" startIcon={<ArrowBackIcon />} onMouseDown={(event) => event.preventDefault()} onClick={() => setParent(null)}>
                      {parent.full_name}
                    </Button>
                  </Box>
                )}
                {props.children}
              </Box>
            ),
          },
        }}
        renderInput={(params) => <TextField {...params} size="small" label="Category" placeholder="Search categories" error={Boolean(error)} helperText={error ?? 'A standard category: used for tax, marketplaces and search.'} />}
      />
    </Box>
  )
}
