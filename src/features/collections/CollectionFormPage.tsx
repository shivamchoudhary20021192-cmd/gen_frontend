import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ThemeTemplateCard } from '../merchandising/themes/ThemeTemplateCard'
import { ApiError } from '../../api/client'
import type { ProductSummary } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { formatMoney } from '../../lib/format'
import { MediaPicker } from '../media/MediaPicker'
import { useMediaItem } from '../media/useMedia'
import { useProductList } from '../products/useProducts'
import { thumbUrl } from '../../lib/mediaUrl'
import {
  useCollection,
  useCollectionMembers,
  useCreateCollection,
  useDeleteCollection,
  useRecalculateCollection,
  useSetCollectionProducts,
  useUpdateCollection,
  type CollectionRule,
  type CollectionType,
  type SortType,
} from './useCollections'

/**
 * The rule vocabulary, mirrored from the server's `ruleCompiler`.
 *
 * The server is the authority — it refuses a field it doesn't know — but the
 * form needs to know which operators make sense for which field, otherwise it
 * offers "contains" on a price and turns a typo into a 422.
 */
const RULE_FIELDS: { value: string; label: string; kind: 'text' | 'number' | 'boolean' | 'date' }[] = [
  { value: 'title', label: 'Product title', kind: 'text' },
  { value: 'tag', label: 'Tag', kind: 'text' },
  { value: 'category', label: 'Category (slug)', kind: 'text' },
  { value: 'brand', label: 'Brand (slug)', kind: 'text' },
  { value: 'skin_type', label: 'Skin type (slug)', kind: 'text' },
  { value: 'concern', label: 'Concern (slug)', kind: 'text' },
  { value: 'price', label: 'Price', kind: 'number' },
  { value: 'rating', label: 'Rating', kind: 'number' },
  { value: 'inventory_quantity', label: 'Inventory on hand', kind: 'number' },
  { value: 'is_new', label: 'Is new', kind: 'boolean' },
  { value: 'is_bestseller', label: 'Is bestseller', kind: 'boolean' },
  { value: 'created_at', label: 'Created date', kind: 'date' },
]

const TEXT_OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
]

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
]

function operatorsFor(field: string) {
  const kind = RULE_FIELDS.find((f) => f.value === field)?.kind ?? 'text'
  if (kind === 'number' || kind === 'date') return NUMBER_OPERATORS
  if (kind === 'boolean') return [{ value: 'equals', label: 'is' }]
  return TEXT_OPERATORS
}

