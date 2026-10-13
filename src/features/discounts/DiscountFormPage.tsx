import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  Alert,
  AlertTitle,
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
  InputAdornment,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { ProductSummary } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { formatMoney, storeCurrency } from '../../lib/format'
import { VariantPicker } from '../../components/VariantPicker'
import { useProductList } from '../products/useProducts'
import {
  useCreateDiscount,
  useDeleteDiscount,
  useDiscount,
  useSetDiscountProducts,
  useUpdateDiscount,
  type DiscountType,
} from './useDiscounts'

interface FormState {
  code: string
  title: string
  description: string
  discount_type: DiscountType
  value: string
  buy_quantity: string
  get_quantity: string
  get_variant_id: number | null
  gift_variant_id: number | null
  gift_reserves_inventory: boolean
  max_discount_amount: string
  min_order_amount: string
  usage_limit_total: string
  usage_limit_per_customer: string
  customer_eligibility: 'all' | 'new_customers' | 'returning' | 'specific'
  applies_to: 'all' | 'products' | 'categories' | 'collections'
  starts_at: string
  ends_at: string
  is_automatic: boolean
  is_stackable: boolean
  is_visible: boolean
  is_active: boolean
}

const EMPTY: FormState = {
  code: '',
  title: '',
  description: '',
  discount_type: 'percentage',
  value: '10',
  buy_quantity: '2',
  get_quantity: '1',
  get_variant_id: null,
  gift_variant_id: null,
  gift_reserves_inventory: true,
  max_discount_amount: '',
  min_order_amount: '0',
  usage_limit_total: '',
  usage_limit_per_customer: '1',
  customer_eligibility: 'all',
  applies_to: 'all',
  starts_at: '',
  ends_at: '',
  is_automatic: false,
  is_stackable: false,
  is_visible: false,
  is_active: true,
}

