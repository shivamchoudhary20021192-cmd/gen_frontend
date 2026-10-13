import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { formatDate, formatMoneyIn } from '../../../lib/format'
import type { Plan } from '../../../shop/types'
import { useShop } from '../../../shop/useShop'
import {
  billingKeys,
  FEATURE_LABELS,
  LIMIT_LABELS,
  type BillingOverview,
  type CollectResult,
  type Invoice,
  type SubscriptionView,
} from './billingTypes'
import { BillingDetailsCard } from './BillingDetailsCard'
import { PaymentMethodDialog } from './PaymentMethodDialog'
import { loadStripe } from './stripe'

const STATUS_CHIP: Record<Invoice['status'], { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  paid: { label: 'Paid', color: 'success' },
  open: { label: 'Due', color: 'warning' },
  failed: { label: 'Failed', color: 'error' },
  void: { label: 'Void', color: 'default' },
}

const SUBSCRIPTION_CHIP: Record<string, { label: string; color: 'success' | 'info' | 'warning' | 'error' | 'default' }> = {
  trialing: { label: 'Free trial', color: 'info' },
  active: { label: 'Active', color: 'success' },
  past_due: { label: 'Payment overdue', color: 'warning' },
  frozen: { label: 'Frozen', color: 'error' },
  cancelled: { label: 'Cancelled', color: 'default' },
}

function price(plan: Plan): string {
  return plan.price.amount === 0 ? 'Free' : `${formatMoneyIn(plan.price.amount, plan.price.currency)}/${plan.price.interval === 'year' ? 'yr' : 'mo'}`
}

function describeOutcome(result: CollectResult): string {
  switch (result.outcome) {
    case 'paid':
      return `${result.invoice.number} is paid.`
    case 'already_settled':
      return `${result.invoice.number} was already settled.`
    case 'pending':
      return `${result.invoice.number} is waiting to be settled by invoice.`
    case 'requires_action':
      return 'Your bank wants you to confirm this payment.'
    default:
      return result.invoice.last_error ?? 'The card was declined.'
  }
}

/**
 * Settings → Plan and billing: the plan and what the store uses of it, the
 * card on file, what is owed, and every bill. Mirrors Shopify's Billing page.
 */
