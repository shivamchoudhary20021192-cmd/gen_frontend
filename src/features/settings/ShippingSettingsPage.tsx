import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PaymentsIcon from '@mui/icons-material/Payments'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import SearchIcon from '@mui/icons-material/Search'

// import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { ShippingRate, ShippingCarrier, CodRule, PincodeServiceability } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { useAuth } from '../../auth/useAuth'
import { useFlash } from '../../hooks/useFlash'
import { formatMoney, storeCurrency } from '../../lib/format'
import { useShop } from '../../shop/useShop'
import { ShippingZonesPanel } from './ShippingZonesPanel'
import { zonesKey, type ShippingZone } from './shippingZones'
import PublicIcon from '@mui/icons-material/Public'

const PIN_ZONES: { value: ShippingRate['zone']; label: string }[] = [
  { value: 'local', label: 'Local (PIN zone)' },
  { value: 'regional', label: 'Regional (PIN zone)' },
  { value: 'metro', label: 'Metro (PIN zone)' },
  { value: 'rest_of_india', label: 'Rest of India (PIN zone)' },
  { value: 'special', label: 'Special (PIN zone)' },
]

/** One select for where a rate applies: everywhere, a named zone, or (India) a PIN-code zone. */
function whereValue(rate: Partial<ShippingRate>): string {
  if (rate.zone_id) return `zone:${rate.zone_id}`
  return rate.zone && rate.zone !== 'all' ? `pin:${rate.zone}` : 'all'
}

function applyWhere(rate: Partial<ShippingRate>, value: string): Partial<ShippingRate> {
  if (value.startsWith('zone:')) return { ...rate, zone: 'all', zone_id: Number(value.slice(5)) }
  if (value.startsWith('pin:')) return { ...rate, zone: value.slice(4) as ShippingRate['zone'], zone_id: null }
  return { ...rate, zone: 'all', zone_id: null }
}

