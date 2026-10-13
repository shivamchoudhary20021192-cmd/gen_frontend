import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { errorMessage } from '../../../lib/errors'
import { formatDate, formatRelative } from '../../../lib/format'
import { DnsRecordTable } from './DnsRecordTable'
import { domainKeys, isLanguageDomain, languageName, STATUS, type DomainDetail, type DomainEvent } from './domainTypes'

interface MarketOption {
  id: number
  name: string
  is_primary: boolean
  countries: string[]
}

interface LanguageOption {
  code: string
  name: string
  published: boolean
  primary: boolean
}

const STEPS = ['DNS points here', 'Ownership proven', 'Certificate issued', 'Live']

function stepOf(detail: DomainDetail['domain']): number {
  if (detail.status === 'active') return 4
  if (detail.status === 'provisioning_ssl' || detail.status === 'ssl_failed') return 2
  if (detail.ownership.verified) return 1
  return 0
}

const OWNERSHIP: Record<string, string> = {
  cname: 'its own CNAME record',
  txt: 'a TXT record',
  sibling: 'its www/root partner',
  registrar: 'buying it here',
  transfer: 'a TXT record (moved from another store)',
  platform: 'the platform',
}

function describe(event: DomainEvent): string {
  switch (event.event) {
    case 'added':
      return 'Added'
    case 'removed':
      return 'Removed'
    case 'primary':
      return 'Made primary'
    case 'claimed':
      return 'Moved here from another store'
    case 'settings':
      return `Settings changed${event.detail ? ` (${Object.keys(event.detail).join(', ')})` : ''}`
    case 'status_changed':
      return `${STATUS[(event.from ?? 'pending_dns') as keyof typeof STATUS]?.label ?? event.from} → ${STATUS[(event.to ?? 'pending_dns') as keyof typeof STATUS]?.label ?? event.to}`
    default:
      return event.event
  }
}

