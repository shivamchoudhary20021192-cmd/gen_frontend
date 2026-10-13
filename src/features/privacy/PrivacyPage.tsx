import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
  Pagination,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import { useFlash } from '../../hooks/useFlash'
import { countryName, formatDate, formatRelative } from '../../lib/format'
import { NewPrivacyRequestDialog } from './NewPrivacyRequestDialog'
import { PrivacyRequestDrawer } from './PrivacyRequestDrawer'
import {
  METHOD_LABEL,
  privacyKeys,
  STATUS,
  TYPE_LABEL,
  type ConsentMethod,
  type ConsentRecord,
  type Overview,
  type RequestList,
} from './privacyTypes'

const REQUEST_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'verifying', label: 'Awaiting confirmation' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Refused' },
  { value: '', label: 'All' },
] as const

/**
 * Customers → Consents & privacy.
 *
 * Two records a store has to be able to produce: what each person asked of
 * it about their data and what it did (requests, with their legal deadlines),
 * and what each visitor agreed to (the consent record). The banner and the
 * policies themselves are configured in Settings; this page says whether
 * they are in place.
 */
export function PrivacyPage() {
  const { can } = useAuth()
  const canHandle = can('data_requests.manage')
  const { flash, success, clear } = useFlash()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'requests' | 'consents'>(params.get('tab') === 'consents' ? 'consents' : 'requests')
  const [open, setOpen] = useState<number | null>(params.get('request') ? Number(params.get('request')) : null)
  const [creating, setCreating] = useState(false)
  const overview = useQuery({ queryKey: privacyKeys.overview, queryFn: () => api.get<Overview>('/privacy/overview') })

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (tab === 'consents') next.set('tab', 'consents')
    else next.delete('tab')
    if (open) next.set('request', String(open))
    else next.delete('request')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [tab, open, params, setParams])

  const data = overview.data
  const privacyPolicy = data?.policies.find((policy) => policy.kind === 'privacy')
  const checklist = data
    ? [
        { ok: data.banner.enabled, done: 'Cookie banner is on', todo: 'Turn the cookie banner on', to: '/settings/customer-privacy' },
        { ok: Boolean(privacyPolicy?.published), done: 'Privacy policy is published', todo: 'Publish a privacy policy', to: '/settings/policies' },
        { ok: data.grievance_officer_named, done: 'Grievance officer is named', todo: 'Name a grievance officer (DPDP Act, E-Commerce Rules)', to: '/settings/customer-privacy' },
        { ok: Boolean(data.policies.find((policy) => policy.kind === 'refund')?.published), done: 'Refund policy is published', todo: 'Publish a refund policy', to: '/settings/policies' },
        { ok: Boolean(data.policies.find((policy) => policy.kind === 'contact')?.published), done: 'Contact information is published', todo: 'Publish your contact information', to: '/settings/policies' },
      ]
    : []

  return (
    <Box>
      <PageHeader
        title="Consents & privacy"
        subtitle="Privacy requests from customers, and the record of what visitors agreed to"
        actions={
          canHandle && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              New request
            </Button>
          )
        }
      />

      {overview.isError && <Alert severity="error" sx={{ mb: 2 }}>Privacy details could not be loaded.</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">Open requests</Typography>
            <Typography variant="h4" data-testid="privacy-open">{data?.requests.open ?? '—'}</Typography>
            <Typography variant="body2" color={data?.requests.overdue ? 'error' : 'text.secondary'}>
              {data ? (data.requests.overdue ? `${data.requests.overdue} past the deadline` : 'None past the deadline') : ' '}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">Cookie choices, last {data?.consents.days ?? 30} days</Typography>
            <Typography variant="h4">{data?.consents.total.toLocaleString() ?? '—'}</Typography>
            {data && data.consents.total > 0 ? (
              <Typography variant="body2" color="text.secondary">
                Analytics allowed {data.consents.allowed_percent.analytics}% · Marketing {data.consents.allowed_percent.marketing}% ·{' '}
                {data.consents.by_method.reject_all ?? 0} rejected all
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">No choices recorded yet</Typography>
            )}
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="overline" color="text.secondary">Compliance checklist</Typography>
              {data && (
                <Link href={data.storefront_url} target="_blank" rel="noreferrer" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  Storefront <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              )}
            </Stack>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {checklist.map((item) => (
                <Stack key={item.done} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {item.ok ? <CheckCircleIcon color="success" sx={{ fontSize: 18 }} /> : <ErrorOutlineIcon color="warning" sx={{ fontSize: 18 }} />}
                  {item.ok ? (
                    <Typography variant="body2">{item.done}</Typography>
                  ) : (
                    <Link component={RouterLink} to={item.to} variant="body2">{item.todo}</Link>
                  )}
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined">
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="requests" label="Privacy requests" />
          <Tab value="consents" label="Consent records" />
        </Tabs>
        {tab === 'requests' ? <RequestsTab onOpen={setOpen} /> : <ConsentsTab />}
      </Card>

      <PrivacyRequestDrawer id={open} canHandle={canHandle} onClose={() => setOpen(null)} onChanged={success} />
      <NewPrivacyRequestDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id, message) => {
          setCreating(false)
          setTab('requests')
          setOpen(id)
          success(message)
        }}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

function RequestsTab({ onOpen }: { onOpen(id: number): void }) {
  const [status, setStatus] = useState<string>('open')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim(), 300)
  const [page, setPage] = useState(1)
  const params = { status: status || undefined, type: type || undefined, q: search || undefined, page, limit: 25 }
  const list = useQuery({ queryKey: privacyKeys.requests(params), queryFn: () => api.get<RequestList>('/privacy/requests', params), placeholderData: keepPreviousData })
  const rows = list.data?.requests ?? []

  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ px: 2, pt: 1, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Tabs
          value={status}
          onChange={(_event, next: string) => {
            setStatus(next)
            setPage(1)
          }}
          variant="scrollable"
        >
          {REQUEST_TABS.map((entry) => (
            <Tab key={entry.value} value={entry.value} label={entry.value === 'open' && list.data ? `Open (${(list.data.counts.received ?? 0) + (list.data.counts.in_progress ?? 0) + (list.data.counts.scheduled ?? 0)})` : entry.label} />
          ))}
        </Tabs>
        <Stack direction="row" spacing={1} sx={{ pb: { xs: 1, md: 0 } }}>
          <TextField select size="small" label="Type" value={type} onChange={(event) => { setType(event.target.value); setPage(1) }} sx={{ minWidth: 160 }}>
            <MenuItem value="">All types</MenuItem>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            placeholder="Reference or email"
            value={q}
            onChange={(event) => { setQ(event.target.value); setPage(1) }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 220 }}
          />
        </Stack>
      </Stack>
      {list.isFetching && <LinearProgress sx={{ height: 2 }} />}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Request</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Respond by</TableCell>
              <TableCell>Received</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((request) => (
              <TableRow key={request.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(request.id)} data-request-row={request.reference}>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{request.reference}</TableCell>
                <TableCell>{TYPE_LABEL[request.type]}</TableCell>
                <TableCell>
                  <Typography variant="body2">{request.customer?.name || request.contact}</Typography>
                  {request.customer?.name && <Typography variant="caption" color="text.secondary">{request.contact}</Typography>}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={STATUS[request.status].label} color={STATUS[request.status].color} />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {request.status === 'scheduled' ? (
                    <Tooltip title="When the erasure runs">
                      <span>Erases {formatDate(request.scheduled_for)}</span>
                    </Tooltip>
                  ) : request.due_at && ['received', 'in_progress'].includes(request.status) ? (
                    <Typography variant="body2" color={request.overdue ? 'error' : 'text.primary'} sx={{ fontWeight: request.overdue ? 600 : 400 }}>
                      {formatDate(request.due_at)}{request.overdue ? ' · overdue' : ''}
                    </Typography>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRelative(request.created_at)}</TableCell>
              </TableRow>
            ))}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    {status === 'open' ? 'No open requests. Customers can make one from their account or your privacy request page.' : 'No requests here.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {list.data && list.data.pagination.total > list.data.pagination.limit && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <Pagination page={page} count={Math.ceil(list.data.pagination.total / list.data.pagination.limit)} onChange={(_event, next) => setPage(next)} />
        </Stack>
      )}
    </>
  )
}

