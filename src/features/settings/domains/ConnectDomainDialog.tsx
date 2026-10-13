import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../../../api/client'
import { UpgradeNotice } from '../../../components/UpgradeNotice'
import { errorMessage, isPlanError } from '../../../lib/errors'
import { DnsRecordTable } from './DnsRecordTable'
import { domainKeys, STATUS, type DomainsResponse } from './domainTypes'
import { ProviderTips } from './ProviderTips'

type Step = { kind: 'enter' } | { kind: 'records'; hostnames: string[] } | { kind: 'transfer'; hostname: string; record: { type: string; name: string; value: string } }

/** example.com ↔ www.example.com, as the backend pairs them. */
function siblingOf(host: string): string | null {
  const labels = host.split('.')
  if (host.startsWith('www.') && labels.length === 3) return host.slice(4)
  if (labels.length === 2) return `www.${host}`
  return null
}

function clean(raw: string): string {
  return raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '')
}

/**
 * Connect an existing domain: type it, get the exact records to create
 * (with where to create them at common providers), and watch it connect.
 * A domain another store holds offers the move-it-here proof instead.
 */
export function ConnectDomainDialog({ onClose, onDone }: { onClose(): void; onDone(message: string): void }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>({ kind: 'enter' })
  const [hostname, setHostname] = useState('')
  const [withSibling, setWithSibling] = useState(true)
  const [error, setError] = useState<{ text: string; plan: boolean } | null>(null)
  const host = clean(hostname)
  const sibling = siblingOf(host)

  const domains = useQuery({
    queryKey: domainKeys.all,
    queryFn: () => api.get<DomainsResponse>('/domains'),
    enabled: step.kind === 'records',
    // While the merchant is at their DNS provider, keep the status live.
    refetchInterval: step.kind === 'records' ? 8_000 : false,
  })

  const connect = useMutation({
    mutationFn: () => api.post<DomainsResponse>('/domains', { hostname: host, include_sibling: withSibling }),
    onSuccess: (response) => {
      queryClient.setQueryData(domainKeys.all, response)
      const added = response.domains.filter((domain) => domain.hostname === host || (withSibling && domain.hostname === sibling)).map((domain) => domain.hostname)
      setStep({ kind: 'records', hostnames: added.length ? added : [host] })
    },
    onError: (caught) => {
      if (caught instanceof ApiError && caught.code === 'DOMAIN_TAKEN') {
        const transfer = (caught.details as { transfer?: { hostname: string; record: { type: string; name: string; value: string } } } | undefined)?.transfer
        if (transfer) {
          setStep({ kind: 'transfer', hostname: transfer.hostname, record: transfer.record })
          return
        }
      }
      setError({ text: errorMessage(caught), plan: isPlanError(caught) })
    },
  })

  const verify = useMutation({
    mutationFn: (id: number) => api.post(`/domains/${id}/verify`),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: domainKeys.all }),
    onError: (caught) => setError({ text: errorMessage(caught), plan: false }),
  })

  const move = useMutation({
    mutationFn: (name: string) => api.post<DomainsResponse>('/domains/transfer/complete', { hostname: name }),
    onSuccess: (response, name) => {
      queryClient.setQueryData(domainKeys.all, response)
      setError(null)
      setStep({ kind: 'records', hostnames: [name] })
    },
    onError: (caught) => setError({ text: errorMessage(caught), plan: false }),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    connect.mutate()
  }

  const shown = step.kind === 'records' ? (domains.data?.domains ?? []).filter((domain) => step.hostnames.includes(domain.hostname)) : []
  const allLive = shown.length > 0 && shown.every((domain) => domain.status === 'active')

  return (
    <Dialog open onClose={connect.isPending ? undefined : onClose} maxWidth={step.kind === 'enter' ? 'sm' : 'md'} fullWidth>
      {step.kind === 'enter' && (
        <form onSubmit={submit} noValidate>
          <DialogTitle>Connect existing domain</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && (error.plan ? <UpgradeNotice message={error.text} /> : <Alert severity="error">{error.text}</Alert>)}
              <TextField
                label="Domain"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="example.com"
                helperText="A domain you already own, such as example.com or shop.example.com."
                autoFocus
                fullWidth
              />
              {sibling && (
                <FormControlLabel
                  control={<Checkbox checked={withSibling} onChange={(event) => setWithSibling(event.target.checked)} />}
                  label={
                    <Typography variant="body2">
                      Also connect <strong>{sibling}</strong> — shoppers type both, and one redirects to the other.
                    </Typography>
                  }
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={connect.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={connect.isPending || host.length < 4 || !host.includes('.')}>
              {connect.isPending ? 'Checking…' : 'Next'}
            </Button>
          </DialogActions>
        </form>
      )}

      {step.kind === 'transfer' && (
        <>
          <DialogTitle>Move {step.hostname} to this store</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="info">This domain is connected to another store. If it is yours, prove it by adding this record at your domain provider — then it moves here and the other store stops using it.</Alert>
              {error && <Alert severity="error">{error.text}</Alert>}
              <DnsRecordTable records={[{ type: step.record.type as 'TXT', name: step.record.name, value: step.record.value, purpose: 'Proves you control this domain.', status: 'missing', found: [] }]} rootDomain={step.hostname} />
              <Typography variant="caption" color="text.secondary">
                DNS changes can take a while to show. You can close this and come back — the record stays valid.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
            <Button variant="contained" disabled={move.isPending} onClick={() => move.mutate(step.hostname)}>
              {move.isPending ? 'Checking…' : 'Verify and move it here'}
            </Button>
          </DialogActions>
        </>
      )}

      {step.kind === 'records' && (
        <>
          <DialogTitle>Connect {step.hostnames[0]}</DialogTitle>
          {(domains.isFetching || verify.isPending) && <LinearProgress sx={{ height: 2 }} />}
          <DialogContent>
            <Stack spacing={2.5}>
              {allLive ? (
                <Alert severity="success">Connected and secure. Make it your primary domain so shoppers see it everywhere.</Alert>
              ) : (
                <Typography variant="body2">
                  Add these records at your domain provider. We check automatically — this page updates on its own, and you will get a notification when it is connected.
                </Typography>
              )}
              {error && <Alert severity="error">{error.text}</Alert>}
              {shown.map((domain) => (
                <Box key={domain.id}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">{domain.hostname}</Typography>
                    <Chip size="small" label={STATUS[domain.status].label} color={STATUS[domain.status].color} />
                  </Stack>
                  {domain.dns?.problems
                    .filter((problem) => problem.severity !== 'info' || domain.status !== 'active')
                    .map((problem) => (
                      <Alert key={problem.code + problem.message} severity={problem.severity} sx={{ mb: 1 }}>
                        {problem.message}
                      </Alert>
                    ))}
                  {domain.status !== 'active' && domain.dns && <DnsRecordTable records={domain.dns.records} rootDomain={domain.root_domain} />}
                </Box>
              ))}
              {!allLive && (
                <>
                  <Divider />
                  <ProviderTips />
                  <Typography variant="caption" color="text.secondary">
                    Most changes show within an hour; some providers take up to 48. The SSL certificate is issued automatically once DNS points here.
                  </Typography>
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => (allLive ? onDone(`${step.hostnames[0]} is connected`) : onClose())}>{allLive ? 'Done' : 'Close — keep checking in the background'}</Button>
            {!allLive && shown[0] && (
              <Button variant="contained" disabled={verify.isPending} onClick={() => verify.mutate(shown[0].id)}>
                {verify.isPending ? 'Checking…' : 'Verify connection'}
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