export function ShippingSettingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const { can } = useAuth()
  const { summary } = useShop()
  const { flash, success, clear } = useFlash()
  const usesPinCodes = (summary?.shop.country_code ?? 'IN') === 'IN'
  const zonesQuery = useQuery({
    queryKey: zonesKey,
    queryFn: () => api.get<{ zones: ShippingZone[] }>('/shipping/zones'),
  })
  const zones = zonesQuery.data?.zones ?? []

  // ── Rates ────────────────────────────────────────────────────────────────
  const ratesQuery = useQuery({
    queryKey: ['shipping-rates'],
    queryFn: () => api.get<{ rates: ShippingRate[] }>('/shipping/rates'),
  })

  const [editingRate, setEditingRate] = useState<Partial<ShippingRate> | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)

  const saveRateMutation = useMutation({
    mutationFn: async (rate: Partial<ShippingRate>) => {
      if (rate.id) {
        return api.patch(`/shipping/rates/${rate.id}`, rate)
      }
      return api.post('/shipping/rates', rate)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-rates'] })
      setEditingRate(null)
    },
    onError: (err: any) => setRateError(err.message || 'Failed to save rate'),
  })

  const deleteRateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/shipping/rates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipping-rates'] }),
  })

  // ── Carriers ─────────────────────────────────────────────────────────────
  const carriersQuery = useQuery({
    queryKey: ['shipping-carriers'],
    queryFn: () => api.get<{ carriers: ShippingCarrier[] }>('/shipping/carriers'),
  })

  const [editingCarrier, setEditingCarrier] = useState<ShippingCarrier | null>(null)
  const updateCarrierMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ShippingCarrier> }) =>
      api.patch(`/shipping/carriers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-carriers'] })
      setEditingCarrier(null)
    },
  })

  // ── COD Rules ────────────────────────────────────────────────────────────
  const codRulesQuery = useQuery({
    queryKey: ['shipping-cod-rules'],
    queryFn: () => api.get<{ cod_rules: CodRule[] }>('/shipping/cod-rules'),
  })

  const [codSuccess, setCodSuccess] = useState(false)
  const updateCodMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CodRule> }) =>
      api.patch(`/shipping/cod-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-cod-rules'] })
      setCodSuccess(true)
      setTimeout(() => setCodSuccess(false), 3000)
    },
  })

  // ── Pincode Lookup ───────────────────────────────────────────────────────
  const [searchPincode, setSearchPincode] = useState('')
  const [checkedPincode, setCheckedPincode] = useState<string | null>(null)
  const [pincodeEdit, setPincodeEdit] = useState<Partial<PincodeServiceability> | null>(null)

  const pincodeQuery = useQuery({
    queryKey: ['pincode-serviceability', checkedPincode],
    queryFn: () =>
      api.get<{ serviceability: PincodeServiceability }>(`/shipping/serviceability/${checkedPincode}`),
    enabled: Boolean(checkedPincode && checkedPincode.length === 6),
  })

  const savePincodeMutation = useMutation({
    mutationFn: (data: Partial<PincodeServiceability>) =>
      api.post('/shipping/serviceability', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pincode-serviceability', checkedPincode] })
      setPincodeEdit(null)
    },
  })

  const handlePincodeSearch = () => {
    if (searchPincode.trim().length === 6) {
      setCheckedPincode(searchPincode.trim())
    }
  }

  const rates = ratesQuery.data?.rates ?? []
  const carriers = carriersQuery.data?.carriers ?? []
  const codRule = codRulesQuery.data?.cod_rules?.[0]

  return (
    <Box>
      <PageHeader
        title="Shipping & delivery"
        subtitle="Manage shipping rates, zones, carrier integrations, and COD policies"
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value={0} icon={<LocalShippingIcon fontSize="small" />} iconPosition="start" label="Shipping Rates" />
          <Tab value={4} icon={<PublicIcon fontSize="small" />} iconPosition="start" label="Zones" />
          <Tab value={1} icon={<AltRouteIcon fontSize="small" />} iconPosition="start" label="Carriers" />
          <Tab value={2} icon={<PaymentsIcon fontSize="small" />} iconPosition="start" label="Cash on Delivery (COD)" />
          {usesPinCodes && <Tab value={3} icon={<LocationOnIcon fontSize="small" />} iconPosition="start" label="Pincode Lookup" />}
        </Tabs>
      </Paper>

      {tab === 4 && <ShippingZonesPanel canManage={can('settings.manage')} onChanged={success} />}

      {/* ── TAB 0: Rates ─────────────────────────────────────────────────── */}
      {tab === 0 && (
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Configured Rates & Delivery Profiles</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingRate({
                  name: '',
                  zone: 'all',
                  zone_id: null,
                  method: 'standard',
                  min_order_amount: 0,
                  rate: 99,
                  free_above_amount: 500,
                  eta_min_days: 3,
                  eta_max_days: 7,
                  is_active: true,
                })
                setRateError(null)
              }}
            >
              Add Rate
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Applies to</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Free Shipping Above</TableCell>
                  <TableCell align="center">Estimated ETA</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ratesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      Loading shipping rates...
                    </TableCell>
                  </TableRow>
                ) : rates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      No shipping rates defined yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rates.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                      <TableCell>
                        {r.zone_id ? (
                          <Chip label={zones.find((z) => z.id === r.zone_id)?.name ?? 'Zone'} size="small" color="primary" variant="outlined" />
                        ) : (
                          <Chip label={r.zone === 'all' ? 'Everywhere else' : r.zone.replace(/_/g, ' ')} size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.method}
                          color={r.method === 'express' ? 'warning' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{formatMoney(r.rate)}</TableCell>
                      <TableCell align="right">
                        {r.free_above_amount ? formatMoney(r.free_above_amount) : '—'}
                      </TableCell>
                      <TableCell align="center">
                        {r.eta_min_days}–{r.eta_max_days} days
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={r.is_active ? 'Active' : 'Inactive'}
                          color={r.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" onClick={() => setEditingRate(r)}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              if (confirm(`Delete rate "${r.name}"?`)) {
                                deleteRateMutation.mutate(r.id)
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ── TAB 1: Carriers ──────────────────────────────────────────────── */}
      {tab === 1 && (
        <Stack spacing={3}>
          <Typography variant="h6">Connected Courier Providers</Typography>
          <Grid container spacing={3}>
            {carriers.map((c) => (
              <Grid size={{ xs: 12, md: 6 }} key={c.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {c.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Code: {c.code} | Provider: {c.api_provider ?? 'manual'}
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={c.is_active}
                            onChange={(e) =>
                              updateCarrierMutation.mutate({
                                id: c.id,
                                data: { is_active: e.target.checked },
                              })
                            }
                            color="success"
                          />
                        }
                        label={c.is_active ? 'Active' : 'Disabled'}
                      />
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Chip
                        label={c.supports_cod ? 'COD Supported' : 'No COD'}
                        color={c.supports_cod ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={c.supports_reverse_pickup ? 'Reverse Pickup' : 'No Reverse Pickup'}
                        color={c.supports_reverse_pickup ? 'info' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    <Typography variant="body2" color="text.secondary" noWrap>
                      <strong>Tracking URL:</strong> {c.tracking_url_template || 'None configured'}
                    </Typography>

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button size="small" variant="outlined" onClick={() => setEditingCarrier(c)}>
                        Configure
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      )}

      {/* ── TAB 2: COD Rules ─────────────────────────────────────────────── */}
      {tab === 2 && codRule && (
        <Stack spacing={3} sx={{ maxWidth: 650 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Cash on Delivery (COD) Configuration</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={codRule.is_active}
                  onChange={(e) =>
                    updateCodMutation.mutate({ id: codRule.id, data: { is_active: e.target.checked } })
                  }
                  color="success"
                />
              }
              label={codRule.is_active ? 'COD Enabled' : 'COD Disabled'}
            />
          </Box>

          {codSuccess && <Alert severity="success">COD settings updated successfully.</Alert>}

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={3}>
              <TextField
                label="Rule Name"
                defaultValue={codRule.name}
                onBlur={(e) =>
                  updateCodMutation.mutate({ id: codRule.id, data: { name: e.target.value } })
                }
                fullWidth
                size="small"
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`Minimum Order Value (${storeCurrency()})`}
                    type="number"
                    defaultValue={codRule.min_order_amount}
                    onBlur={(e) =>
                      updateCodMutation.mutate({
                        id: codRule.id,
                        data: { min_order_amount: Number(e.target.value) },
                      })
                    }
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`Maximum Order Value (${storeCurrency()})`}
                    type="number"
                    defaultValue={codRule.max_order_amount ?? ''}
                    onBlur={(e) =>
                      updateCodMutation.mutate({
                        id: codRule.id,
                        data: { max_order_amount: e.target.value ? Number(e.target.value) : null },
                      })
                    }
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`COD Handling Fee (${storeCurrency()})`}
                    type="number"
                    defaultValue={codRule.cod_fee}
                    onBlur={(e) =>
                      updateCodMutation.mutate({
                        id: codRule.id,
                        data: { cod_fee: Number(e.target.value) },
                      })
                    }
                    fullWidth
                    size="small"
                    helperText="Charged on checkout when customer selects COD"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`Prepaid Incentive Discount (${storeCurrency()})`}
                    type="number"
                    defaultValue={codRule.prepaid_discount_amount}
                    onBlur={(e) =>
                      updateCodMutation.mutate({
                        id: codRule.id,
                        data: { prepaid_discount_amount: Number(e.target.value) },
                      })
                    }
                    fullWidth
                    size="small"
                    helperText="Incentive to pay online instead of COD"
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={codRule.requires_otp_confirmation}
                    onChange={(e) =>
                      updateCodMutation.mutate({
                        id: codRule.id,
                        data: { requires_otp_confirmation: e.target.checked },
                      })
                    }
                  />
                }
                label="Require OTP verification before placing COD orders"
              />

              <TextField
                label="Max Open COD Orders per Customer"
                type="number"
                defaultValue={codRule.max_open_cod_orders}
                onBlur={(e) =>
                  updateCodMutation.mutate({
                    id: codRule.id,
                    data: { max_open_cod_orders: Number(e.target.value) },
                  })
                }
                fullWidth
                size="small"
                helperText="Limits fraud and unpaid pending orders"
              />
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* ── TAB 3: Pincode Lookup ────────────────────────────────────────── */}
      {tab === 3 && (
        <Stack spacing={3} sx={{ maxWidth: 700 }}>
          <Typography variant="h6">Pincode Serviceability Checker</Typography>
          <Typography variant="body2" color="text.secondary">
            Check and configure delivery availability, COD eligibility, and estimated timelines for any 6-digit Indian PIN code.
          </Typography>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Enter 6-digit Pincode"
              value={searchPincode}
              onChange={(e) => setSearchPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              size="small"
              sx={{ width: 260 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handlePincodeSearch}
              disabled={searchPincode.length !== 6 || pincodeQuery.isFetching}
            >
              Check
            </Button>
          </Stack>

          {pincodeQuery.isLoading && <Typography variant="body2">Checking serviceability...</Typography>}

          {pincodeQuery.data && (
            <Card variant="outlined">
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
                >
                  <Typography variant="h6">
                    Pincode: {pincodeQuery.data.serviceability.pincode}
                  </Typography>
                  <Chip
                    icon={
                      pincodeQuery.data.serviceability.is_serviceable ? (
                        <CheckCircleIcon />
                      ) : (
                        <HighlightOffIcon />
                      )
                    }
                    label={
                      pincodeQuery.data.serviceability.is_serviceable
                        ? 'Serviceable'
                        : 'Not Serviceable'
                    }
                    color={pincodeQuery.data.serviceability.is_serviceable ? 'success' : 'error'}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Location</Typography>
                    <Typography variant="body2">
                      {[
                        pincodeQuery.data.serviceability.city,
                        pincodeQuery.data.serviceability.district,
                        pincodeQuery.data.serviceability.state,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'India (Default Region)'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Zone</Typography>
                    <Typography variant="body2">
                      {pincodeQuery.data.serviceability.zone.toUpperCase()}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Standard Delivery ETA</Typography>
                    <Typography variant="body2">
                      {pincodeQuery.data.serviceability.standard_eta_min_days}–
                      {pincodeQuery.data.serviceability.standard_eta_max_days} days
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Payment Methods</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip
                        label="Prepaid"
                        color={pincodeQuery.data.serviceability.prepaid_available ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label="Cash on Delivery"
                        color={pincodeQuery.data.serviceability.cod_available ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </Grid>
                </Grid>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPincodeEdit(pincodeQuery.data?.serviceability ?? null)}
                >
                  Edit Serviceability Details
                </Button>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      {/* ── Edit Rate Dialog ──────────────────────────────────────────────── */}
      <Dialog open={Boolean(editingRate)} onClose={() => setEditingRate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRate?.id ? 'Edit Shipping Rate' : 'New Shipping Rate'}</DialogTitle>
        <DialogContent>
          {rateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rateError}
            </Alert>
          )}
          {editingRate && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Rate Name"
                value={editingRate.name ?? ''}
                onChange={(e) => setEditingRate({ ...editingRate, name: e.target.value })}
                fullWidth
                size="small"
                required
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    select
                    label="Applies to"
                    value={whereValue(editingRate)}
                    onChange={(e) => setEditingRate(applyWhere(editingRate, e.target.value))}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="all">Everywhere no zone covers</MenuItem>
                    {zones.map((z) => (
                      <MenuItem key={z.id} value={`zone:${z.id}`}>
                        {z.name}
                      </MenuItem>
                    ))}
                    {usesPinCodes &&
                      PIN_ZONES.map((pin) => (
                        <MenuItem key={pin.value} value={`pin:${pin.value}`}>
                          {pin.label}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Select
                    value={editingRate.method ?? 'standard'}
                    onChange={(e) => setEditingRate({ ...editingRate, method: e.target.value as any })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="standard">Standard Delivery</MenuItem>
                    <MenuItem value="express">Express Delivery</MenuItem>
                    <MenuItem value="pickup">Store Pickup</MenuItem>
                  </Select>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`Shipping rate (${storeCurrency()})`}
                    type="number"
                    value={editingRate.rate ?? 0}
                    onChange={(e) => setEditingRate({ ...editingRate, rate: Number(e.target.value) })}
                    fullWidth
                    size="small"
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={`Free above (${storeCurrency()})`}
                    type="number"
                    value={editingRate.free_above_amount ?? ''}
                    onChange={(e) =>
                      setEditingRate({
                        ...editingRate,
                        free_above_amount: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    fullWidth
                    size="small"
                    placeholder="e.g. 500 (leave blank for none)"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="ETA Min Days"
                    type="number"
                    value={editingRate.eta_min_days ?? 3}
                    onChange={(e) =>
                      setEditingRate({ ...editingRate, eta_min_days: Number(e.target.value) })
                    }
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="ETA Max Days"
                    type="number"
                    value={editingRate.eta_max_days ?? 7}
                    onChange={(e) =>
                      setEditingRate({ ...editingRate, eta_max_days: Number(e.target.value) })
                    }
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={editingRate.is_active ?? true}
                    onChange={(e) => setEditingRate({ ...editingRate, is_active: e.target.checked })}
                  />
                }
                label="Active (offered during checkout)"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingRate(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => editingRate && saveRateMutation.mutate(editingRate)}
            disabled={saveRateMutation.isPending}
          >
            Save Rate
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Carrier Dialog ───────────────────────────────────────────── */}
      <Dialog open={Boolean(editingCarrier)} onClose={() => setEditingCarrier(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Configure Carrier: {editingCarrier?.name}</DialogTitle>
        <DialogContent>
          {editingCarrier && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Carrier Name"
                value={editingCarrier.name}
                onChange={(e) => setEditingCarrier({ ...editingCarrier, name: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="Tracking URL Template"
                value={editingCarrier.tracking_url_template ?? ''}
                onChange={(e) =>
                  setEditingCarrier({ ...editingCarrier, tracking_url_template: e.target.value })
                }
                helperText="Use {awb} as placeholder for waybill number"
                fullWidth
                size="small"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editingCarrier.supports_cod}
                    onChange={(e) =>
                      setEditingCarrier({ ...editingCarrier, supports_cod: e.target.checked })
                    }
                  />
                }
                label="Supports Cash on Delivery"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editingCarrier.supports_reverse_pickup}
                    onChange={(e) =>
                      setEditingCarrier({ ...editingCarrier, supports_reverse_pickup: e.target.checked })
                    }
                  />
                }
                label="Supports Reverse Pickup (Returns)"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCarrier(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() =>
              editingCarrier &&
              updateCarrierMutation.mutate({
                id: editingCarrier.id,
                data: {
                  name: editingCarrier.name,
                  tracking_url_template: editingCarrier.tracking_url_template,
                  supports_cod: editingCarrier.supports_cod,
                  supports_reverse_pickup: editingCarrier.supports_reverse_pickup,
                },
              })
            }
            disabled={updateCarrierMutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Pincode Dialog ───────────────────────────────────────────── */}
      <Dialog open={Boolean(pincodeEdit)} onClose={() => setPincodeEdit(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Pincode {pincodeEdit?.pincode}</DialogTitle>
        <DialogContent>
          {pincodeEdit && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pincodeEdit.is_serviceable ?? true}
                    onChange={(e) => setPincodeEdit({ ...pincodeEdit, is_serviceable: e.target.checked })}
                  />
                }
                label="Serviceable"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={pincodeEdit.cod_available ?? true}
                    onChange={(e) => setPincodeEdit({ ...pincodeEdit, cod_available: e.target.checked })}
                  />
                }
                label="COD Available"
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="ETA Min (Days)"
                    type="number"
                    value={pincodeEdit.standard_eta_min_days ?? 3}
                    onChange={(e) =>
                      setPincodeEdit({ ...pincodeEdit, standard_eta_min_days: Number(e.target.value) })
                    }
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="ETA Max (Days)"
                    type="number"
                    value={pincodeEdit.standard_eta_max_days ?? 7}
                    onChange={(e) =>
                      setPincodeEdit({ ...pincodeEdit, standard_eta_max_days: Number(e.target.value) })
                    }
                    size="small"
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPincodeEdit(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => pincodeEdit && savePincodeMutation.mutate(pincodeEdit)}
            disabled={savePincodeMutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}