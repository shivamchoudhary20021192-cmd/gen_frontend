import { Alert, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useDebounce } from '../../hooks/useDebounce'
import { errorMessage } from '../../lib/errors'
import { formatRelative } from '../../lib/format'
import { STATUS, type DomainStatus } from '../settings/domains/domainTypes'

interface ConsoleDomain {
  id: number
  hostname: string
  status: DomainStatus
  source: string
  is_primary: boolean
  shop: { id: number; handle: string; name: string }
  certificate: { status: string; expires_at: string | null }
  reason: string | null
  last_checked_at: string | null
  next_check_at: string | null
  status_changed_at: string | null
}

const ORDER: DomainStatus[] = ['misconfigured', 'ssl_failed', 'provisioning_ssl', 'pending_dns', 'active', 'expired']

/**
 * Every store's custom domains: how many are in each state, and the ones
 * that need someone to look — support's first stop for "my domain doesn't work".
 */
export function ConsoleDomainsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<DomainStatus | ''>('')
  const [q, setQ] = useState('')
  const search = useDebounce(q, 300)
  const query = { status: status || undefined, q: search || undefined, limit: 100 }
  const domains = useQuery({
    queryKey: ['console', 'domains', query],
    queryFn: () => platformApi.get<{ counts: Record<string, number>; edge: string; domains: ConsoleDomain[] }>('/domains', query),
    placeholderData: keepPreviousData,
  })
  const check = useMutation({
    mutationFn: (id: number) => platformApi.post<{ status: DomainStatus }>(`/domains/${id}/check`),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['console', 'domains'] }),
  })
  const counts = domains.data?.counts ?? {}
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

  return (
    <>
      <PageHeader title="Domains" subtitle={`${total.toLocaleString()} custom domains · edge: ${domains.data?.edge ?? '…'}`} />
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Chip label={`All · ${total}`} color={status === '' ? 'primary' : 'default'} onClick={() => setStatus('')} />
        {ORDER.map((key) => (
          <Chip key={key} label={`${STATUS[key].label} · ${counts[key] ?? 0}`} color={status === key ? 'primary' : STATUS[key].color === 'error' && (counts[key] ?? 0) > 0 ? 'error' : 'default'} variant={status === key ? 'filled' : 'outlined'} onClick={() => setStatus(key)} />
        ))}
      </Stack>
      {check.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(check.error)}</Alert>}
      <SectionCard title="Domains" actions={<TextField size="small" placeholder="Domain or store handle" value={q} onChange={(event) => setQ(event.target.value)} />} flush>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Domain</TableCell>
              <TableCell>Store</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Since</TableCell>
              <TableCell>Next check</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(domains.data?.domains ?? []).map((domain) => (
              <TableRow key={domain.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {domain.hostname}
                  </Typography>
                  {domain.reason && domain.status !== 'active' && (
                    <Typography variant="caption" color="text.secondary">
                      {domain.reason}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{domain.shop.name ?? domain.shop.handle}</TableCell>
                <TableCell>
                  <Tooltip title={STATUS[domain.status].hint}>
                    <Chip size="small" label={STATUS[domain.status].label} color={STATUS[domain.status].color} />
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRelative(domain.status_changed_at)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{domain.next_check_at ? formatRelative(domain.next_check_at) : 'stopped'}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" disabled={check.isPending} onClick={() => check.mutate(domain.id)}>
                    Check now
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!domains.isLoading && (domains.data?.domains.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No domains here.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </>
  )
}