/** <input type="datetime-local"> wants 'YYYY-MM-DDTHH:mm' in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIso(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}

export function DiscountFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const discountId = isNew ? undefined : Number(id)

  const navigate = useNavigate()
  const { can } = useAuth()
  const query = useDiscount(discountId)
  const create = useCreateDiscount()
  const update = useUpdateDiscount(discountId ?? 0)
  const remove = useDeleteDiscount()
  const setProducts = useSetDiscountProducts()

  // The product picker for "specific products". 250 covers a catalogue this
  // size comfortably; beyond that it wants a searchable server-side lookup.
  const productList = useProductList({ limit: 250, status: 'active' })

  const [form, setForm] = useState<FormState>(EMPTY)
  const [selectedProducts, setSelectedProducts] = useState<ProductSummary[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const discount = query.data?.discount
  const products = useMemo(() => productList.data?.products ?? [], [productList.data])

  useEffect(() => {
    if (!discount) return
    setForm({
      code: discount.code,
      title: discount.title ?? '',
      description: discount.description ?? '',
      discount_type: discount.discount_type,
      value: String(discount.value),
      buy_quantity: discount.buy_quantity ? String(discount.buy_quantity) : '2',
      get_quantity: discount.get_quantity ? String(discount.get_quantity) : '1',
      get_variant_id: discount.get_variant_id ?? null,
      gift_variant_id: discount.gift_variant_id ?? null,
      gift_reserves_inventory: discount.gift_reserves_inventory ?? true,
      max_discount_amount: discount.max_discount_amount ? String(discount.max_discount_amount) : '',
      min_order_amount: String(discount.min_order_amount),
      usage_limit_total: discount.usage_limit_total ? String(discount.usage_limit_total) : '',
      usage_limit_per_customer: String(discount.usage_limit_per_customer),
      customer_eligibility: discount.customer_eligibility,
      applies_to: discount.applies_to,
      starts_at: toLocalInput(discount.starts_at),
      ends_at: toLocalInput(discount.ends_at),
      is_automatic: discount.is_automatic,
      is_stackable: discount.is_stackable,
      is_visible: discount.is_visible,
      is_active: discount.is_active,
    })
    const targetIds = (discount.targets?.products ?? []).map((p) => p.id)
    setSelectedProducts(products.filter((p) => targetIds.includes(p.id)))
  }, [discount, products])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const needsValue = form.discount_type === 'percentage' || form.discount_type === 'fixed_amount'
  const isBxgy = form.discount_type === 'buy_x_get_y'
  const isGift = form.discount_type === 'free_gift'

  const payload = () => ({
    code: form.code.trim().toUpperCase(),
    title: form.title.trim() || null,
    description: form.description.trim() || null,
    discount_type: form.discount_type,
    // Buy X get Y carries its "get" discount in value: 100 means free.
    value: needsValue || isBxgy ? Number(form.value || 0) : 0,
    ...(isBxgy
      ? {
          buy_quantity: Number(form.buy_quantity || 1),
          get_quantity: Number(form.get_quantity || 1),
          get_variant_id: form.get_variant_id,
        }
      : { buy_quantity: null, get_quantity: null, get_variant_id: null }),
    ...(isGift
      ? { gift_variant_id: form.gift_variant_id, gift_reserves_inventory: form.gift_reserves_inventory }
      : { gift_variant_id: null }),
    max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
    min_order_amount: Number(form.min_order_amount || 0),
    usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
    usage_limit_per_customer: Number(form.usage_limit_per_customer || 1),
    customer_eligibility: form.customer_eligibility,
    applies_to: form.applies_to,
    starts_at: toIso(form.starts_at),
    ends_at: toIso(form.ends_at),
    is_automatic: form.is_automatic,
    is_stackable: form.is_stackable,
    is_visible: form.is_visible,
    is_active: form.is_active,
    ...(form.applies_to === 'products'
      ? { product_ids: selectedProducts.map((p) => p.id) }
      : {}),
  })

  const handleError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
      setFieldErrors(error.fieldErrors())
      setBanner(error.message)
    } else {
      setBanner(fallback)
    }
  }

  const save = () => {
    setFieldErrors({})
    setBanner(null)
    if (isNew) {
      create.mutate(payload(), {
        onSuccess: (data) => {
          const newId = data?.discount?.id
          // The product scope is a separate endpoint and the id only exists
          // now, so attach before leaving — otherwise a "specific products"
          // discount is created applying to everything.
          if (form.applies_to === 'products' && newId && selectedProducts.length > 0) {
            setProducts.mutate(
              { id: newId, productIds: selectedProducts.map((p) => p.id) },
              {
                onSuccess: () => {
                  setToast('Discount created.')
                  navigate('/discounts')
                },
                onError: (error) =>
                  handleError(error, 'The discount was created but its products could not be attached.'),
              },
            )
            return
          }
          setToast('Discount created.')
          // Navigate to discounts listing after successful creation
          navigate('/discounts')
        },
        onError: (error) => handleError(error, 'Could not create the discount.'),
      })
    } else {
      update.mutate(payload(), {
        onSuccess: () => {
          setToast('Changes saved.')
          if (form.applies_to === 'products') {
            setProducts.mutate({ id: discountId!, productIds: selectedProducts.map((p) => p.id) })
          }
          // Stays on the record — see CollectionFormPage for the reasoning.
          // A create still returns to the list, which is where you want to be
          // once the thing exists.
        },
        onError: (error) => handleError(error, 'Could not save changes.'),
      })
    }
  }

  if (!isNew && query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  const saving = create.isPending || update.isPending
  const readOnly = !can('coupons.manage')

  return (
    <Box>
      <PageHeader
        back={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/discounts')}
            sx={{ mb: 1, ml: -1 }}
          >
            Discounts
          </Button>
        }
        title={isNew ? 'New discount' : (discount?.code ?? 'Discount')}
        subtitle={discount ? discount.summary : 'Code or automatic offer'}
        actions={
          <>
            {!isNew && discount && can('coupons.manage') && (
              <Button
                color="error"
                onClick={() => {
                  remove.mutate(discount.id, {
                    onSuccess: () => navigate('/discounts'),
                    onError: (error) => handleError(error, 'Could not delete.'),
                  })
                }}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            )}
            <Button variant="contained" onClick={save} disabled={saving || readOnly}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      {banner && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          <AlertTitle>Could not save</AlertTitle>
          {banner}
          {Object.keys(fieldErrors).length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {Object.entries(fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <Typography variant="body2">{message}</Typography>
                </li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_automatic}
                        onChange={(event) => set('is_automatic', event.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Automatic discount</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Applies at checkout with no code entered — the code below is still the
                          internal reference.
                        </Typography>
                      </Box>
                    }
                  />
                  <TextField
                    label="Discount code"
                    placeholder="GLOW20"
                    value={form.code}
                    onChange={(event) => set('code', event.target.value.toUpperCase())}
                    error={Boolean(fieldErrors.code)}
                    helperText={fieldErrors.code ?? 'Letters, numbers, hyphens and underscores.'}
                    slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Internal title"
                    value={form.title}
                    onChange={(event) => set('title', event.target.value)}
                    placeholder="Launch offer"
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Value" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Type"
                      value={form.discount_type}
                      onChange={(event) => {
                        const next = event.target.value as DiscountType
                        // "Get one free" is the usual offer; start there.
                        setForm((current) => ({ ...current, discount_type: next, ...(next === 'buy_x_get_y' && current.discount_type !== next ? { value: '100' } : {}) }))
                      }}
                      fullWidth
                    >
                      <MenuItem value="percentage">Percentage off</MenuItem>
                      <MenuItem value="fixed_amount">Fixed amount off</MenuItem>
                      <MenuItem value="free_shipping">Free shipping</MenuItem>
                      <MenuItem value="buy_x_get_y">Buy X get Y</MenuItem>
                      <MenuItem value="free_gift">Free gift</MenuItem>
                    </TextField>
                  </Grid>
                  {needsValue && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Value"
                        placeholder={form.discount_type === 'percentage' ? '20' : '200'}
                        type="number"
                        value={form.value}
                        onChange={(event) => set('value', event.target.value)}
                        error={Boolean(fieldErrors.value)}
                        helperText={fieldErrors.value}
                        slotProps={{
                          input: {
                            [form.discount_type === 'percentage' ? 'endAdornment' : 'startAdornment']: (
                              <InputAdornment position={form.discount_type === 'percentage' ? 'end' : 'start'}>
                                {form.discount_type === 'percentage' ? '%' : storeCurrency()}
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { min: 0, max: form.discount_type === 'percentage' ? 100 : undefined },
                        }}
                        fullWidth
                      />
                    </Grid>
                  )}
                  {form.discount_type === 'percentage' && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Maximum discount"
                        placeholder="300"
                        type="number"
                        value={form.max_discount_amount}
                        onChange={(event) => set('max_discount_amount', event.target.value)}
                        helperText="Caps what a percentage can take off. Leave blank for no cap."
                        slotProps={{
                          input: { startAdornment: <InputAdornment position="start">{storeCurrency()}</InputAdornment> },
                        }}
                        fullWidth
                      />
                    </Grid>
                  )}
                  {isBxgy && (
                    <>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="Customer buys"
                          type="number"
                          value={form.buy_quantity}
                          onChange={(event) => set('buy_quantity', event.target.value)}
                          error={Boolean(fieldErrors.buy_quantity)}
                          helperText={fieldErrors.buy_quantity ?? 'items'}
                          slotProps={{ htmlInput: { min: 1, max: 100 } }}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="Customer gets"
                          type="number"
                          value={form.get_quantity}
                          onChange={(event) => set('get_quantity', event.target.value)}
                          helperText="items"
                          slotProps={{ htmlInput: { min: 1, max: 100 } }}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="At a discount of"
                          type="number"
                          value={form.value}
                          onChange={(event) => set('value', event.target.value)}
                          error={Boolean(fieldErrors.value)}
                          helperText={fieldErrors.value ?? '100% makes them free.'}
                          slotProps={{
                            input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                            htmlInput: { min: 1, max: 100 },
                          }}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <VariantPicker
                          label="Which item they get (optional)"
                          value={form.get_variant_id}
                          onChange={(variantId) => set('get_variant_id', variantId)}
                          helperText={fieldErrors.get_variant_id ?? 'Leave empty to discount the cheapest qualifying items.'}
                          error={Boolean(fieldErrors.get_variant_id)}
                        />
                      </Grid>
                      <Grid size={12}>
                        <Alert severity="info" variant="outlined">
                          Buy {form.buy_quantity || '?'}, get {form.get_quantity || '?'}{' '}
                          {Number(form.value) >= 100 ? 'free' : `at ${form.value || 0}% off`}. Qualifying items are the ones chosen under “Applies to”.
                        </Alert>
                      </Grid>
                    </>
                  )}
                  {isGift && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <VariantPicker
                          label="Gift"
                          value={form.gift_variant_id}
                          onChange={(variantId) => set('gift_variant_id', variantId)}
                          helperText={fieldErrors.gift_variant_id ?? 'Added to the cart at no charge once the order qualifies.'}
                          error={Boolean(fieldErrors.gift_variant_id)}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={form.gift_reserves_inventory}
                              onChange={(event) => set('gift_reserves_inventory', event.target.checked)}
                            />
                          }
                          label="Take the gift out of stock"
                        />
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Off for samples you do not track; the gift is then never “sold out”.
                        </Typography>
                      </Grid>
                    </>
                  )}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Minimum order value"
                      placeholder="999"
                      type="number"
                      value={form.min_order_amount}
                      onChange={(event) => set('min_order_amount', event.target.value)}
                      slotProps={{
                        input: { startAdornment: <InputAdornment position="start">{storeCurrency()}</InputAdornment> },
                      }}
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Applies to"
                subheader="This is where a discount picks its products — the same relationship the product page shows."
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Scope"
                    value={form.applies_to}
                    onChange={(event) =>
                      set('applies_to', event.target.value as FormState['applies_to'])
                    }
                    fullWidth
                  >
                    <MenuItem value="all">All products</MenuItem>
                    <MenuItem value="products">Specific products</MenuItem>
                    <MenuItem value="collections">Specific collections</MenuItem>
                    <MenuItem value="categories">Specific categories</MenuItem>
                  </TextField>

                  {form.applies_to === 'products' && (
                    <Autocomplete
                      multiple
                      options={products}
                      value={selectedProducts}
                      loading={productList.isLoading}
                      onChange={(_, next) => setSelectedProducts(next)}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      // Two rows can share a display name; the id is the only safe key.
                      getOptionKey={(option) => option.id}
                      renderOption={(props, option) => {
                        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string }
                        return (
                          <Box component="li" key={key} {...rest}>
                            <Box>
                              <Typography variant="body2">{option.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatMoney(option.min_price)} · {option.variant_count} variant
                                {option.variant_count === 1 ? '' : 's'}
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
                          label="Products"
                          placeholder="Search products…"
                          error={Boolean(fieldErrors.product_ids)}
                          helperText={fieldErrors.product_ids}
                        />
                      )}
                    />
                  )}

                  {(form.applies_to === 'collections' || form.applies_to === 'categories') && (
                    <Alert severity="info">
                      Collection and category targeting is stored by the API but has no picker yet —
                      set it from the product side, or use specific products for now.
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardHeader title="Status" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={1.5}>
                  {discount && (
                    <Box>
                      <Chip
                        size="small"
                        label={discount.state}
                        color={discount.state === 'active' ? 'success' : 'default'}
                        variant={discount.state === 'active' ? 'filled' : 'outlined'}
                      />
                    </Box>
                  )}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_active}
                        onChange={(event) => set('is_active', event.target.checked)}
                      />
                    }
                    label="Enabled"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_stackable}
                        onChange={(event) => set('is_stackable', event.target.checked)}
                      />
                    }
                    label="Can combine with other discounts"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_visible}
                        onChange={(event) => set('is_visible', event.target.checked)}
                      />
                    }
                    label="Show on the storefront"
                  />
                  {discount && (
                    <>
                      <Divider />
                      <Typography variant="caption" color="text.secondary">
                        Redeemed {discount.used_count} time{discount.used_count === 1 ? '' : 's'}
                        {discount.usage_limit_total ? ` of ${discount.usage_limit_total}` : ''}.
                      </Typography>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Active dates" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Starts"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(event) => set('starts_at', event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                  <TextField
                    label="Ends"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(event) => set('ends_at', event.target.value)}
                    error={Boolean(fieldErrors.ends_at)}
                    helperText={fieldErrors.ends_at ?? 'Leave blank to run indefinitely.'}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Usage limits" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Total uses"
                    placeholder="Unlimited"
                    type="number"
                    value={form.usage_limit_total}
                    onChange={(event) => set('usage_limit_total', event.target.value)}
                    helperText="Blank means unlimited."
                    fullWidth
                  />
                  <TextField
                    label="Uses per customer"
                    placeholder="1"
                    type="number"
                    value={form.usage_limit_per_customer}
                    onChange={(event) => set('usage_limit_per_customer', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Who can use it"
                    value={form.customer_eligibility}
                    onChange={(event) =>
                      set('customer_eligibility', event.target.value as FormState['customer_eligibility'])
                    }
                    fullWidth
                  >
                    <MenuItem value="all">Everyone</MenuItem>
                    <MenuItem value="new_customers">First-time customers</MenuItem>
                    <MenuItem value="returning">Returning customers</MenuItem>
                  </TextField>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
