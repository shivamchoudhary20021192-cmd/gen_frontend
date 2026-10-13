import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  InputAdornment,
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
import type { VariantInput } from '../../api/types'

interface VariantsCardProps {
  variants: VariantInput[]
  onChange(variants: VariantInput[]): void
  errors?: Record<string, string>
}

export function VariantsCard({ variants, onChange, errors = {} }: VariantsCardProps) {
  const update = (index: number, patch: Partial<VariantInput>) => {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)))
  }

  const add = () => {
    onChange([
      ...variants,
      { sku: '', variant_title: '', mrp: 0, price: 0, inventory_quantity: 0, is_default: variants.length === 0 },
    ])
  }

  const remove = (index: number) => {
    const next = variants.filter((_, i) => i !== index)
    // Something must remain the default, or the storefront has no price to show.
    if (next.length > 0 && !next.some((v) => v.is_default)) next[0].is_default = true
    onChange(next)
  }

  return (
    <Card>
      <CardHeader
        title="Variants & pricing"
        subheader="Price and stock live on the variant, even for a single-size product."
        slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
        action={
          <Button size="small" startIcon={<AddIcon />} onClick={add}>
            Add variant
          </Button>
        }
      />
      <CardContent sx={{ pt: 0, px: 0 }}>
        {errors.variants && (
          <Typography variant="caption" color="error" sx={{ px: 2, display: 'block', mb: 1 }}>
            {errors.variants}
          </Typography>
        )}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 140 }}>SKU</TableCell>
                <TableCell sx={{ minWidth: 110 }}>Title</TableCell>
                {/* What the size means, not just the number. "30 ml" tells a
                    shopper nothing about how long it lasts. */}
                <TableCell sx={{ minWidth: 200 }}>Size, in words</TableCell>
                <TableCell sx={{ minWidth: 110 }} align="right">
                  MRP
                </TableCell>
                <TableCell sx={{ minWidth: 110 }} align="right">
                  Price
                </TableCell>
                <TableCell sx={{ minWidth: 90 }} align="right">
                  Stock
                </TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {variants.map((variant, index) => {
                // The API rejects price > MRP with a 422; flagging it inline
                // means the person fixes it before they hit save.
                const priceTooHigh = variant.price > variant.mrp && variant.mrp > 0
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        value={variant.sku}
                        onChange={(event) => update(index, { sku: event.target.value })}
                        placeholder="VEY-SER-30"
                        fullWidth
                        required
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={variant.variant_title ?? ''}
                        onChange={(event) => update(index, { variant_title: event.target.value })}
                        placeholder="30ml"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={variant.size_description ?? ''}
                        onChange={(event) => update(index, { size_description: event.target.value })}
                        placeholder="30 ml — about six weeks of nightly use"
                        aria-label={`Size description for variant ${index + 1}`}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={variant.mrp}
                        aria-label={`MRP for variant ${index + 1}`}
                        placeholder="799"
                        onChange={(event) => update(index, { mrp: Number(event.target.value) })}
                        slotProps={{
                          input: {
                            startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                          },
                          htmlInput: { min: 0, step: 1 },
                        }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={variant.price}
                        aria-label={`Selling price for variant ${index + 1}`}
                        placeholder="699"
                        onChange={(event) => update(index, { price: Number(event.target.value) })}
                        error={priceTooHigh}
                        helperText={priceTooHigh ? 'Above MRP' : undefined}
                        slotProps={{
                          input: {
                            startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                          },
                          htmlInput: { min: 0, step: 1 },
                        }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={variant.inventory_quantity ?? 0}
                        aria-label={`Stock on hand for variant ${index + 1}`}
                        placeholder="50"
                        onChange={(event) =>
                          update(index, { inventory_quantity: Number(event.target.value) })
                        }
                        slotProps={{ htmlInput: { min: 0, step: 1 } }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Tooltip title={variants.length === 1 ? 'A product needs one variant' : 'Remove'}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            onClick={() => remove(index)}
                            disabled={variants.length === 1}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}
