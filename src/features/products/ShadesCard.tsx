import AddIcon from '@mui/icons-material/Add'
import CollectionsIcon from '@mui/icons-material/Collections'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { MediaPicker } from '../media/MediaPicker'
import { tokens } from '../../theme'
import type { Media, ProductOptionValue, VariantInput } from '../../api/types'

/**
 * Shades — the colour a shopper picks, and everything that makes it read as a
 * shade rather than a dropdown entry.
 *
 * A shade is not decoration on top of a variant; it *is* a variant. So this card
 * owns both: adding "monet" creates the sellable row behind it, and removing it
 * takes that row away. The alternative — editing shades and variants in two
 * places that must agree — is how you end up with a colour nobody can buy and a
 * SKU nobody can find.
 *
 * `sold out` is never typed in. It comes from stock, and is shown here so that
 * whoever is merchandising sees what the site is about to say.
 */

export interface ShadeDraft {
  /** Present once saved; absent on a shade being added. */
  id?: number
  value: string
  descriptor: string
  badge: string
  swatch_hex: string
  is_active: boolean
  /** Read-only, from the API: derived from stock. */
  is_sold_out?: boolean
  images?: { media_id: number; url: string }[]
}

export function shadeFromValue(value: ProductOptionValue): ShadeDraft {
  return {
    id: value.id,
    value: value.value,
    descriptor: value.descriptor ?? '',
    badge: value.badge ?? '',
    swatch_hex: value.swatch_hex ?? '',
    is_active: value.is_active,
    is_sold_out: value.is_sold_out,
    images: value.images?.map((image) => ({ media_id: image.media_id, url: image.url })),
  }
}

interface ShadesCardProps {
  shades: ShadeDraft[]
  onChange(shades: ShadeDraft[]): void
  /** Needed because a shade owns the variant behind it. */
  variants: VariantInput[]
  onVariantsChange(variants: VariantInput[]): void
  /** Saving per-shade photographs needs an id, which a new shade does not have. */
  onManageImages?(shade: ShadeDraft): void
}

/**
 * A SKU suggestion, so adding a shade does not stall on inventing one.
 *
 * Ends in a short stamp because SKUs are unique across the whole catalogue, not
 * just this product: two products that both have a "rose" would otherwise
 * collide, and the merchant would meet a bare 409 with no idea which field
 * caused it. It is only a suggestion — the variants card below is where it gets
 * edited into whatever the warehouse actually calls it.
 */
function suggestSku(name: string, existing: VariantInput[]): string {
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'SHADE'
  const stamp = Date.now().toString(36).toUpperCase().slice(-4)
  let candidate = `VEY-${slug}-${stamp}`
  let suffix = 2
  while (existing.some((variant) => variant.sku === candidate)) {
    candidate = `VEY-${slug}-${stamp}${suffix}`
    suffix += 1
  }
  return candidate
}