export function DomainDrawer({ id, canManage, onClose, onChanged }: { id: number | null; canManage: boolean; onClose(): void; onChanged(message: string): void }) {
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: domainKeys.one(id ?? 0), queryFn: () => api.get<DomainDetail>(`/domains/${id}`), enabled: id !== null })
  const markets = useQuery({ queryKey: ['markets'], queryFn: () => api.get<{ markets: MarketOption[] }>('/markets'), enabled: id !== null })
  const languages = useQuery({ queryKey: ['online-store', 'languages'], queryFn: () => api.get<{ languages: LanguageOption[] }>('/online-store/languages'), enabled: id !== null })

  const refresh = (data?: DomainDetail) => {
    if (data) queryClient.setQueryData(domainKeys.one(id ?? 0), data)
    void queryClient.invalidateQueries({ queryKey: domainKeys.all })
  }
  const verify = useMutation({ mutationFn: () => api.post<DomainDetail>(`/domains/${id}/verify`), onSuccess: (data) => refresh(data) })
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<DomainDetail>(`/domains/${id}`, body),
    onSuccess: (data) => {
      refresh(data)
      onChanged('Domain updated')
    },
  })

  const domain = detail.data?.domain
  const status = domain ? STATUS[domain.status] : null
  const error = verify.error ?? update.error

  return (
    // Above the admin's top bar, which sits over ordinary drawers.
    <Drawer anchor="right" open={id !== null} onClose={onClose} sx={{ zIndex: (theme) => theme.zIndex.modal }} slotProps={{ paper: { sx: { width: { xs: '100%', md: 760 } } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {domain?.hostname ?? 'Domain'}
          </Typography>
          {domain && status && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.25 }}>
              <Chip size="small" label={domain.kind === 'platform' ? 'Platform address' : status.label} color={domain.kind === 'platform' ? 'default' : status.color} />
              {domain.is_primary && <Chip size="small" label="Primary" color="primary" />}
              {domain.market && <Chip size="small" label={domain.market.name} variant="outlined" />}
            </Stack>
          )}
        </Box>
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>

      {detail.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {domain && domain.kind === 'custom' && (
        <Stack spacing={3} sx={{ p: 2.5 }}>
          {error && <Alert severity="error">{errorMessage(error)}</Alert>}
          <Stepper activeStep={stepOf(domain)} alternativeLabel>
            {STEPS.map((label, index) => (
              <Step key={label} completed={stepOf(domain) > index}>
                <StepLabel error={(domain.status === 'ssl_failed' && index === 2) || (domain.status === 'misconfigured' && index === 0)}>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box>
            <Typography variant="body2">{status?.hint}</Typography>
            {domain.reason && domain.status !== 'active' && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {domain.reason}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Last checked {formatRelative(domain.last_checked_at)}
              {domain.next_check_at ? ` · next check ${new Date(domain.next_check_at).getTime() > Date.parse(domain.last_checked_at ?? '') ? formatRelative(domain.next_check_at) : 'due'}` : ' · not checking automatically'}
              {domain.dns?.resolvers.length ? ` · via ${domain.dns.resolvers.map((resolver) => resolver.name).join(', ')}` : ''}
            </Typography>
          </Box>

          {domain.dns?.problems.map((problem) => (
            <Alert key={problem.code + problem.message} severity={problem.severity}>
              {problem.message}
            </Alert>
          ))}

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">DNS records</Typography>
              {canManage && (
                <Button size="small" variant="outlined" disabled={verify.isPending} onClick={() => verify.mutate()}>
                  {verify.isPending ? 'Checking…' : 'Verify now'}
                </Button>
              )}
            </Stack>
            {domain.dns && <DnsRecordTable records={domain.dns.records} rootDomain={domain.root_domain} />}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Ownership
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {domain.ownership.verified ? `Proven by ${OWNERSHIP[domain.ownership.method ?? ''] ?? 'DNS'}.` : 'Not proven yet.'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                SSL certificate
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {domain.certificate.status === 'active'
                  ? `Active${domain.certificate.issuer ? ` · ${domain.certificate.issuer}` : ''}${domain.certificate.expires_at ? ` · renews automatically before ${formatDate(domain.certificate.expires_at)}` : ''}`
                  : domain.certificate.status === 'pending'
                    ? 'Being issued.'
                    : domain.certificate.status === 'failed'
                      ? 'Could not be issued — see above.'
                      : 'Issued once DNS points here.'}
              </Typography>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              How it is used
            </Typography>
            <Stack spacing={2}>
              {isLanguageDomain(domain) && (
                <Alert severity="info" variant="outlined">
                  This is your store in {languageName(domain.locale!)}, for every market. Shoppers who choose {languageName(domain.locale!)} anywhere in your store come here, /{domain.locale}/ pages on your other domains redirect here, and search engines are told it is the {languageName(domain.locale!)} version.
                </Alert>
              )}
              {!domain.is_primary && !domain.market && !domain.locale && (
                <FormControlLabel
                  control={<Switch checked={domain.redirect_to_primary} disabled={!canManage || update.isPending} onChange={(event) => update.mutate({ redirect_to_primary: event.target.checked })} />}
                  label={
                    <Box>
                      <Typography variant="body2">Redirect to the primary domain</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Visitors (and search engines) are sent to your primary domain with a permanent redirect, keeping the page they asked for.
                      </Typography>
                    </Box>
                  }
                />
              )}
              {!domain.is_primary && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    select
                    size="small"
                    label="Market"
                    value={domain.market?.id ?? ''}
                    disabled={!canManage || update.isPending}
                    onChange={(event) => update.mutate({ market_id: event.target.value === '' ? null : Number(event.target.value) })}
                    helperText="A market's domain shows its prices and currency — like example.fr for France."
                    sx={{ minWidth: 240 }}
                  >
                    <MenuItem value="">No market (all shoppers)</MenuItem>
                    {(markets.data?.markets ?? [])
                      .filter((market) => !market.is_primary)
                      .map((market) => (
                        <MenuItem key={market.id} value={market.id}>
                          {market.name} ({market.countries.join(', ')})
                        </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Language"
                    value={domain.locale ?? ''}
                    disabled={!canManage || update.isPending}
                    onChange={(event) => update.mutate({ locale: event.target.value === '' ? null : event.target.value })}
                    helperText={domain.market ? 'The language this market’s domain shows at its root.' : 'Make this domain your store in one language — like fr.example.com in French.'}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="">The store's default</MenuItem>
                    {(languages.data?.languages ?? [])
                      .filter((language) => language.published)
                      .map((language) => (
                        <MenuItem key={language.code} value={language.code}>
                          {language.name}
                        </MenuItem>
                      ))}
                  </TextField>
                </Stack>
              )}
              {domain.is_primary && (
                <Typography variant="body2" color="text.secondary">
                  This is the address your store answers on. Your other domains and your platform address redirect here, except market and language domains.
                </Typography>
              )}
              {domain.pair && (
                <Typography variant="caption" color="text.secondary">
                  Paired with {domain.pair.hostname}: {domain.market || domain.locale ? 'it follows this domain’s market and language, redirecting here.' : 'one redirects to the other.'}
                </Typography>
              )}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              History
            </Typography>
            <Stack spacing={1}>
              {(detail.data?.events ?? []).map((event) => (
                <Stack key={event.id} direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 150, flexShrink: 0 }}>
                    {formatDate(event.at)}
                  </Typography>
                  <Typography variant="body2">
                    {describe(event)}
                    {typeof event.detail?.reason === 'string' && event.to !== 'active' ? (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        — {event.detail.reason}
                      </Typography>
                    ) : null}
                  </Typography>
                </Stack>
              ))}
              {!detail.data?.events.length && (
                <Typography variant="body2" color="text.secondary">
                  Nothing yet.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      {domain && domain.kind === 'platform' && (
        <Box sx={{ p: 2.5 }}>
          <Typography variant="body2">Every store has this address on the platform. It is always connected and secure{domain.is_primary ? '' : ', and redirects to your primary domain'}.</Typography>
        </Box>
      )}
    </Drawer>
  )
}
