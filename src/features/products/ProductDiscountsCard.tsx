import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { formatDate } from '../../lib/format'
import { tokens } from '../../theme'
import {
  useDiscountOptions,
  useProductDiscounts,
  useSetProductDiscounts,
  type Discount,
} from '../discounts/useDiscounts'

const SOURCE_LABEL: Record<string, string> = {
  product: 'Attached here',
  collection: 'Via collection',
  category: 'Via category',
  all_products: 'All products',
}

/**
 * Discounts on the product form.
 *
 * Shopify manages discounts from the Discounts section, and for good reason —
 * one discount spans many products, so a product page is the wrong place to own
 * that relationship. This card keeps the model honest while still giving you
 * the dropdown: it edits only DIRECT attachments, and shows inherited ones
 * (from a collection, a category, or a store-wide discount) as read-only chips
 * with a link through to where they actually live.
 */
export function ProductDiscountsCard({ productId }: { productId: number | undefined }) {
  const applied = useProductDiscounts(productId)
  const options = useDiscountOptions(Boolean(productId))
  const setDiscounts = useSetProductDiscounts(productId ?? 0)

  const [selected, setSelected] = useState<Discount[]>([])
  const [error, setError] = useState<string | null>(null)

  const available = useMemo(() => options.data?.discounts ?? [], [options.data])

  /**
   * What is attached, read from the product's own answer rather than found by
   * looking the ids up in the dropdown's list.
   *
   * The old version filtered `available` — the separate "every active discount"
   * query — which made the chips wait on a request that has nothing to do with
   * them, and show nothing at all until it landed. On a slow load, or a product
   * opened straight after a save, the card said "no discounts" about a product
   * that plainly had one. `applied.data.discounts` already carries the code and
   * the title of each attached row, so the chips can be drawn the moment the
   * product's own request answers.
   */
  useEffect(() => {
    if (!applied.data) return
    setSelected(applied.data.discounts.filter((discount) => discount.editable_here))
  }, [applied.data])

  const inherited = (applied.data?.discounts ?? []).filter((discount) => !discount.editable_here)

  if (!productId) {
    return (
      <Card>
        <CardHeader
          title="Discounts"
          slotProps={{ title: { variant: 'subtitle1' } }}
          subheader="Save the product first, then attach discounts."
        />
      </Card>
    )
  }

  const commit = (next: Discount[]) => {
    setSelected(next)
    setError(null)
    setDiscounts.mutate(
      next.map((discount) => discount.id),
      {
        onError: (caught) => {
          setError(caught instanceof ApiError ? caught.message : 'Could not update discounts.')
          // Snap back to the server's truth rather than leaving a lie on screen.
          void applied.refetch()
        },
        onSuccess: () => {
          void applied.refetch()
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title="Discounts"
        slotProps={{
          title: { variant: 'subtitle1' },
          subheader: { variant: 'caption' },
        }}
        subheader="Only discounts attached directly here can be changed."
        action={
          setDiscounts.isPending ? <CircularProgress size={18} sx={{ mt: 1.5, mr: 1.5 }} /> : undefined
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Autocomplete
            multiple
            options={available}
            value={selected}
            loading={options.isLoading || applied.isLoading}
            onChange={(_, next) => commit(next)}
            getOptionLabel={(option) => option.code}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            // Two rows can share a display name; the id is the only safe key.
            getOptionKey={(option) => option.id}
            renderOption={(props, option) => {
              const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string }
              return (
                <Box component="li" key={key} {...rest}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.code}
                      {option.is_automatic && (
                        <Chip label="Automatic" size="small" sx={{ ml: 1, height: 17, fontSize: 10 }} />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.summary}
                      {option.min_order_amount > 0 && ` · min ₹${option.min_order_amount}`}
                      {option.ends_at && ` · ends ${formatDate(option.ends_at)}`}
                    </Typography>
                  </Box>
                </Box>
              )
            }}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => {
                const { key, ...rest } = getItemProps({ index })
                return (
                  <Chip
                    key={key}
                    label={option.code}
                    size="small"
                    icon={<LocalOfferIcon sx={{ fontSize: 14 }} />}
                    {...rest}
                  />
                )
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Attach discounts"
                placeholder={selected.length === 0 ? 'Search by code…' : ''}
                helperText="Active discounts only. Expired and scheduled ones are managed from the Discounts page."
              />
            )}
          />

          {inherited.length > 0 && (
            <>
              <Divider />
              <Box>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 15, color: tokens.taupe }} />
                  <Typography variant="caption" color="text.secondary">
                    Also applies to this product, from elsewhere
                  </Typography>
                </Stack>
                <Stack spacing={0.75}>
                  {inherited.map((discount) => (
                    <Stack
                      key={discount.id}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          <strong>{discount.code}</strong> · {discount.summary}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {SOURCE_LABEL[discount.source] ?? discount.source}
                        </Typography>
                      </Box>
                      <Tooltip title="Open in Discounts">
                        <IconButton
                          size="small"
                          component={RouterLink}
                          to={`/discounts/${discount.id}`}
                          aria-label={`Open discount ${discount.code}`}
                        >
                          <OpenInNewIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
