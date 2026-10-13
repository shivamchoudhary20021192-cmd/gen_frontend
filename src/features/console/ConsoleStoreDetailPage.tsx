import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { api, platformApi } from '../../api/client'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { countryName, formatDate, formatMoneyIn, formatRelative } from '../../lib/format'
import { consoleKeys, STATUS_CHIP, type ConsolePlan, type ConsoleShopDetail } from './consoleTypes'
import { useOperator } from './useOperator'

type StatusAction = 'active' | 'frozen' | 'suspended'

const ACTIONS: Record<StatusAction, { label: string; body: string; destructive: boolean }> = {
  active: { label: 'Reactivate', body: 'The store opens again: storefront, checkout and a fully working admin.', destructive: false },
  frozen: { label: 'Freeze', body: 'The storefront closes and the admin becomes read-only until the reason is fixed. Use for unpaid bills.', destructive: true },
  suspended: { label: 'Suspend', body: 'The store is shut: no storefront, and staff can only look. Use for abuse, fraud or a policy breach.', destructive: true },
}

/** One store, as an operator sees it: who owns it, what it pays, what it bills, and the levers to pull. */
export function ConsoleStoreDetailPage() {
  const { id = '0' } = useParams()
  const shopId = Number(id)
  const queryClient = useQueryClient()
  const { canAct } = useOperator()
  const { flash, success, error: flashError, clear } = useFlash()
  const [action, setAction] = useState<StatusAction | null>(null)
  const [reason, setReason] = useState('')
  const [plan, setPlan] = useState('')

  const detail = useQuery({ queryKey: consoleKeys.shop(shopId), queryFn: () => platformApi.get<ConsoleShopDetail>(`/shops/${shopId}`) })
  const plans = useQuery({ queryKey: consoleKeys.plans, queryFn: () => platformApi.get<{ plans: ConsolePlan[] }>('/plans') })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['console'] })
  }

  const setStatus = useMutation({
    mutationFn: () => platformApi.post(`/shops/${shopId}/status`, { status: action, reason }),
    onSuccess: () => {
      success(`${detail.data?.shop.name ?? 'Store'} is now ${action}`)
      setAction(null)
      setReason('')
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const changePlan = useMutation({
    mutationFn: (handle: string) => platformApi.post(`/shops/${shopId}/plan`, { plan: handle }),
    onSuccess: (_result, handle) => {
      success(`Moved to ${handle}`)
      setPlan('')
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const openAdmin = useMutation({
    mutationFn: () => api.post('/auth/switch-shop', { shop: shopId }),
    onSuccess: () => {
      queryClient.clear()
      window.location.assign(`${import.meta.env.BASE_URL}dashboard`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const data = detail.data
  if (detail.isError) return <Alert severity="error">{errorMessage(detail.error)}</Alert>
  if (!data) return <PageHeader title="Store" />
  const shop = data.shop
  const chip = STATUS_CHIP[shop.status]
  const primary = data.domains.find((domain) => domain.is_primary === 1)

  return (
    <>
      <PageHeader
        title={shop.name}
        subtitle={`${shop.handle} · opened ${formatDate(shop.created_at)}`}
        back={
          <IconButton component={RouterLink} to="/console/stores" size="small" sx={{ mb: 1 }} aria-label="Back to stores">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        }
        actions={
          <>
            {primary && (
              <Button variant="outlined" endIcon={<OpenInNewIcon fontSize="small" />} href={`https://${primary.hostname}`} target="_blank" rel="noopener">
                Storefront
              </Button>
            )}
            <Button variant="contained" disabled={shop.status === 'closed' || openAdmin.isPending} onClick={() => openAdmin.mutate()}>
              Open store admin
            </Button>
          </>
        }
      />

      {shop.status_reason && shop.status !== 'active' && (
        <Alert severity={shop.status === 'suspended' ? 'error' : 'warning'} sx={{ mb: 2 }}>
          {chip.label}: {shop.status_reason}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Store">
            <Table size="small">
              <TableBody>
                {[
                  ['Status', <Chip key="s" size="small" label={chip.label} color={chip.color} />],
                  ['Country', `${countryName(shop.country_code)} · ${shop.currency}`],
                  ['Sells', shop.vertical],
                  ['Time zone', shop.timezone],
                  ['Email', shop.email ?? '—'],
                  ['Phone', shop.phone ?? '—'],
                  ['Pod', String(shop.pod_id)],
                  ['Provisioned', formatDate(shop.provisioned_at)],
                ].map(([label, value]) => (
                  <TableRow key={String(label)}>
                    <TableCell sx={{ width: 160, color: 'text.secondary' }}>{label}</TableCell>
                    <TableCell>{value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Staff" flush>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Person</TableCell>
                  <TableCell>Access</TableCell>
                  <TableCell align="right">Last seen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.staff.map((member) => (
                  <TableRow key={member.admin_user_id}>
                    <TableCell>
                      <Typography variant="body2">{[member.first_name, member.last_name].filter(Boolean).join(' ')}</Typography>
                      <Typography variant="caption">{member.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {member.is_owner === 1 && <Chip size="small" label="Owner" color="primary" />}
                        {member.is_owner !== 1 && member.has_full_access === 1 && <Chip size="small" label="Full access" />}
                        {member.status !== 'active' && <Chip size="small" label={member.status} variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{formatRelative(member.last_accessed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Domains" flush>
            <Table size="small">
              <TableBody>
                {data.domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell>{domain.hostname}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {domain.is_primary === 1 && <Chip size="small" label="Primary" />}
                        <Chip size="small" variant="outlined" label={domain.kind === 'platform' ? 'Platform' : domain.verification_status} />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="Plan and subscription">
            <Stack spacing={1.5}>
              <Typography variant="h6">{data.plan?.name ?? 'No plan'}</Typography>
              {data.subscription ? (
                <Typography variant="body2" color="text.secondary">
                  {data.subscription.status} · {formatMoneyIn(Number(data.subscription.price_amount), data.subscription.currency)}/{data.subscription.billing_interval === 'year' ? 'yr' : 'mo'}
                  {data.subscription.trial_ends_at && data.subscription.status === 'trialing' ? ` · trial ends ${formatDate(data.subscription.trial_ends_at)}` : ''}
                  {` · renews ${formatDate(data.subscription.current_period_end)} · billed by ${data.subscription.provider}`}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No live subscription.
                </Typography>
              )}
              {canAct && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
                  <TextField select size="small" label="Move to plan" value={plan} onChange={(event) => setPlan(event.target.value)} sx={{ flex: 1 }}>
                    {(plans.data?.plans ?? [])
                      .filter((entry) => entry.is_active === 1 && entry.id !== data.plan?.id)
                      .map((entry) => (
                        <MenuItem key={entry.id} value={entry.handle}>
                          {entry.name}
                          {entry.is_public === 1 ? '' : ' (private)'}
                        </MenuItem>
                      ))}
                  </TextField>
                  <Button variant="outlined" disabled={!plan || changePlan.isPending} onClick={() => changePlan.mutate(plan)}>
                    Move
                  </Button>
                </Stack>
              )}
              <Typography variant="caption">Moving a store here skips the merchant's own checks and proration; use it for support and custom deals.</Typography>
            </Stack>
          </SectionCard>

          {canAct && shop.status !== 'closed' && shop.status !== 'provisioning' && (
            <SectionCard title="Store status" description="Every change is written to the audit log with its reason.">
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {(Object.keys(ACTIONS) as StatusAction[])
                  .filter((key) => key !== shop.status)
                  .map((key) => (
                    <Button key={key} variant="outlined" color={ACTIONS[key].destructive ? 'error' : 'primary'} onClick={() => setAction(key)}>
                      {ACTIONS[key].label}
                    </Button>
                  ))}
              </Stack>
            </SectionCard>
          )}

          <SectionCard title="Bills" flush>
            {data.invoices.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
                No bills yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {data.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number}</TableCell>
                      <TableCell>{formatDate(invoice.issued_at)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={invoice.status} color={invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'default' : 'warning'} />
                      </TableCell>
                      <TableCell align="right">{formatMoneyIn(invoice.total, invoice.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Button component={RouterLink} to={`/console/billing?shop_id=${shop.id}`} size="small" sx={{ m: 1 }}>
              All bills for this store
            </Button>
          </SectionCard>
        </Grid>
      </Grid>

      <Dialog open={Boolean(action)} onClose={setStatus.isPending ? undefined : () => setAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {action ? ACTIONS[action].label : ''} {shop.name}?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">{action ? ACTIONS[action].body : ''}</Typography>
            <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} helperText="Shown to the store's staff and kept in the audit log." size="small" autoFocus fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAction(null)} disabled={setStatus.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={action && ACTIONS[action].destructive ? 'error' : 'primary'}
            disabled={reason.trim().length < 3 || setStatus.isPending}
            onClick={() => setStatus.mutate()}
          >
            {action ? ACTIONS[action].label : ''}
          </Button>
        </DialogActions>
      </Dialog>
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