export function BillingPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const { summary, memberships, refresh } = useShop()
  const { flash, success, error: flashError, info, clear } = useFlash()
  const [cardOpen, setCardOpen] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [choosing, setChoosing] = useState<Plan | null>(null)
  const [overLimits, setOverLimits] = useState<{ limit: string; used: number; allowed: number }[] | null>(null)

  const canManage = can('billing.manage')
  const isOwner = memberships.find((membership) => membership.handle === summary?.shop.handle)?.is_owner ?? false

  const overview = useQuery({ queryKey: billingKeys.overview, queryFn: () => api.get<BillingOverview>('/billing') })
  const subscription = useQuery({ queryKey: billingKeys.subscription, queryFn: () => api.get<SubscriptionView>('/billing/subscription') })
  const plans = useQuery({ queryKey: billingKeys.plans, queryFn: () => api.get<{ plans: Plan[] }>('/billing/plans') })
  const invoices = useQuery({ queryKey: billingKeys.invoices, queryFn: () => api.get<{ invoices: Invoice[] }>('/billing/invoices') })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['billing'] })
    refresh()
  }

  const changePlan = useMutation({
    mutationFn: (plan: Plan) => api.post<SubscriptionView>('/billing/subscription', { plan: plan.handle }),
    onSuccess: (_result, plan) => {
      setChoosing(null)
      success(`You are now on ${plan.name}`)
      invalidate()
    },
    onError: (caught) => {
      setChoosing(null)
      if (caught instanceof ApiError && caught.code === 'PLAN_LIMIT_REACHED') {
        const over = (caught.details as { over?: { limit: string; used: number; allowed: number }[] } | undefined)?.over
        if (over?.length) {
          setOverLimits(over)
          return
        }
      }
      flashError(errorMessage(caught))
    },
  })

  const pay = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const result = await api.post<CollectResult>(`/billing/invoices/${invoice.id}/pay`)
      if (result.outcome !== 'requires_action' || !result.client_secret) return result
      // 3-D Secure: the cardholder approves in Stripe's window, then the
      // server re-reads the charge.
      const key = overview.data?.publishable_key
      if (!key) return result
      const stripe = (await loadStripe())(key)
      const confirmed = await stripe.confirmCardPayment(result.client_secret)
      if (confirmed.error) throw new Error(confirmed.error.message)
      return api.post<CollectResult>(`/billing/invoices/${invoice.id}/confirm`)
    },
    onSuccess: (result) => {
      if (result.outcome === 'paid' || result.outcome === 'already_settled') success(describeOutcome(result))
      else if (result.outcome === 'pending') info(describeOutcome(result))
      else flashError(describeOutcome(result))
      invalidate()
    },
    onError: (caught) => flashError(caught instanceof Error && !(caught instanceof ApiError) ? caught.message : errorMessage(caught)),
  })

  const current = subscription.data
  const plan = current?.plan ?? summary?.plan ?? null
  const sub = current?.subscription ?? null
  const chip = sub ? SUBSCRIPTION_CHIP[sub.status] : null

  return (
    <>
      <PageHeader title="Plan and billing" subtitle="What your store pays the platform, and how." />

      {overview.data?.frozen && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Your store is frozen because a bill could not be collected. Update your card or pay the bill below to reopen it.
        </Alert>
      )}

      {(overview.data?.outstanding.length ?? 0) > 0 && (
        <SectionCard title="Bills to pay" description="Charged automatically to your card; you can also pay now." flush>
          <InvoiceTable invoices={overview.data!.outstanding} onView={setViewing} onPay={canManage ? (invoice) => pay.mutate(invoice) : undefined} paying={pay.isPending} />
        </SectionCard>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title="Plan"
            actions={chip && <Chip size="small" label={chip.label} color={chip.color} />}
            description={
              sub?.status === 'trialing' && sub.trial_ends_at
                ? `Your free trial ends ${formatDate(sub.trial_ends_at)}. Add a card so the store keeps running.`
                : sub
                  ? `Next bill ${formatDate(sub.current_period_end)}.`
                  : 'No subscription yet.'
            }
          >
            {plan ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                  <Typography variant="h5">{plan.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {price(plan)}
                    {plan.transaction_fee_percent > 0 ? ` · ${plan.transaction_fee_percent}% transaction fee` : ''}
                  </Typography>
                </Stack>
                <Usage usage={current?.usage ?? {}} />
              </Stack>
            ) : (
              <Typography variant="body2">Choose a plan below.</Typography>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard
            title="Payment method"
            actions={
              canManage && overview.data?.provider !== 'manual' ? (
                <Button size="small" variant="outlined" onClick={() => setCardOpen(true)}>
                  {overview.data?.payment_method ? 'Replace' : 'Add card'}
                </Button>
              ) : undefined
            }
          >
            {overview.data?.payment_method ? (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CreditCardIcon color="action" />
                <Box>
                  <Typography variant="body2">{overview.data.payment_method.label}</Typography>
                  {overview.data.payment_method.expires && (
                    <Typography variant="caption">Expires {overview.data.payment_method.expires}</Typography>
                  )}
                </Box>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {overview.data?.provider === 'manual' ? 'This store is billed by invoice.' : 'No card on file.'}
              </Typography>
            )}
            {(overview.data?.pending_lines.length ?? 0) > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  On your next bill
                </Typography>
                {overview.data!.pending_lines.map((line, index) => (
                  <Stack key={index} direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      {line.description}
                    </Typography>
                    <Typography variant="body2">{formatMoneyIn(line.amount, line.currency)}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {overview.data && <BillingDetailsCard overview={overview.data} canManage={canManage} onSaved={success} />}

      <SectionCard title="Plans" description={isOwner ? 'Switching during the trial is free. After it, the unused part of your current plan is credited.' : 'Only the store owner can change the plan.'}>
        <Grid container spacing={2}>
          {(plans.data?.plans ?? []).map((option) => (
            <Grid key={option.handle} size={{ xs: 12, sm: 6, lg: 3 }}>
              <PlanCard plan={option} canChoose={isOwner && canManage} onChoose={() => setChoosing(option)} />
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      <SectionCard title="Bills" flush>
        {(invoices.data?.invoices.length ?? 0) === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No bills yet.
          </Typography>
        ) : (
          <InvoiceTable invoices={invoices.data!.invoices} onView={setViewing} />
        )}
      </SectionCard>

      {cardOpen && (
        <PaymentMethodDialog
          open
        onClose={() => setCardOpen(false)}
        onSaved={(result) => {
          setCardOpen(false)
          const failed = result.retried.filter((entry) => entry.outcome === 'failed')
          if (failed.length) flashError(`${result.payment_method.label} saved, but ${failed.length} bill${failed.length > 1 ? 's' : ''} still failed.`)
          else success(`${result.payment_method.label} saved${result.retried.length ? ' and unpaid bills settled' : ''}`)
          invalidate()
        }}
        />
      )}

      <InvoiceDialog id={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={Boolean(choosing)}
        title={`Switch to ${choosing?.name ?? ''}?`}
        body={
          sub?.status === 'trialing'
            ? 'Your trial carries over; you are not charged until it ends.'
            : `You are billed ${choosing ? price(choosing) : ''} from today, minus a credit for the unused part of ${plan?.name ?? 'your current plan'}.`
        }
        confirmLabel="Switch plan"
        busy={changePlan.isPending}
        onConfirm={() => choosing && changePlan.mutate(choosing)}
        onClose={() => setChoosing(null)}
      />

      <Dialog open={Boolean(overLimits)} onClose={() => setOverLimits(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reduce usage first</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Your store uses more than that plan allows:
          </Typography>
          {overLimits?.map((entry) => (
            <Typography key={entry.limit} variant="body2">
              {LIMIT_LABELS[entry.limit] ?? entry.limit}: {entry.used} used, {entry.allowed} allowed
            </Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverLimits(null)}>OK</Button>
        </DialogActions>
      </Dialog>

      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

/** "10,000 products", "50 GB of storage", "Unlimited apps". */
function limitText(key: string, value: number | null): string {
  if (key === 'storage_gb') return value === null ? 'Unlimited storage' : `${value.toLocaleString()} GB of storage`
  const label = LIMIT_LABELS[key].toLowerCase()
  if (value === null) return `Unlimited ${label}`
  return `${value.toLocaleString()} ${value === 1 ? label.replace(/s$/, '').replace(/ie$/, 'y') : label}`
}

function Usage({ usage }: { usage: SubscriptionView['usage'] }) {
  const entries = Object.entries(usage).filter(([key]) => LIMIT_LABELS[key])
  if (entries.length === 0) return null
  return (
    <Grid container spacing={2}>
      {entries.map(([key, { used, limit }]) => {
        const percent = limit ? Math.min(100, (used / limit) * 100) : 0
        return (
          <Grid key={key} size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">{LIMIT_LABELS[key]}</Typography>
              <Typography variant="body2" color="text.secondary">
                {used}
                {limit === null ? ' · unlimited' : ` of ${limit}`}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={limit === null ? 0 : percent}
              color={percent >= 100 ? 'error' : percent >= 80 ? 'warning' : 'primary'}
              sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
            />
          </Grid>
        )
      })}
    </Grid>
  )
}

function PlanCard({ plan, canChoose, onChoose }: { plan: Plan; canChoose: boolean; onChoose(): void }) {
  const features = Object.entries(plan.features).filter(([key, on]) => on && FEATURE_LABELS[key])
  const limits = Object.entries(plan.limits).filter(([key]) => LIMIT_LABELS[key])
  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderColor: plan.current ? 'primary.main' : undefined, borderWidth: plan.current ? 2 : 1 }}>
      <CardContent sx={{ flex: 1 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{plan.name}</Typography>
          {plan.current && <Chip size="small" label="Current" color="primary" />}
        </Stack>
        <Typography variant="h5" sx={{ mt: 1 }}>
          {price(plan)}
        </Typography>
        {plan.tagline && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {plan.tagline}
          </Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          {plan.transaction_fee_percent > 0 ? `${plan.transaction_fee_percent}% transaction fee` : 'No transaction fee'}
          {plan.trial_days > 0 ? ` · ${plan.trial_days}-day trial` : ''}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {limits.map(([key, value]) => (
            <Typography key={key} variant="body2">
              {limitText(key, value)}
            </Typography>
          ))}
          {features.map(([key]) => (
            <Stack key={key} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <CheckIcon sx={{ fontSize: 16 }} color="success" />
              <Typography variant="body2">{FEATURE_LABELS[key]}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
      {!plan.current && canChoose && (
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button variant="outlined" fullWidth onClick={onChoose}>
            Choose {plan.name}
          </Button>
        </CardActions>
      )}
    </Card>
  )
}

function InvoiceTable({ invoices, onView, onPay, paying }: { invoices: Invoice[]; onView(id: number): void; onPay?(invoice: Invoice): void; paying?: boolean }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Bill</TableCell>
          <TableCell>Period</TableCell>
          <TableCell>Issued</TableCell>
          <TableCell>Status</TableCell>
          <TableCell align="right">Total</TableCell>
          {onPay && <TableCell />}
        </TableRow>
      </TableHead>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id} hover sx={{ cursor: 'pointer' }} onClick={() => onView(invoice.id)}>
            <TableCell>{invoice.number}</TableCell>
            <TableCell>{invoice.period_start ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}` : '—'}</TableCell>
            <TableCell>{formatDate(invoice.issued_at)}</TableCell>
            <TableCell>
              <Chip size="small" label={STATUS_CHIP[invoice.status].label} color={STATUS_CHIP[invoice.status].color} />
            </TableCell>
            <TableCell align="right">{formatMoneyIn(invoice.total, invoice.currency)}</TableCell>
            {onPay && (
              <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                {(invoice.status === 'open' || invoice.status === 'failed') && (
                  <Button size="small" variant="contained" disabled={paying} onClick={() => onPay(invoice)}>
                    Pay now
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function InvoiceDialog({ id, onClose }: { id: number | null; onClose(): void }) {
  const invoice = useQuery({
    queryKey: billingKeys.invoice(id ?? 0),
    queryFn: () => api.get<{ invoice: Invoice }>(`/billing/invoices/${id}`),
    enabled: id !== null,
  })
  const data = invoice.data?.invoice
  return (
    <Dialog open={id !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{data ? `Bill ${data.number}` : 'Bill'}</DialogTitle>
      <DialogContent>
        {data && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip size="small" label={STATUS_CHIP[data.status].label} color={STATUS_CHIP[data.status].color} />
              <Typography variant="body2" color="text.secondary">
                Issued {formatDate(data.issued_at)}
                {data.paid_at ? ` · paid ${formatDate(data.paid_at)}` : ''}
              </Typography>
            </Stack>
            {data.last_error && data.status !== 'paid' && <Alert severity="error">{data.last_error}</Alert>}
            <Table size="small">
              <TableBody>
                {(data.lines ?? []).filter((line) => line.kind !== 'tax').map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {line.description}
                      {line.period_start && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          {formatDate(line.period_start)} – {formatDate(line.period_end)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{formatMoneyIn(line.amount, data.currency)}</TableCell>
                  </TableRow>
                ))}
                {(data.tax_total ?? 0) > 0 && (
                  <>
                    <TableRow>
                      <TableCell>Subtotal</TableCell>
                      <TableCell align="right">{formatMoneyIn(data.subtotal ?? data.total, data.currency)}</TableCell>
                    </TableRow>
                    {(data.lines ?? [])
                      .filter((line) => line.kind === 'tax')
                      .map((line, index) => (
                        <TableRow key={`tax-${index}`}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell align="right">{formatMoneyIn(line.amount, data.currency)}</TableCell>
                        </TableRow>
                      ))}
                  </>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatMoneyIn(data.total, data.currency)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {(data.tax_note || data.customer_tax_id) && (
              <Typography variant="caption" color="text.secondary">
                {data.tax_note ?? `Your tax ID: ${data.customer_tax_id}`}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