const SORT_TYPES: { value: SortType; label: string }[] = [
  { value: 'manual', label: 'Manual order' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
  { value: 'title_asc', label: 'Title, A–Z' },
  { value: 'rating_desc', label: 'Highest rated' },
]

const EMPTY_RULE: CollectionRule = { field: 'tag', operator: 'equals', value: '' }

export function CollectionFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new' || id === undefined
  const collectionId = isNew ? undefined : Number(id)
  const navigate = useNavigate()
  const { can } = useAuth()
  const canEdit = can('products.update')

  const query = useCollection(collectionId)
  const members = useCollectionMembers(collectionId)
  const create = useCreateCollection()
  const update = useUpdateCollection(collectionId ?? 0)
  const remove = useDeleteCollection()
  const recalculate = useRecalculateCollection()
  const setProducts = useSetCollectionProducts(collectionId ?? 0)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CollectionType>('manual')
  const [matchCondition, setMatchCondition] = useState<'all' | 'any'>('all')
  const [sortType, setSortType] = useState<SortType>('manual')
  const [isActive, setIsActive] = useState(true)
  const [showInMenu, setShowInMenu] = useState(false)
  const [rules, setRules] = useState<CollectionRule[]>([{ ...EMPTY_RULE }])
  const [selected, setSelected] = useState<ProductSummary[]>([])
  const [slug, setSlug] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [imageMediaId, setImageMediaId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Only load the product feed when it can actually be used.
  const productFeed = useProductList({ limit: 200, sort: 'name:asc' })
  const productOptions = useMemo(() => productFeed.data?.products ?? [], [productFeed.data])

  const collection = query.data?.collection

  useEffect(() => {
    if (!collection) return
    setTitle(collection.title)
    setSubtitle(collection.subtitle ?? '')
    setDescription(collection.description ?? '')
    setType(collection.collection_type)
    setMatchCondition(collection.match_condition)
    setSortType(collection.sort_type)
    setIsActive(collection.is_active)
    setShowInMenu(collection.show_in_menu)
    setSlug(collection.slug)
    setMetaTitle(collection.meta_title ?? '')
    setMetaDescription(collection.meta_description ?? '')
    setImageMediaId(collection.image_media_id)
    setRules(collection.rules?.length ? collection.rules.map((r) => ({ ...r })) : [{ ...EMPTY_RULE }])
  }, [collection])

  useEffect(() => {
    if (!members.data || collection?.collection_type !== 'manual') return
    setSelected(members.data.products)
  }, [members.data, collection])

  const busy = create.isPending || update.isPending || setProducts.isPending

  const save = async () => {
    setError(null)
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      match_condition: matchCondition,
      sort_type: sortType,
      is_active: isActive,
      show_in_menu: showInMenu,
      image_media_id: imageMediaId,
      meta_title: metaTitle.trim() || null,
      meta_description: metaDescription.trim() || null,
      // The API uniquifies a slug, so sending the unchanged one is a no-op
      // rather than a rename — but only send it when the admin actually typed.
      ...(!isNew && slug.trim() && slug.trim() !== collection?.slug ? { slug: slug.trim() } : {}),
      ...(type === 'automatic'
        ? { rules: rules.filter((rule) => rule.field && rule.value !== '') }
        : {}),
    }

    try {
      if (isNew) {
        const created = await create.mutateAsync({
          ...payload,
          collection_type: type,
          ...(type === 'manual' ? { product_ids: selected.map((p) => p.id) } : {}),
        })
        setToast(
          type === 'automatic'
            ? `Collection created — ${created.collection.product_count} products matched`
            : 'Collection created',
        )
        // Navigate to collections listing after successful creation
        navigate('/collections')
        return
      }

      await update.mutateAsync(payload)
      // Membership is a separate resource; only a manual collection owns it.
      if (type === 'manual') await setProducts.mutateAsync(selected.map((p) => p.id))
      await query.refetch()
      await members.refetch()
      setToast('Saved')
      // Stays on the record. Saving is not leaving: the refetches above exist so
      // the form can show what was just written, and bouncing to the list threw
      // you out of the collection every time you adjusted SEO or its order.
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the collection.')
    }
  }

  /**
   * Reorder within the picked list. Position is derived from array index on
   * save, so moving a chip here is the whole change — no separate reorder call
   * to get out of sync with what is on screen.
   */
  const moveProduct = (index: number, direction: -1 | 1) => {
    const next = [...selected]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSelected(next)
  }

  const runRecalculate = () => {
    if (!collectionId) return
    recalculate.mutate(collectionId, {
      onSuccess: (data) => {
        setToast(`${data.product_count} products matched`)
        void query.refetch()
        void members.refetch()
      },
      onError: (caught) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not recalculate.'),
    })
  }

  const destroy = () => {
    if (!collectionId) return
    remove.mutate(collectionId, {
      onSuccess: () => navigate('/collections'),
      onError: (caught) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not delete the collection.'),
    })
  }

  if (!isNew && query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        back={
          <Button
            size="small"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/collections')}
            sx={{ mb: 1, ml: -1 }}
          >
            Collections
          </Button>
        }
        title={isNew ? 'New collection' : title || 'Collection'}
        subtitle={
          isNew
            ? undefined
            : `${collection?.product_count ?? 0} products · /${collection?.slug ?? ''}`
        }
        actions={
          <Stack direction="row" spacing={1}>
            {!isNew && type === 'automatic' && (
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={runRecalculate}
                disabled={recalculate.isPending}
              >
                Recalculate
              </Button>
            )}
            {canEdit && (
              <Button variant="contained" onClick={save} disabled={busy || title.trim().length === 0}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            )}
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    fullWidth
                    placeholder="Brightening edit"
                  />
                  <TextField
                    label="Subtitle"
                    placeholder="Everything for a brighter, more even tone"
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    fullWidth
                    helperText="Shown under the title on the storefront."
                  />
                  <TextField
                    label="Description"
                    placeholder="What ties these products together, in the customer's words."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Products"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                subheader={
                  type === 'manual'
                    ? 'Pick products by hand. Order follows the order you add them.'
                    : 'Chosen automatically from the rules below.'
                }
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={type}
                    onChange={(_, next: CollectionType | null) => {
                      if (!next || !isNew) return
                      setType(next)
                    }}
                  >
                    <ToggleButton value="manual">Manual</ToggleButton>
                    <ToggleButton value="automatic">Automatic</ToggleButton>
                  </ToggleButtonGroup>

                  {!isNew && (
                    <Typography variant="caption" color="text.secondary">
                      A collection's type is fixed after it is created — switching it would silently
                      throw away either the hand-picked list or the rules.
                    </Typography>
                  )}

                  {type === 'manual' ? (
                    <>
                    <Autocomplete
                      multiple
                      options={productOptions}
                      value={selected}
                      loading={productFeed.isLoading}
                      disabled={!canEdit}
                      onChange={(_, next) => setSelected(next)}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      // Two rows can share a display name; the id is the only safe key.
                      getOptionKey={(option) => option.id}
                      renderOption={(props, option) => {
                        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & {
                          key: string
                        }
                        return (
                          <Box component="li" key={key} {...rest}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2">{option.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.status}
                                {option.min_price !== null && ` · ${formatMoney(option.min_price)}`}
                              </Typography>
                            </Box>
                          </Box>
                        )
                      }}
                      renderValue={(value, getItemProps) =>
                        value.map((option, index) => {
                          const { key, ...rest } = getItemProps({ index })
                          return <Chip key={key} label={option.name} size="small" {...rest} />
                        })
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Products in this collection"
                          placeholder={selected.length === 0 ? 'Search products…' : ''}
                          helperText={`${selected.length} selected`}
                        />
                      )}
                    />

                    {sortType === 'manual' && selected.length > 1 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Storefront order — this is the sequence customers see.
                        </Typography>
                        <Stack
                          spacing={0}
                          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                        >
                          {selected.map((product, index) => (
                            <Stack
                              key={product.id}
                              direction="row"
                              spacing={1}
                              sx={{
                                alignItems: 'center',
                                px: 1,
                                py: 0.5,
                                borderTop: index === 0 ? 0 : 1,
                                borderColor: 'divider',
                              }}
                            >
                              <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>
                                {index + 1}
                              </Typography>
                              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                                {product.name}
                              </Typography>
                              <IconButton
                                size="small"
                                aria-label={`Move ${product.name} up`}
                                disabled={index === 0 || !canEdit}
                                onClick={() => moveProduct(index, -1)}
                              >
                                <ArrowUpwardIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label={`Move ${product.name} down`}
                                disabled={index === selected.length - 1 || !canEdit}
                                onClick={() => moveProduct(index, 1)}
                              >
                                <ArrowDownwardIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    </>
                  ) : (
                    <RuleBuilder
                      rules={rules}
                      matchCondition={matchCondition}
                      disabled={!canEdit}
                      onMatchChange={setMatchCondition}
                      onChange={setRules}
                    />
                  )}
                </Stack>
              </CardContent>
            </Card>

            {type === 'automatic' && !isNew && (
              <Card>
                <CardHeader
                  title="Currently matching"
                  slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                  subheader="Membership is rewritten by Recalculate — save rule changes first, then recalculate."
                />
                <CardContent sx={{ pt: 0 }}>
                  {members.isLoading ? (
                    <CircularProgress size={20} />
                  ) : (members.data?.products.length ?? 0) === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No products match these rules yet.
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                      {(members.data?.products ?? []).map((product) => (
                        <Chip key={product.id} label={product.name} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            {collectionId && <ThemeTemplateCard resource="collection" id={collectionId} value={query.data?.collection?.template_suffix} disabled={!canEdit} />}
            <Card>
              <CardHeader
                title="Collection image"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                subheader="Shown on collection cards and the storefront header."
              />
              <CardContent sx={{ pt: 0 }}>
                <CollectionImage
                  mediaId={imageMediaId}
                  disabled={!canEdit}
                  onPick={() => setPickerOpen(true)}
                  onClear={() => setImageMediaId(null)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Visibility" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    }
                    label="Active"
                  />
                  <FormControlLabel
                    control={
                      <Switch checked={showInMenu} onChange={(e) => setShowInMenu(e.target.checked)} />
                    }
                    label="Show in storefront menu"
                  />
                  {type === 'automatic' && (
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', pt: 1 }}>
                      <AutoAwesomeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        Automatic collection
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Product order" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <TextField
                  select
                  label="Sort products by"
                  value={sortType}
                  onChange={(event) => setSortType(event.target.value as SortType)}
                  fullWidth
                >
                  {SORT_TYPES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </CardContent>
            </Card>

            {!isNew && (
              <Card>
                <CardHeader
                  title="Search engine listing"
                  slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                  subheader="Leave blank to use the title and description above."
                />
                <CardContent sx={{ pt: 0 }}>
                  <Stack spacing={2}>
                    <TextField
                      label="Handle"
                      placeholder="brightening-edit"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                      fullWidth
                      helperText={`/collections/${slug || '…'} — changing this breaks existing links.`}
                      disabled={!canEdit}
                    />
                    <TextField
                      label="Page title"
                      placeholder="Brightening Skincare Edit | Veylor"
                      value={metaTitle}
                      onChange={(event) => setMetaTitle(event.target.value)}
                      fullWidth
                      helperText={`${metaTitle.length}/60 recommended`}
                      disabled={!canEdit}
                    />
                    <TextField
                      label="Meta description"
                      placeholder="Serums, masks and SPF chosen to even out tone. Free delivery over ₹999."
                      value={metaDescription}
                      onChange={(event) => setMetaDescription(event.target.value)}
                      multiline
                      minRows={3}
                      fullWidth
                      helperText={`${metaDescription.length}/160 recommended`}
                      disabled={!canEdit}
                    />
                  </Stack>
                </CardContent>
              </Card>
            )}

            {!isNew && canEdit && (
              <Card>
                <CardContent>
                  <Button color="error" onClick={destroy} disabled={remove.isPending} fullWidth>
                    Delete collection
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Products are not deleted — only the grouping.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple={false}
        initialSelectedIds={imageMediaId ? [imageMediaId] : []}
        title="Choose a collection image"
        confirmLabel="Use image"
        onSelect={(media) => {
          setImageMediaId(media[0]?.id ?? null)
          setPickerOpen(false)
        }}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

function RuleBuilder({
  rules,
  matchCondition,
  disabled,
  onMatchChange,
  onChange,
}: {
  rules: CollectionRule[]
  matchCondition: 'all' | 'any'
  disabled: boolean
  onMatchChange: (next: 'all' | 'any') => void
  onChange: (next: CollectionRule[]) => void
}) {
  const setRule = (index: number, patch: Partial<CollectionRule>) => {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  }

  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        label="Products must match"
        value={matchCondition}
        onChange={(event) => onMatchChange(event.target.value as 'all' | 'any')}
        sx={{ maxWidth: 260 }}
        disabled={disabled}
      >
        <MenuItem value="all">all conditions</MenuItem>
        <MenuItem value="any">any condition</MenuItem>
      </TextField>

      <Divider />

      <Stack spacing={1.5}>
        {rules.map((rule, index) => {
          const kind = RULE_FIELDS.find((f) => f.value === rule.field)?.kind ?? 'text'
          return (
            <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                select
                size="small"
                label="Field"
                value={rule.field}
                onChange={(event) => {
                  const field = event.target.value
                  const allowed = operatorsFor(field)
                  setRule(index, {
                    field,
                    // Keep the operator only if it still makes sense — "contains"
                    // on a price is a 422 waiting to happen.
                    operator: allowed.some((o) => o.value === rule.operator)
                      ? rule.operator
                      : allowed[0].value,
                  })
                }}
                sx={{ minWidth: 180 }}
                disabled={disabled}
              >
                {RULE_FIELDS.map((field) => (
                  <MenuItem key={field.value} value={field.value}>
                    {field.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Condition"
                value={rule.operator}
                onChange={(event) => setRule(index, { operator: event.target.value })}
                sx={{ minWidth: 170 }}
                disabled={disabled}
              >
                {operatorsFor(rule.field).map((operator) => (
                  <MenuItem key={operator.value} value={operator.value}>
                    {operator.label}
                  </MenuItem>
                ))}
              </TextField>

              {kind === 'boolean' ? (
                <TextField
                  select
                  size="small"
                  label="Value"
                  value={rule.value ?? 'true'}
                  onChange={(event) => setRule(index, { value: event.target.value })}
                  sx={{ flex: 1, minWidth: 140 }}
                  disabled={disabled}
                >
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </TextField>
              ) : (
                <TextField
                  size="small"
                  label="Value"
                  type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
                  value={rule.value ?? ''}
                  onChange={(event) => setRule(index, { value: event.target.value })}
                  sx={{ flex: 1 }}
                  disabled={disabled}
                  slotProps={kind === 'date' ? { inputLabel: { shrink: true } } : undefined}
                  placeholder={kind === 'text' ? 'niacinamide' : ''}
                />
              )}

              <IconButton
                size="small"
                aria-label={`Remove condition ${index + 1}`}
                onClick={() => onChange(rules.filter((_, i) => i !== index))}
                disabled={disabled || rules.length === 1}
                sx={{ alignSelf: 'center' }}
              >
                <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          )
        })}
      </Stack>

      <Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange([...rules, { ...EMPTY_RULE }])}
          disabled={disabled || rules.length >= 20}
        >
          Add condition
        </Button>
      </Box>

      <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
        Slug fields (category, brand, tag, skin type, concern) match on the slug, not the display
        name — <code>vitamin-c</code>, not "Vitamin C".
      </Alert>
    </Stack>
  )
}

/**
 * The chosen image, resolved by id.
 *
 * The API stores only `image_media_id`, so on load the form knows the id but
 * not the URL — this fetches the one library item rather than pulling the whole
 * library just to render a single thumbnail.
 */
function CollectionImage({
  mediaId,
  disabled,
  onPick,
  onClear,
}: {
  mediaId: number | null
  disabled: boolean
  onPick: () => void
  onClear: () => void
}) {
  const media = useMediaItem(mediaId)
  const item = media.data?.media

  if (!mediaId) {
    return (
      <Box
        onClick={disabled ? undefined : onPick}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        aria-label="Choose a collection image"
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'Enter' || event.key === ' ') onPick()
        }}
        sx={{
          border: 1,
          borderStyle: 'dashed',
          borderColor: 'divider',
          borderRadius: 1,
          py: 4,
          display: 'grid',
          placeItems: 'center',
          cursor: disabled ? 'default' : 'pointer',
          color: 'text.secondary',
        }}
      >
        <ImageOutlinedIcon sx={{ fontSize: 26, mb: 0.5 }} />
        <Typography variant="caption">Add an image</Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          borderRadius: 1,
          overflow: 'hidden',
          aspectRatio: '4 / 3',
          bgcolor: 'action.hover',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {item ? (
          <Box
            component="img"
            src={thumbUrl(item, 'md')}
            alt={item.alt_text ?? ''}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <CircularProgress size={20} />
        )}
      </Box>
      {!disabled && (
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onPick}>
            Replace
          </Button>
          <Button size="small" color="inherit" onClick={onClear}>
            Remove
          </Button>
        </Stack>
      )}
    </Stack>
  )
}
