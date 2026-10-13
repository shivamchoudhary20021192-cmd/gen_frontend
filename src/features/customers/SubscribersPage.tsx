import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Grid,
  InputAdornment,
  Pagination,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import SearchIcon from '@mui/icons-material/Search'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api, tokenStore } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import { errorMessage } from '../../lib/errors'
import { countryName, formatDate } from '../../lib/format'

/**
 * Customers → Subscribers: everyone on the store's mailing list — from the
 * theme's footer and email-signup sections, the password page, and the
 * checkout's "Email me with news and offers". Export for an email tool.
 */

interface Subscriber {
  id: number
  email: string
  status: 'subscribed' | 'unsubscribed'
  source: string
  customer: { id: number; name: string | null } | null
  country_code: string | null
  subscribed_at: string
  unsubscribed_at: string | null
}

const SOURCES: Record<string, string> = { footer: 'Store sign-up form', checkout: 'Checkout', popup: 'Pop-up', account: 'Account', import: 'Import', admin: 'Added by staff' }

export function SubscribersPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const [status, setStatus] = useState<'subscribed' | 'unsubscribed'>('subscribed')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [removing, setRemoving] = useState<Subscriber | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const term = useDebounce(search, 300)

  const list = useQuery({
    queryKey: ['newsletter', status, term, page],
    queryFn: () =>
      api.get<{ subscribers: Subscriber[]; counts: { subscribed: number; unsubscribed: number; new_last_30_days: number }; pagination: { pages: number; total: number } }>('/newsletter/subscribers', {
        status,
        q: term || undefined,
        page,
        limit: 50,
      }),
    placeholderData: keepPreviousData,
  })
  const unsubscribe = useMutation({
    mutationFn: (subscriber: Subscriber) => api.post(`/newsletter/subscribers/${subscriber.id}/unsubscribe`),
    onSuccess: () => {
      setRemoving(null)
      void queryClient.invalidateQueries({ queryKey: ['newsletter'] })
    },
  })

  const exportCsv = async () => {
    setExportError(null)
    try {
      const base = `${(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')}/admin/api/v1`
      const response = await fetch(`${base}/newsletter/subscribers/export`, { headers: { Authorization: `Bearer ${tokenStore.access ?? ''}` } })
      if (!response.ok) throw new Error(`Export failed (${response.status})`)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'Export failed')
    }
  }

  const counts = list.data?.counts
  return (
    <>
      <PageHeader
        title="Subscribers"
        subtitle="People who asked for your emails."
        actions={
          can('customers.export') && (
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void exportCsv()}>
              Export CSV
            </Button>
          )
        }
      />
      {(list.isError || exportError) && <Alert severity="error" sx={{ mb: 2 }}>{exportError ?? errorMessage(list.error)}</Alert>}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Subscribed', value: counts?.subscribed },
          { label: 'Joined in the last 30 days', value: counts?.new_last_30_days },
          { label: 'Unsubscribed', value: counts?.unsubscribed },
        ].map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 4 }}>
            <Card sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {stat.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {stat.value ?? '—'}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, px: 2, pt: 1 }}>
          <Tabs value={status} onChange={(_event, next) => { setStatus(next); setPage(1) }} sx={{ flex: 1 }}>
            <Tab value="subscribed" label="Subscribed" />
            <Tab value="unsubscribed" label="Unsubscribed" />
          </Tabs>
          <TextField
            size="small"
            placeholder="Search email"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Country</TableCell>
              <TableCell>{status === 'subscribed' ? 'Subscribed' : 'Unsubscribed'}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(list.data?.subscribers ?? []).map((subscriber) => (
              <TableRow key={subscriber.id} hover>
                <TableCell>{subscriber.email}</TableCell>
                <TableCell>
                  {subscriber.customer ? (
                    <RouterLink to={`/customers/${subscriber.customer.id}`}>{subscriber.customer.name ?? `Customer #${subscriber.customer.id}`}</RouterLink>
                  ) : (
                    <Typography variant="body2" color="text.secondary">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={SOURCES[subscriber.source] ?? subscriber.source} />
                </TableCell>
                <TableCell>{subscriber.country_code ? countryName(subscriber.country_code) : '—'}</TableCell>
                <TableCell>{formatDate(status === 'subscribed' ? subscriber.subscribed_at : (subscriber.unsubscribed_at ?? subscriber.subscribed_at))}</TableCell>
                <TableCell align="right">
                  {status === 'subscribed' && can('customers.update') && (
                    <Button size="small" color="inherit" onClick={() => setRemoving(subscriber)}>
                      Unsubscribe
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {list.data && list.data.subscribers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    {term ? `No one matches “${term}”.` : status === 'subscribed' ? 'No subscribers yet. Your theme’s email sign-up forms add them here.' : 'No one has unsubscribed.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {(list.data?.pagination.pages ?? 1) > 1 && (
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Pagination size="small" count={list.data!.pagination.pages} page={page} onChange={(_event, next) => setPage(next)} />
          </Box>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Unsubscribe ${removing?.email ?? ''}?`}
        body="They stop receiving marketing emails. The change is recorded in their consent history."
        confirmLabel="Unsubscribe"
        busy={unsubscribe.isPending}
        onConfirm={() => removing && unsubscribe.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
