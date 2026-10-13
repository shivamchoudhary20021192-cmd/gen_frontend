import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { formatMoney, storeCurrency } from '../../lib/format'
import {
  addOption,
  addValue,
  blankVariant,
  missingCombinations,
  removeOption,
  removeValue,
  variantTitle,
  type FormOption,
  type FormState,
  type FormVariant,
} from './editorState'
import { FieldInput } from './FieldInput'
import type { Definition, Location, ProductMedia } from './types'

export const MAX_OPTIONS = 3

const UNIT_PRICE_UNITS = ['ml', 'cl', 'l', 'm3', 'mg', 'g', 'kg', 'mm', 'cm', 'm', 'm2', 'item']

interface Props {
  form: FormState
  setForm(update: (form: FormState) => FormState): void
  errors: Record<string, string>
  locations: Location[]
  variantFields: Definition[]
  disabled?: boolean
}

const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text))

/**
 * Options and variants, the way Shopify lays them out: the options (Size,
 * Colour…) and their values at the top, and below them one row per
 * combination with its price, SKU and stock — the rest of a variant in a
 * dialog. A product with no options is one variant, edited in the Pricing and
 * Inventory cards instead (see SingleVariantCards).
 */
export function VariantsCard({ form, setForm, errors, locations, variantFields, disabled }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const missing = missingCombinations(form)
  const setVariant = (key: string, patch: Partial<FormVariant>) =>
    setForm((current) => ({ ...current, variants: current.variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)) }))
  const setOption = (index: number, patch: Partial<FormOption>) =>
    setForm((current) => ({ ...current, options: current.options.map((option, at) => (at === index ? { ...option, ...patch } : option)) }))
  const editingVariant = form.variants.find((variant) => variant.key === editing) ?? null
  const editingIndex = editingVariant ? form.variants.indexOf(editingVariant) : -1

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6">Variants</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Options like size or colour. Each combination of their values is a variant with its own price, SKU and stock.
        </Typography>
        {errors.options && <Alert severity="error" sx={{ mb: 2 }}>{errors.options}</Alert>}
        {errors.variants && <Alert severity="error" sx={{ mb: 2 }}>{errors.variants}</Alert>}

        <Stack spacing={2}>
          {form.options.map((option, index) => (
            <OptionEditor
              key={option.key}
              option={option}
              index={index}
              errors={errors}
              disabled={disabled}
              onChange={(patch) => setOption(index, patch)}
              onAddValue={() => setForm((current) => addValue(current, index))}
              onRemoveValue={(valueKey) => setForm((current) => removeValue(current, index, valueKey))}
              onRemove={() => setForm((current) => removeOption(current, index))}
            />
          ))}
        </Stack>
        {form.options.length < MAX_OPTIONS && (
          <Button startIcon={<AddIcon />} onClick={() => setForm(addOption)} disabled={disabled} sx={{ mt: form.options.length ? 1.5 : 0 }}>
            {form.options.length ? 'Add another option' : 'Add options like size or colour'}
          </Button>
        )}
      </CardContent>

      {form.options.length > 0 && (
        <>
          <Divider />
          {missing.length > 0 && (
            <Alert
              severity="info"
              sx={{ m: 2 }}
              action={
                <Button size="small" disabled={disabled} onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, ...missingCombinations(current).map((combo) => blankVariant(combo, current.variants[0]))] }))}>
                  Add them
                </Button>
              }
            >
              {missing.length} combination{missing.length === 1 ? ' is' : 's are'} not a variant yet.
            </Alert>
          )}
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 140 }}>Variant</TableCell>
                  <TableCell sx={{ minWidth: 110 }}>Price ({storeCurrency()})</TableCell>
                  <TableCell sx={{ minWidth: 110 }}>Compare-at</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>SKU</TableCell>
                  <TableCell sx={{ minWidth: 90 }}>{locations.length > 1 ? 'Stock here' : 'Stock'}</TableCell>
                  <TableCell sx={{ width: 80 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {form.variants.map((variant, index) => {
                  const home = locations.find((location) => location.is_default) ?? locations[0]
                  const rowError = Object.entries(errors).find(([path]) => path.startsWith(`variants.${index}.`))?.[1]
                  return (
                    <TableRow key={variant.key} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {variantTitle(form, variant)}
                        </Typography>
                        {rowError && (
                          <Typography variant="caption" color="error">
                            {rowError}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <MoneyField compact value={variant.price} onChange={(price) => setVariant(variant.key, { price: price ?? 0 })} disabled={disabled} error={errors[`variants.${index}.price`]} />
                      </TableCell>
                      <TableCell>
                        <MoneyField compact value={variant.compare_at_price} onChange={(compare_at_price) => setVariant(variant.key, { compare_at_price })} disabled={disabled} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={variant.sku ?? ''} placeholder="Auto" onChange={(event) => setVariant(variant.key, { sku: event.target.value })} disabled={disabled} error={Boolean(errors[`variants.${index}.sku`])} />
                      </TableCell>
                      <TableCell>
                        {variant.inventory_tracked && home ? (
                          <TextField
                            size="small"
                            type="number"
                            value={variant.stock[home.id] ?? 0}
                            onChange={(event) => setVariant(variant.key, { stock: { ...variant.stock, [home.id]: Number(event.target.value) }, stockDirty: true })}
                            disabled={disabled}
                          />
                        ) : (
                          <Typography variant="caption">Not tracked</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Edit variant">
                          <IconButton size="small" onClick={() => setEditing(variant.key)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove variant">
                          <span>
                            <IconButton
                              size="small"
                              disabled={disabled || form.variants.length === 1}
                              onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((other) => other.key !== variant.key) }))}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', px: 2, py: 1 }}>
            {form.variants.length} variant{form.variants.length === 1 ? '' : 's'}. A removed variant stays on past orders.
          </Typography>
        </>
      )}

      {editingVariant && (
        <VariantDialog
          title={variantTitle(form, editingVariant)}
          variant={editingVariant}
          index={editingIndex}
          errors={errors}
          locations={locations}
          media={form.media}
          variantFields={variantFields}
          disabled={disabled}
          onClose={() => setEditing(null)}
          onChange={(patch) => setVariant(editingVariant.key, patch)}
        />
      )}
    </Card>
  )
}

function OptionEditor({
  option,
  index,
  errors,
  disabled,
  onChange,
  onAddValue,
  onRemoveValue,
  onRemove,
}: {
  option: FormOption
  index: number
  errors: Record<string, string>
  disabled?: boolean
  onChange(patch: Partial<FormOption>): void
  onAddValue(): void
  onRemoveValue(valueKey: string): void
  onRemove(): void
}) {
  const setValue = (key: string, patch: Partial<FormOption['values'][number]>) => onChange({ values: option.values.map((value) => (value.key === key ? { ...value, ...patch } : value)) })
  const swatches = option.display_style === 'swatches'
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
        <TextField
          label="Option name"
          placeholder={index === 0 ? 'Size' : index === 1 ? 'Colour' : 'Material'}
          value={option.name}
          onChange={(event) => onChange({ name: event.target.value })}
          disabled={disabled}
          error={Boolean(errors[`options.${index}.name`])}
          helperText={errors[`options.${index}.name`]}
          sx={{ flex: 1 }}
        />
        <TextField select label="Shown as" value={option.display_style} onChange={(event) => onChange({ display_style: event.target.value as FormOption['display_style'] })} disabled={disabled} sx={{ width: { sm: 160 } }}>
          <MenuItem value="buttons">Buttons</MenuItem>
          <MenuItem value="dropdown">Dropdown</MenuItem>
          <MenuItem value="swatches">Colour swatches</MenuItem>
        </TextField>
        <Tooltip title="Remove option">
          <span>
            <IconButton onClick={onRemove} disabled={disabled} sx={{ mt: { sm: 1 } }}>
              <DeleteOutlineIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
        Values
      </Typography>
      <Stack spacing={1}>
        {option.values.map((value, valueIndex) => (
          <Stack key={value.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {swatches && (
              <Box
                component="input"
                type="color"
                value={value.swatch_color ?? '#cccccc'}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setValue(value.key, { swatch_color: event.target.value })}
                disabled={disabled}
                aria-label={`${value.name || 'Value'} swatch colour`}
                sx={{ width: 36, height: 36, p: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, background: 'none', cursor: 'pointer', flexShrink: 0 }}
              />
            )}
            <TextField
              size="small"
              fullWidth
              placeholder={valueIndex === 0 ? (index === 0 ? 'Small' : 'Red') : 'Another value'}
              value={value.name}
              onChange={(event) => setValue(value.key, { name: event.target.value })}
              disabled={disabled}
              error={Boolean(errors[`options.${index}.values.${valueIndex}`])}
              helperText={errors[`options.${index}.values.${valueIndex}`]}
            />
            <IconButton size="small" aria-label="Remove value" onClick={() => onRemoveValue(value.key)} disabled={disabled || option.values.length === 1}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      {errors[`options.${index}.values`] && (
        <Typography variant="caption" color="error">
          {errors[`options.${index}.values`]}
        </Typography>
      )}
      <Button size="small" startIcon={<AddIcon />} onClick={onAddValue} disabled={disabled} sx={{ mt: 1 }}>
        Add value
      </Button>
    </Box>
  )
}

export function MoneyField({ label, value, onChange, disabled, error, helperText, compact }: { label?: string; value: number | null; onChange(value: number | null): void; disabled?: boolean; error?: string; helperText?: string; compact?: boolean }) {
  return (
    <TextField
      size="small"
      label={label}
      type="number"
      fullWidth
      value={value ?? ''}
      onChange={(event) => onChange(numberOrNull(event.target.value))}
      disabled={disabled}
      error={Boolean(error)}
      helperText={error ?? helperText}
      slotProps={{ htmlInput: { step: '0.01', min: 0 }, input: compact ? undefined : { startAdornment: <InputAdornment position="start">{storeCurrency()}</InputAdornment> } }}
    />
  )
}

/** Everything about one variant — shared by the dialog and the no-options product's cards. */
export function VariantDetails({
  variant,
  index,
  errors,
  locations,
  media,
  variantFields,
  disabled,
  onChange,
  sections = ['pricing', 'inventory', 'shipping', 'fields'],
}: {
  variant: FormVariant
  index: number
  errors: Record<string, string>
  locations: Location[]
  media: ProductMedia[]
  variantFields: Definition[]
  disabled?: boolean
  onChange(patch: Partial<FormVariant>): void
  sections?: ('pricing' | 'inventory' | 'shipping' | 'fields')[]
}) {
  const e = (field: string) => errors[`variants.${index}.${field}`]
  const margin = variant.cost !== null && variant.price > 0 ? Math.round(((variant.price - variant.cost) / variant.price) * 100) : null
  const unit = variant.unit_price
  return (
    <Stack spacing={3}>
      {sections.includes('pricing') && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Pricing
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MoneyField label="Price" value={variant.price} onChange={(price) => onChange({ price: price ?? 0 })} disabled={disabled} error={e('price')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MoneyField label="Compare-at price" value={variant.compare_at_price} onChange={(compare_at_price) => onChange({ compare_at_price })} disabled={disabled} error={e('compare_at_price')} helperText="The MRP, shown struck through" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MoneyField
                label="Cost per item"
                value={variant.cost}
                onChange={(cost) => onChange({ cost })}
                disabled={disabled}
                error={e('cost')}
                helperText={margin !== null ? `Profit ${formatMoney(variant.price - (variant.cost ?? 0))} · margin ${margin}%` : 'Customers won’t see this'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField size="small" fullWidth label="HSN code" value={variant.hsn_code ?? ''} onChange={(event) => onChange({ hsn_code: event.target.value || null })} disabled={disabled} error={Boolean(e('hsn_code'))} helperText={e('hsn_code')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <FormControlLabel control={<Checkbox checked={variant.taxable} onChange={(event) => onChange({ taxable: event.target.checked })} disabled={disabled} />} label="Charge tax on this variant" />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Checkbox checked={Boolean(unit)} onChange={(event) => onChange({ unit_price: event.target.checked ? { quantity: 100, quantity_unit: 'ml', reference: 100, reference_unit: 'ml' } : null })} disabled={disabled} />}
                label="Show a unit price (e.g. ₹120 / 100 ml)"
              />
              {unit && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1, alignItems: { sm: 'center' } }}>
                  <TextField size="small" type="number" label="Pack holds" value={unit.quantity} onChange={(event) => onChange({ unit_price: { ...unit, quantity: Number(event.target.value) } })} disabled={disabled} />
                  <UnitSelect value={unit.quantity_unit} onChange={(quantity_unit) => onChange({ unit_price: { ...unit, quantity_unit } })} disabled={disabled} />
                  <Typography variant="body2">priced per</Typography>
                  <TextField size="small" type="number" label="Per" value={unit.reference} onChange={(event) => onChange({ unit_price: { ...unit, reference: Number(event.target.value) } })} disabled={disabled} />
                  <UnitSelect value={unit.reference_unit} onChange={(reference_unit) => onChange({ unit_price: { ...unit, reference_unit } })} disabled={disabled} />
                </Stack>
              )}
              {e('unit_price') && (
                <Typography variant="caption" color="error">
                  {e('unit_price')}
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
      )}

      {sections.includes('inventory') && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Inventory
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" fullWidth label="SKU" placeholder="Filled in if left blank" value={variant.sku ?? ''} onChange={(event) => onChange({ sku: event.target.value })} disabled={disabled} error={Boolean(e('sku'))} helperText={e('sku')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" fullWidth label="Barcode (ISBN, UPC, GTIN…)" value={variant.barcode ?? ''} onChange={(event) => onChange({ barcode: event.target.value })} disabled={disabled} />
            </Grid>
            <Grid size={12}>
              <FormControlLabel control={<Checkbox checked={variant.inventory_tracked} onChange={(event) => onChange({ inventory_tracked: event.target.checked })} disabled={disabled} />} label="Track quantity" />
              <FormControlLabel
                control={<Checkbox checked={variant.inventory_policy === 'continue'} onChange={(event) => onChange({ inventory_policy: event.target.checked ? 'continue' : 'deny' })} disabled={disabled || !variant.inventory_tracked} />}
                label="Continue selling when out of stock"
              />
            </Grid>
            {variant.inventory_tracked && locations.length > 0 && (
              <Grid size={12}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Location</TableCell>
                      <TableCell align="right">Available</TableCell>
                      <TableCell sx={{ width: 140 }}>On hand</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {locations.map((location) => {
                      const level = variant.levels.find((row) => row.location_id === location.id)
                      return (
                        <TableRow key={location.id}>
                          <TableCell>
                            {location.name}
                            {location.is_default && <Typography component="span" variant="caption">{' · default'}</Typography>}
                          </TableCell>
                          <TableCell align="right">{level?.available ?? 0}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              aria-label={`On hand at ${location.name}`}
                              value={variant.stock[location.id] ?? 0}
                              onChange={(event) => onChange({ stock: { ...variant.stock, [location.id]: Number(event.target.value) }, stockDirty: true })}
                              disabled={disabled}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <Typography variant="caption">Available is on hand less what open orders hold. Changing on hand is recorded as a stock take.</Typography>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" fullWidth type="number" label="Most per order" value={variant.max_per_order ?? ''} onChange={(event) => onChange({ max_per_order: numberOrNull(event.target.value) })} disabled={disabled} helperText="Leave empty for no limit" />
            </Grid>
            {media.length > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select size="small" fullWidth label="Image" value={variant.media_id ?? ''} onChange={(event) => onChange({ media_id: event.target.value === '' ? null : Number(event.target.value) })} disabled={disabled} error={Boolean(e('media_id'))} helperText={e('media_id')}>
                  <MenuItem value="">
                    <em>The product's first image</em>
                  </MenuItem>
                  {media.map((item, at) => (
                    <MenuItem key={item.media_id} value={item.media_id}>
                      Image {at + 1}
                      {item.alt ? ` — ${item.alt}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {sections.includes('shipping') && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Shipping
          </Typography>
          <FormControlLabel control={<Checkbox checked={variant.requires_shipping} onChange={(event) => onChange({ requires_shipping: event.target.checked })} disabled={disabled} />} label="This is a physical product" />
          {variant.requires_shipping && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 8, sm: 4 }}>
                <TextField size="small" fullWidth type="number" label="Weight" value={variant.weight ?? ''} onChange={(event) => onChange({ weight: numberOrNull(event.target.value) })} disabled={disabled} />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <TextField select size="small" fullWidth label="Unit" value={variant.weight_unit} onChange={(event) => onChange({ weight_unit: event.target.value as FormVariant['weight_unit'] })} disabled={disabled}>
                  {['g', 'kg', 'oz', 'lb'].map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }} />
              {(['length', 'width', 'height'] as const).map((side) => (
                <Grid key={side} size={{ xs: 4, sm: 2.5 }}>
                  <TextField size="small" fullWidth type="number" label={side[0].toUpperCase() + side.slice(1)} value={variant[side] ?? ''} onChange={(event) => onChange({ [side]: numberOrNull(event.target.value) })} disabled={disabled} />
                </Grid>
              ))}
              <Grid size={{ xs: 12, sm: 2.5 }}>
                <TextField select size="small" fullWidth label="Unit" value={variant.dimension_unit} onChange={(event) => onChange({ dimension_unit: event.target.value as FormVariant['dimension_unit'] })} disabled={disabled}>
                  {['mm', 'cm', 'm', 'in'].map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Country of origin"
                  placeholder="IN"
                  value={variant.origin_country ?? ''}
                  onChange={(event) => onChange({ origin_country: event.target.value.toUpperCase().slice(0, 2) || null })}
                  disabled={disabled}
                  error={Boolean(e('origin_country'))}
                  helperText={e('origin_country') ?? 'Two-letter code, for customs'}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField size="small" fullWidth label="HS code" value={variant.hs_code ?? ''} onChange={(event) => onChange({ hs_code: event.target.value || null })} disabled={disabled} helperText="Harmonized System code, for customs" />
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {sections.includes('fields') && variantFields.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Variant fields
          </Typography>
          <Stack spacing={2}>
            {variantFields.map((definition) => (
              <FieldInput
                key={definition.id}
                field={definition}
                value={variant.metafields[definition.full_key] ?? null}
                onChange={(value) => onChange({ metafields: { ...variant.metafields, [definition.full_key]: value } })}
                error={errors[`variants.${index}.metafields.${definition.full_key}`]}
                disabled={disabled}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

function UnitSelect({ value, onChange, disabled }: { value: string; onChange(value: string): void; disabled?: boolean }) {
  return (
    <TextField select size="small" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} sx={{ minWidth: 90 }}>
      {UNIT_PRICE_UNITS.map((u) => (
        <MenuItem key={u} value={u}>
          {u}
        </MenuItem>
      ))}
    </TextField>
  )
}

function VariantDialog({
  title,
  onClose,
  ...rest
}: {
  title: string
  variant: FormVariant
  index: number
  errors: Record<string, string>
  locations: Location[]
  media: ProductMedia[]
  variantFields: Definition[]
  disabled?: boolean
  onClose(): void
  onChange(patch: Partial<FormVariant>): void
}) {
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <VariantDetails {...rest} />
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" sx={{ flex: 1, pl: 1 }}>
          Changes are kept when you close this; they are saved with the product.
        </Typography>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}
