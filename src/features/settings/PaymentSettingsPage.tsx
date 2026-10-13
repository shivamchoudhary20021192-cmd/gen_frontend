import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
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
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn'
import WebhookIcon from '@mui/icons-material/Webhook'
import SearchIcon from '@mui/icons-material/Search'
import LockIcon from '@mui/icons-material/Lock'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { PaymentConfig, PaymentTransaction, PaymentRefund, PaymentWebhook } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI (Google Pay, PhonePe, Paytm, BHIM)' },
  { id: 'card', label: 'Credit & Debit Cards (Visa, Mastercard, RuPay)' },
  { id: 'netbanking', label: 'Net Banking (All Indian Banks)' },
  { id: 'wallet', label: 'Wallets (Paytm, Mobikwik, etc.)' },
  { id: 'emi', label: 'Cardless & Credit Card EMI' },
]

export function PaymentSettingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)

  // ── Settings ─────────────────────────────────────────────────────────────
  const settingsQuery = useQuery({
    queryKey: ['payment-settings'],
    queryFn: () => api.get<{ settings: PaymentConfig }>('/payments/settings'),
  })

  const [formGateway, setFormGateway] = useState<string>('razorpay')
  const [formKeyId, setFormKeyId] = useState<string>('')
  const [formKeySecret, setFormKeySecret] = useState<string>('')
  const [formWebhookSecret, setFormWebhookSecret] = useState<string>('')
  const [formCaptureMode, setFormCaptureMode] = useState<'automatic' | 'manual'>('automatic')
  const [formTestMode, setFormTestMode] = useState<boolean>(true)
  const [formCodEnabled, setFormCodEnabled] = useState<boolean>(true)
  const [formMethods, setFormMethods] = useState<string[]>(['upi', 'card', 'netbanking', 'wallet'])
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync settings when loaded
  const settings = settingsQuery.data?.settings
  const [hasInit, setHasInit] = useState(false)
  if (settings && !hasInit) {
    setFormGateway(settings.gateway)
    setFormKeyId(settings.razorpay_key_id)
    setFormCaptureMode(settings.capture_mode)
    setFormTestMode(settings.test_mode)
    setFormCodEnabled(settings.cod_enabled)
    setFormMethods(settings.enabled_methods)
    setHasInit(true)
  }

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => api.patch('/payments/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] })
      setSaveSuccess(true)
      setSaveError(null)
      setFormKeySecret('')
      setFormWebhookSecret('')
      setTimeout(() => setSaveSuccess(false), 3500)
    },
    onError: (err: any) => setSaveError(err.message || 'Failed to update payment settings'),
  })

  const handleSaveSettings = () => {
    const payload: any = {
      gateway: formGateway,
      cod_enabled: formCodEnabled,
      capture_mode: formCaptureMode,
      razorpay_key_id: formKeyId,
      test_mode: formTestMode,
      enabled_methods: formMethods,
    }
    if (formKeySecret.trim()) {
      payload.razorpay_key_secret = formKeySecret.trim()
    }
    if (formWebhookSecret.trim()) {
      payload.razorpay_webhook_secret = formWebhookSecret.trim()
    }
    updateSettingsMutation.mutate(payload)
  }

  // ── Transactions ─────────────────────────────────────────────────────────
  const [txSearch, setTxSearch] = useState('')
  const [txStatus, setTxStatus] = useState<string>('')
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null)

  const transactionsQuery = useQuery({
    queryKey: ['payment-transactions', txSearch, txStatus],
    queryFn: () =>
      api.get<{ transactions: PaymentTransaction[]; pagination: { total: number } }>(
        '/payments/transactions',
        {
          search: txSearch || undefined,
          status: txStatus || undefined,
        },
      ),
  })

  // ── Refunds ──────────────────────────────────────────────────────────────
  const refundsQuery = useQuery({
    queryKey: ['payment-refunds'],
    queryFn: () =>
      api.get<{ refunds: PaymentRefund[]; pagination: { total: number } }>('/payments/refunds'),
  })

  // ── Webhooks ─────────────────────────────────────────────────────────────
  const webhooksQuery = useQuery({
    queryKey: ['payment-webhooks'],
    queryFn: () =>
      api.get<{ webhooks: PaymentWebhook[]; pagination: { total: number } }>('/payments/webhooks'),
  })

  const transactions = transactionsQuery.data?.transactions ?? []
  const refunds = refundsQuery.data?.refunds ?? []
  const webhooks = webhooksQuery.data?.webhooks ?? []

  return (
    <Box>
      <PageHeader
        title="Payments"
        subtitle="Configure payment gateways, view transactions ledger, and track refunds"
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<AccountBalanceWalletIcon fontSize="small" />} iconPosition="start" label="Gateway & Configuration" />
          <Tab icon={<ReceiptLongIcon fontSize="small" />} iconPosition="start" label="Transactions" />
          <Tab icon={<AssignmentReturnIcon fontSize="small" />} iconPosition="start" label="Refunds" />
          <Tab icon={<WebhookIcon fontSize="small" />} iconPosition="start" label="Webhook Logs" />
        </Tabs>
      </Paper>

      {/* ── TAB 0: Gateway & Configuration ──────────────────────────────── */}
      {tab === 0 && (
        <Stack spacing={3} sx={{ maxWidth: 720 }}>
          {saveSuccess && <Alert severity="success">Payment settings updated successfully.</Alert>}
          {saveError && <Alert severity="error">{saveError}</Alert>}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Payment Gateway Configuration
              </Typography>

              <Stack spacing={3}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <FormLabel sx={{ mb: 1, fontSize: 14 }}>Active Payment Gateway</FormLabel>
                      <Select
                        value={formGateway}
                        onChange={(e) => setFormGateway(e.target.value)}
                      >
                        <MenuItem value="razorpay">Razorpay (India)</MenuItem>
                        <MenuItem value="manual">Manual / Bank Transfer</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <FormLabel sx={{ mb: 1, fontSize: 14 }}>Payment Capture Mode</FormLabel>
                      <Select
                        value={formCaptureMode}
                        onChange={(e) => setFormCaptureMode(e.target.value as any)}
                      >
                        <MenuItem value="automatic">Automatic (Capture immediately)</MenuItem>
                        <MenuItem value="manual">Manual (Authorize only)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <FormControlLabel
                  control={
                    <Switch
                      checked={formTestMode}
                      onChange={(e) => setFormTestMode(e.target.checked)}
                      color="warning"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Sandbox / Test Mode
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formTestMode
                          ? 'Test mode is ACTIVE. Real cards will not be charged.'
                          : 'Live mode. Real money transactions.'}
                      </Typography>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formCodEnabled}
                      onChange={(e) => setFormCodEnabled(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Cash on Delivery (COD)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow customers to choose Cash on Delivery at checkout.
                      </Typography>
                    </Box>
                  }
                />
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Razorpay API Credentials
              </Typography>

              <Stack spacing={2.5}>
                <TextField
                  label="Key ID"
                  value={formKeyId}
                  onChange={(e) => setFormKeyId(e.target.value)}
                  placeholder="rzp_test_XXXXXXXX or rzp_live_XXXXXXXX"
                  fullWidth
                  size="small"
                  helperText="Public Key ID provided in your Razorpay Dashboard"
                />

                <TextField
                  label="Key Secret"
                  type="password"
                  value={formKeySecret}
                  onChange={(e) => setFormKeySecret(e.target.value)}
                  placeholder={
                    settings?.has_key_secret
                      ? `Saved (${settings.razorpay_key_secret_masked}). Enter new secret to update.`
                      : 'Enter Razorpay Key Secret'
                  }
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  helperText="Never sent to the browser. Stored in the database as written — set RAZORPAY_KEY_SECRET in the API environment instead if you would rather it not be."
                />

                <TextField
                  label="Webhook Secret"
                  type="password"
                  value={formWebhookSecret}
                  onChange={(e) => setFormWebhookSecret(e.target.value)}
                  placeholder={
                    settings?.has_webhook_secret
                      ? `Saved (${settings.razorpay_webhook_secret_masked}). Enter new secret to update.`
                      : 'Enter Webhook Secret'
                  }
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  helperText="Signs the webhooks Razorpay sends. Without it, webhooks are refused and orders will not be marked paid automatically."
                />

                {/* The single most common way to get this working everywhere
                    except production: the keys are set and nobody registered
                    the URL, so no webhook ever arrives and paid orders sit
                    unconfirmed until someone opens them by hand. */}
                <Alert severity="info" icon={<WebhookIcon fontSize="small" />}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Register this URL in the Razorpay dashboard
                  </Typography>
                  <Typography
                    variant="body2"
                    component="code"
                    sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all', mb: 1 }}
                  >
                    {`${window.location.origin}/api/v1/payments/razorpay/webhook`}
                  </Typography>
                  <Typography variant="body2">
                    Subscribe to <strong>payment.captured</strong>, <strong>payment.failed</strong>,{' '}
                    <strong>refund.processed</strong> and <strong>refund.failed</strong>, and paste the
                    signing secret it gives you into the field above.
                  </Typography>
                </Alert>

                <Alert severity="warning">
                  Keys set as <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code> and{' '}
                  <code>RAZORPAY_WEBHOOK_SECRET</code> in the API environment take precedence over
                  anything saved here. That is the recommended place for live keys.
                </Alert>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Supported Payment Instruments
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the payment methods you wish to offer through the gateway checkout window.
              </Typography>

              <FormGroup>
                {PAYMENT_METHODS.map((m) => {
                  const checked = formMethods.includes(m.id)
                  return (
                    <FormControlLabel
                      key={m.id}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormMethods([...formMethods, m.id])
                            } else {
                              setFormMethods(formMethods.filter((x) => x !== m.id))
                            }
                          }}
                        />
                      }
                      label={m.label}
                    />
                  )
                })}
              </FormGroup>
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
            >
              Save Payment Settings
            </Button>
          </Box>
        </Stack>
      )}

      {/* ── TAB 1: Transactions ─────────────────────────────────────────── */}
      {tab === 1 && (
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Transactions Ledger</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <TextField
                placeholder="Search order #, payment ID, UPI..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
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

              <Select
                value={txStatus}
                onChange={(e) => setTxStatus(e.target.value)}
                size="small"
                displayEmpty
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="captured">Captured</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="authorized">Authorized</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="refunded">Refunded</MenuItem>
              </Select>
            </Stack>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Gateway Payment ID</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Fee / Tax</TableCell>
                  <TableCell align="right">Created At</TableCell>
                  <TableCell align="right">Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactionsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      Loading payment transactions...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      No payment transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{tx.order_number}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {tx.gateway_payment_id || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(tx.method || tx.gateway).toUpperCase()}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ₹{tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={tx.status}
                          color={
                            tx.status === 'captured'
                              ? 'success'
                              : tx.status === 'failed'
                              ? 'error'
                              : tx.status === 'refunded'
                              ? 'info'
                              : 'warning'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        ₹{(tx.gateway_fee + tx.gateway_tax).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => setSelectedTx(tx)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ── TAB 2: Refunds ──────────────────────────────────────────────── */}
      {tab === 2 && (
        <Stack spacing={3}>
          <Typography variant="h6">Refunds Ledger</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Refund ID</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Speed</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell>Bank ARN</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Processed At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {refundsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                      Loading refunds...
                    </TableCell>
                  </TableRow>
                ) : refunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                      No refunds issued yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  refunds.map((ref) => (
                    <TableRow key={ref.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{ref.order_number}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {ref.gateway_refund_id || '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ₹{ref.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Chip label={ref.refund_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{ref.speed}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={ref.status}
                          color={ref.status === 'processed' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{ref.arn || '—'}</TableCell>
                      <TableCell>{ref.reason || '—'}</TableCell>
                      <TableCell align="right">
                        {ref.processed_at ? new Date(ref.processed_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ── TAB 3: Webhook Logs ─────────────────────────────────────────── */}
      {tab === 3 && (
        <Stack spacing={3}>
          <Typography variant="h6">Gateway Webhooks Health</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Event ID</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Gateway</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Attempts</TableCell>
                  <TableCell>Last Error</TableCell>
                  <TableCell align="right">Received At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooksQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      Loading webhook logs...
                    </TableCell>
                  </TableRow>
                ) : webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No incoming webhooks recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map((wh) => (
                    <TableRow key={wh.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {wh.event_id}
                      </TableCell>
                      <TableCell>
                        <Chip label={wh.event_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{wh.gateway}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={wh.status}
                          color={wh.status === 'processed' ? 'success' : wh.status === 'failed' ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">{wh.attempts}</TableCell>
                      <TableCell sx={{ color: 'error.main' }}>{wh.last_error || '—'}</TableCell>
                      <TableCell align="right">
                        {new Date(wh.received_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ── Transaction Details Dialog ──────────────────────────────────── */}
      <Dialog open={Boolean(selectedTx)} onClose={() => setSelectedTx(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Payment Details: {selectedTx?.gateway_payment_id || selectedTx?.order_number}</DialogTitle>
        <DialogContent>
          {selectedTx && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Order Number</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedTx.order_number}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedTx.amount.toFixed(2)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Gateway & Method</Typography>
                  <Typography variant="body2">{selectedTx.gateway} ({selectedTx.method})</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="body2">{selectedTx.status.toUpperCase()}</Typography>
                </Grid>
                {selectedTx.upi_vpa && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">UPI ID (VPA)</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{selectedTx.upi_vpa}</Typography>
                  </Grid>
                )}
                {selectedTx.card_last4 && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">Card</Typography>
                    <Typography variant="body2">
                      {selectedTx.card_network} ending in {selectedTx.card_last4} ({selectedTx.card_issuer})
                    </Typography>
                  </Grid>
                )}
                {selectedTx.error_description && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="error">Failure Reason</Typography>
                    <Typography variant="body2" color="error">
                      [{selectedTx.error_code}] {selectedTx.error_description}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedTx(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}