export function ShadesCard({
  shades,
  onChange,
  variants,
  onVariantsChange,
  onManageImages,
}: ShadesCardProps) {
  const [newName, setNewName] = useState('')
  const [pickerFor, setPickerFor] = useState<number | null>(null)

  const update = (index: number, patch: Partial<ShadeDraft>) => {
    const previous = shades[index]
    const next = shades.map((shade, i) => (i === index ? { ...shade, ...patch } : shade))
    onChange(next)

    // Renaming a shade has to carry its variant with it, or the link breaks on
    // save — variants reference option values by name.
    if (patch.value !== undefined && previous.value !== patch.value) {
      onVariantsChange(
        variants.map((variant) =>
          (variant.option_values ?? []).includes(previous.value)
            ? {
                ...variant,
                option_values: (variant.option_values ?? []).map((value) =>
                  value === previous.value ? patch.value! : value,
                ),
              }
            : variant,
        ),
      )
    }
  }

  const add = () => {
    const name = newName.trim()
    if (name.length === 0) return
    if (shades.some((shade) => shade.value.toLowerCase() === name.toLowerCase())) return

    onChange([
      ...shades,
      { value: name, descriptor: '', badge: '', swatch_hex: '', is_active: true },
    ])
    // The sellable row behind the colour, created with it so the two can never
    // drift apart.
    onVariantsChange([
      ...variants,
      {
        sku: suggestSku(name, variants),
        variant_title: name,
        mrp: variants[0]?.mrp ?? 0,
        price: variants[0]?.price ?? 0,
        inventory_quantity: 0,
        is_default: variants.length === 0,
        option_values: [name],
      },
    ])
    setNewName('')
  }

  const remove = (index: number) => {
    const shade = shades[index]
    onChange(shades.filter((_, i) => i !== index))

    const remaining = variants.filter(
      (variant) => !(variant.option_values ?? []).includes(shade.value),
    )
    // Something must remain the default, or the storefront has no price to show.
    if (remaining.length > 0 && !remaining.some((variant) => variant.is_default)) {
      remaining[0] = { ...remaining[0], is_default: true }
    }
    onVariantsChange(remaining)
  }

  const variantFor = (shade: ShadeDraft) =>
    variants.find((variant) => (variant.option_values ?? []).includes(shade.value))

  return (
    <Card variant="outlined">
      <CardHeader
        title="Shades"
        subheader="Each shade is its own sellable row — price and stock live with it."
        slotProps={{
          title: { variant: 'subtitle1', fontWeight: 600 },
          subheader: { variant: 'caption' },
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        {shades.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No shades yet. Add one and a variant is created with it, so the colour and the thing
            people buy can never drift apart.
          </Alert>
        )}

        {shades.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 56 }}>Swatch</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Descriptor</TableCell>
                  <TableCell>Badge</TableCell>
                  <TableCell align="right" sx={{ width: 110 }}>
                    Price
                  </TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>
                    Stock
                  </TableCell>
                  <TableCell align="right" sx={{ width: 110 }}>
                    Photos
                  </TableCell>
                  <TableCell align="right" sx={{ width: 52 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {shades.map((shade, index) => {
                  const variant = variantFor(shade)
                  const stock = Number(variant?.inventory_quantity ?? 0)
                  return (
                    <TableRow key={shade.id ?? `new-${index}`} data-shade={shade.value}>
                      <TableCell>
                        {/* A native colour input: picking a lipstick colour by
                            eye is the whole job, and a hex field alone makes
                            someone open a colour picker in another window. */}
                        <Box
                          component="input"
                          type="color"
                          aria-label={`Swatch for ${shade.value}`}
                          value={shade.swatch_hex || '#CCCCCC'}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            update(index, { swatch_hex: event.target.value.toUpperCase() })
                          }
                          sx={{
                            width: 34,
                            height: 34,
                            padding: 0,
                            border: `1px solid ${tokens.border}`,
                            borderRadius: '50%',
                            background: 'none',
                            cursor: 'pointer',
                          }}
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="monet"
                          value={shade.value}
                          onChange={(event) => update(index, { value: event.target.value })}
                          sx={{ minWidth: 120 }}
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="shimmery apricot"
                          value={shade.descriptor}
                          onChange={(event) => update(index, { descriptor: event.target.value })}
                          sx={{ minWidth: 170 }}
                        />
                      </TableCell>

                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="limited edition"
                          value={shade.badge}
                          onChange={(event) => update(index, { badge: event.target.value })}
                          sx={{ minWidth: 140 }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={variant?.price ?? 0}
                          onChange={(event) => {
                            const price = Number(event.target.value)
                            onVariantsChange(
                              variants.map((item) =>
                                item === variant ? { ...item, price } : item,
                              ),
                            )
                          }}
                          slotProps={{
                            input: {
                              startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                            },
                          }}
                          sx={{ width: 110 }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        {/* Shown, not editable: stock moves through receiving
                            and selling, not through a product form. */}
                        <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                          <Typography variant="body2" sx={{ color: tokens.subdued }}>
                            {variant ? stock : '—'}
                          </Typography>
                          {variant && stock <= 0 && (
                            <Chip
                              size="small"
                              label="sold out"
                              sx={{ height: 18, fontSize: 11, bgcolor: tokens.sand }}
                            />
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell align="right">
                        {shade.id ? (
                          <Button
                            size="small"
                            startIcon={<CollectionsIcon fontSize="small" />}
                            onClick={() => setPickerFor(index)}
                          >
                            {shade.images?.length ? `${shade.images.length}` : 'Add'}
                          </Button>
                        ) : (
                          <Tooltip title="Save the product first — a photograph needs a shade to belong to">
                            <span>
                              <Button size="small" disabled>
                                Add
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Remove ${shade.value}`}
                          onClick={() => remove(index)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'flex-end' }}>
          <TextField
            size="small"
            label="Shade name"
            placeholder="monaco"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            sx={{ minWidth: 220 }}
          />
          <Button variant="outlined" startIcon={<AddIcon />} onClick={add}>
            Add shade
          </Button>
        </Stack>
        <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 1 }}>
          Sold out is worked out from stock, so it is never typed in and never wrong.
        </Typography>
      </CardContent>

      <MediaPicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(selection: Media[]) => {
          if (pickerFor === null) return
          const shade = shades[pickerFor]
          const existing = shade.images ?? []
          const added = selection
            .filter((media) => !existing.some((image) => image.media_id === media.id))
            .map((media) => ({ media_id: media.id, url: media.url }))
          update(pickerFor, { images: [...existing, ...added] })
          onManageImages?.({ ...shade, images: [...existing, ...added] })
        }}
        multiple
        maxSelection={12}
        title="Photographs for this shade"
        confirmLabel="Attach"
      />
    </Card>
  )
}