function Purpose({ label, allowed }: { label: string; allowed: boolean }) {
  return <Chip size="small" variant={allowed ? 'filled' : 'outlined'} color={allowed ? 'success' : 'default'} label={label} sx={{ mr: 0.5 }} />
}

function ConsentsTab() {
  const [method, setMethod] = useState<ConsentMethod | ''>('')
  const [page, setPage] = useState(1)
  const params = { method: method || undefined, page, limit: 50 }
  const list = useQuery({
    queryKey: privacyKeys.consents(params),
    queryFn: () => api.get<{ consents: ConsentRecord[]; pagination: { page: number; limit: number; total: number } }>('/privacy/consents', params),
    placeholderData: keepPreviousData,
  })
  const rows = list.data?.consents ?? []
  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          Every choice a visitor made in the cookie banner, the preferences dialog or on the privacy choices page — the proof of consent the GDPR and the DPDP Act ask a store to keep. IP addresses are kept only to the network (/24), never the visitor.
        </Typography>
        <TextField select size="small" label="Choice" value={method} onChange={(event) => { setMethod(event.target.value as ConsentMethod | ''); setPage(1) }} sx={{ minWidth: 220 }}>
          <MenuItem value="">All choices</MenuItem>
          {Object.entries(METHOD_LABEL).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
      </Stack>
      {list.isFetching && <LinearProgress sx={{ height: 2 }} />}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Visitor</TableCell>
              <TableCell>Where</TableCell>
              <TableCell>Choice</TableCell>
              <TableCell>Allowed</TableCell>
              <TableCell>Policy</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((record) => (
              <TableRow key={record.id} data-consent-row={record.method}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRelative(record.created_at)}</TableCell>
                <TableCell>
                  {record.customer ? (
                    <Link component={RouterLink} to={`/customers/${record.customer.id}`}>{record.customer.name || record.customer.email || `Customer ${record.customer.id}`}</Link>
                  ) : (
                    <Tooltip title={`Consent ID ${record.consent_id}`}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{record.consent_id.slice(0, 8)}</Typography>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  {record.country ? countryName(record.country) : '—'}
                  <Typography variant="caption" color="text.secondary" component="div">
                    {record.consent_required ? 'Opt-in region' : record.sale_opt_out_region ? 'Opt-out region' : 'No banner required'}
                    {record.ip_prefix ? ` · ${record.ip_prefix}` : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  {METHOD_LABEL[record.method]}
                  {record.gpc && <Chip size="small" label="GPC" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Purpose label="Analytics" allowed={record.purposes.analytics} />
                  <Purpose label="Marketing" allowed={record.purposes.marketing} />
                  <Purpose label="Preferences" allowed={record.purposes.preferences} />
                  <Purpose label="Sale of data" allowed={record.purposes.sale_of_data} />
                </TableCell>
                <TableCell>{record.policy_version ? `v${record.policy_version}` : '—'}</TableCell>
              </TableRow>
            ))}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography color="text.secondary">No consent choices recorded yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {list.data && list.data.pagination.total > list.data.pagination.limit && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <Pagination page={page} count={Math.ceil(list.data.pagination.total / list.data.pagination.limit)} onChange={(_event, next) => setPage(next)} />
        </Stack>
      )}
    </>
  )
}
