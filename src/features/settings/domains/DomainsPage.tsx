import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import LanguageIcon from '@mui/icons-material/Language'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { UpgradeNotice } from '../../../components/UpgradeNotice'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { formatDate, formatMoneyIn, formatRelative } from '../../../lib/format'
import { useShop } from '../../../shop/useShop'
import { BuyDomainDialog } from './BuyDomainDialog'
import { ConnectDomainDialog } from './ConnectDomainDialog'
import { DomainDrawer } from './DomainDrawer'
import { domainKeys, isLanguageDomain, languageName, STATUS, type Domain, type DomainsResponse, type Registration } from './domainTypes'
import { TransferInDialog } from './TransferInDialog'

/**
 * Settings → Domains, as Shopify has it: the primary domain the store
 * answers on, every other domain (redirecting to it, or serving a market),
 * connecting a domain you own, buying a new one, and the domains bought here.
 */
const REGISTRATION_STATUS: Record<Registration['status'], string> = {
  pending: 'Registering',
  transferring: 'Transferring',
  active: 'Active',
  expired: 'Expired',
  transferred_out: 'Moved out',
  failed: 'Did not go through',
}

export function DomainsPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const { summary, refresh: refreshShop } = useShop()
  const canManage = can('domains.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [connecting, setConnecting] = useState(false)
  const [buying, setBuying] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; domain: Domain } | null>(null)
  const [removing, setRemoving] = useState<Domain | null>(null)
  const [changingPrimary, setChangingPrimary] = useState(false)
  const [transferCode, setTransferCode] = useState<{ domain: string; auth_code: string } | null>(null)
  const [transferring, setTransferring] = useState<Domain | null>(null)

  const data = useQuery({
    queryKey: domainKeys.all,
    queryFn: () => api.get<DomainsResponse>('/domains'),
    // Pending domains change on their own (the sweep checks them): keep the list fresh while any are.
    refetchInterval: (query) => ((query.state.data as DomainsResponse | undefined)?.domains.some((domain) => domain.status === 'pending_dns' || domain.status === 'provisioning_ssl') ? 15_000 : false),
  })
  const store = (response: DomainsResponse) => queryClient.setQueryData(domainKeys.all, response)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: domainKeys.all })

  const verify = useMutation({
    mutationFn: (domain: Domain) => api.post(`/domains/${domain.id}/verify`),
    onSuccess: refresh,
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const primary = useMutation({
    mutationFn: (domain: Domain) => api.post<DomainsResponse>(`/domains/${domain.id}/primary`),
    onSuccess: (response, domain) => {
      store(response)
      setChangingPrimary(false)
      success(`${domain.hostname} is now your primary domain`)
      refreshShop()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (domain: Domain) => api.delete(`/domains/${domain.id}`),
    onSuccess: (_result, domain) => {
      setRemoving(null)
      success(`${domain.hostname} removed`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const autoRenew = useMutation({
    mutationFn: ({ registration, on }: { registration: Registration; on: boolean }) => api.patch<DomainsResponse>(`/domains/registrations/${registration.id}`, { auto_renew: on }),
    onSuccess: (response, { on, registration }) => {
      store(response)
      success(on ? `${registration.domain} renews automatically` : `${registration.domain} will not renew`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const reveal = useMutation({
    mutationFn: (registration: Registration) => api.post<{ domain: string; auth_code: string }>(`/domains/registrations/${registration.id}/transfer-code`),
    onSuccess: setTransferCode,
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const domains = useMemo(() => data.data?.domains ?? [], [data.data])
  const primaryDomain = domains.find((domain) => domain.is_primary) ?? domains.find((domain) => domain.kind === 'platform')
  const candidates = domains.filter((domain) => !domain.is_primary && !domain.market && !domain.locale && (domain.kind === 'platform' || domain.status === 'active'))
  const hasCustomDomains = summary?.entitlements.features.custom_domain ?? true
  const attention = domains.filter((domain) => domain.status === 'misconfigured' || domain.status === 'ssl_failed')

  const note = (domain: Domain): string | null => {
    if (domain.is_primary) return 'Your store’s address'
    if (domain.market) return `${domain.market.name}${domain.locale ? ` · ${languageName(domain.locale)}` : ''}${domain.pair && domain.redirect_to_primary ? ` · redirects to ${domain.pair.hostname}` : ''}`
    if (isLanguageDomain(domain)) return `Your store in ${languageName(domain.locale!)} — shoppers who choose ${languageName(domain.locale!)} come here`
    if (domain.locale && domain.pair && domain.redirect_to_primary) return `Redirects to ${domain.pair.hostname}`
    if (domain.redirect_to_primary && primaryDomain) return `Redirects to ${primaryDomain.hostname}`
    return null
  }

  return (
    <>
      <PageHeader
        title="Domains"
        subtitle="The addresses shoppers use to reach your store."
        actions={
          canManage && (
            <>
              <Button variant="outlined" startIcon={<ShoppingCartOutlinedIcon />} onClick={() => setBuying(true)} disabled={!hasCustomDomains}>
                Buy new domain
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setConnecting(true)} disabled={!hasCustomDomains}>
                Connect existing domain
              </Button>
            </>
          )
        }
      />

      {!hasCustomDomains && <UpgradeNotice message="Your plan does not include your own domain. Upgrade to connect or buy one." />}
      {data.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(data.error)}</Alert>}
      {attention.map((domain) => (
        <Alert
          key={domain.id}
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setOpen(domain.id)}>
              Review
            </Button>
          }
        >
          <strong>{domain.hostname}</strong>: {domain.reason ?? STATUS[domain.status].hint}
        </Alert>
      ))}

      <SectionCard
        title="Primary domain"
        description="Shoppers see this address. Your other domains redirect here, keeping the page they asked for — except the ones you give a market or a language."
        actions={
          canManage &&
          candidates.length > 0 && (
            <Button size="small" onClick={() => setChangingPrimary(true)}>
              Change primary domain
            </Button>
          )
        }
      >
        {primaryDomain && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <LanguageIcon color="action" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {primaryDomain.hostname}
            </Typography>
            <Chip size="small" label={primaryDomain.kind === 'platform' ? 'Platform address' : 'Connected'} color={primaryDomain.kind === 'platform' ? 'default' : 'success'} />
          </Stack>
        )}
      </SectionCard>

      <SectionCard title="All domains" description="Select a domain for its DNS records, certificate and settings." flush>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Domain</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last checked</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {domains.map((domain) => {
              const status = STATUS[domain.status]
              return (
                <TableRow key={domain.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(domain.id)}>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {domain.hostname}
                      </Typography>
                      {domain.is_primary && <Chip size="small" label="Primary" color="primary" />}
                      {domain.market && <Chip size="small" label={domain.market.name} variant="outlined" />}
                      {isLanguageDomain(domain) && <Chip size="small" label={languageName(domain.locale!)} variant="outlined" />}
                      {domain.source === 'purchased' && <Chip size="small" label="Bought here" variant="outlined" />}
                      {domain.source === 'transferred' && <Chip size="small" label="Managed here" variant="outlined" />}
                    </Stack>
                    {note(domain) && (
                      <Typography variant="caption" color="text.secondary">
                        {note(domain)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {domain.kind === 'platform' ? (
                      <Chip size="small" label="Connected" color="success" />
                    ) : (
                      <Tooltip title={domain.reason ?? status.hint}>
                        <Chip size="small" label={status.label} color={status.color} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>{domain.kind === 'custom' ? formatRelative(domain.last_checked_at) : '—'}</TableCell>
                  <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                    {canManage && (
                      <IconButton size="small" aria-label={`Actions for ${domain.hostname}`} onClick={(event) => setMenu({ anchor: event.currentTarget, domain })}>
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </SectionCard>

      {(data.data?.registrations.length ?? 0) > 0 && (
        <SectionCard title="Managed here" description="Bought or transferred here: renewals are added to your bill, and you can move them out at any time." flush>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Domain</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Renewal</TableCell>
                <TableCell>Auto-renew</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data!.registrations.map((registration) => (
                <TableRow key={registration.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {registration.domain}
                    </Typography>
                    {registration.status === 'transferring' && (
                      <Typography variant="caption" color="text.secondary">
                        Transfer in progress — usually 5–7 days. Your current provider may email you to approve it.
                      </Typography>
                    )}
                    {registration.last_error && registration.status !== 'transferring' && (
                      <Typography variant="caption" color="error">
                        {registration.last_error}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{registration.status === 'active' ? formatDate(registration.expires_at) : <Chip size="small" label={REGISTRATION_STATUS[registration.status]} color={registration.status === 'failed' ? 'error' : registration.status === 'transferring' ? 'info' : 'default'} variant="outlined" />}</TableCell>
                  <TableCell>{formatMoneyIn(registration.renewal.amount, registration.renewal.currency)}/year</TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={registration.auto_renew}
                      disabled={!canManage || autoRenew.isPending || registration.status !== 'active'}
                      onChange={(event) => autoRenew.mutate({ registration, on: event.target.checked })}
                      slotProps={{ input: { 'aria-label': `Auto-renew ${registration.domain}` } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {canManage && registration.status === 'active' && (
                      <Button size="small" disabled={reveal.isPending} onClick={() => reveal.mutate(registration)}>
                        Transfer out
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      <SectionCard title="How it works" description="Nothing to install and no certificates to manage.">
        <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 } }}>
          <Typography component="li" variant="body2">
            Connecting takes one DNS record at your domain provider (two for a root domain like example.com). We show exactly what to add, check it for you, and tell you what is wrong if it does not work.
          </Typography>
          <Typography component="li" variant="body2">
            Shoppers reach your store through our global edge network, close to wherever they are. SSL certificates are issued and renewed automatically.
          </Typography>
          <Typography component="li" variant="body2">
            Selling abroad? Give a market its own domain (example.fr for France) with its own language and currency — open the domain and choose its market.
          </Typography>
          <Typography component="li" variant="body2">
            One domain per language? Open a domain and choose its language (fr.example.com in French). That language’s pages move there from the /fr/ folder, and search engines are told which address is which language.
          </Typography>
          {(data.data?.edge.addresses.ipv4.length ?? 0) > 0 && (
            <Typography component="li" variant="body2">
              Root domains point to {data.data!.edge.addresses.ipv4.join(', ')}; subdomains use a CNAME record we give each domain.
            </Typography>
          )}
        </Box>
      </SectionCard>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) setOpen(menu.domain.id)
            setMenu(null)
          }}
        >
          View details
        </MenuItem>
        <MenuItem
          disabled={Boolean(menu?.domain.is_primary || menu?.domain.market || menu?.domain.locale || (menu?.domain.kind === 'custom' && menu.domain.status !== 'active'))}
          onClick={() => {
            if (menu) primary.mutate(menu.domain)
            setMenu(null)
          }}
        >
          Set as primary
        </MenuItem>
        {menu?.domain.kind === 'custom' && (
          <MenuItem
            onClick={() => {
              if (menu) verify.mutate(menu.domain)
              setMenu(null)
            }}
          >
            Verify now
          </MenuItem>
        )}
        {menu?.domain.kind === 'custom' && menu.domain.source === 'connected' && canManage && (
          <MenuItem
            disabled={menu.domain.status !== 'active' || (data.data?.registrations ?? []).some((registration) => registration.domain === menu.domain.root_domain && registration.status !== 'failed')}
            onClick={() => {
              if (menu) setTransferring(menu.domain)
              setMenu(null)
            }}
          >
            Transfer domain here
          </MenuItem>
        )}
        {menu?.domain.kind === 'custom' && (
          <MenuItem
            disabled={menu.domain.is_primary}
            sx={{ color: 'error.main' }}
            onClick={() => {
              setRemoving(menu.domain)
              setMenu(null)
            }}
          >
            Remove
          </MenuItem>
        )}
      </Menu>

      {connecting && (
        <ConnectDomainDialog
          onClose={() => {
            setConnecting(false)
            refresh()
          }}
          onDone={(message) => {
            setConnecting(false)
            success(message)
            refresh()
          }}
        />
      )}
      {buying && (
        <BuyDomainDialog
          onClose={() => setBuying(false)}
          onDone={(message) => {
            setBuying(false)
            success(message)
          }}
        />
      )}
      <DomainDrawer id={open} canManage={canManage} onClose={() => setOpen(null)} onChanged={success} />
      {transferring && (
        <TransferInDialog
          domain={transferring}
          onClose={() => setTransferring(null)}
          onDone={(message) => {
            setTransferring(null)
            success(message)
          }}
        />
      )}

      <Dialog open={changingPrimary} onClose={() => setChangingPrimary(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change primary domain</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your store will answer on this domain, and every other one will redirect to it. Search engines follow the change on their own.
          </Typography>
          <TextField
            select
            fullWidth
            label="Primary domain"
            value=""
            onChange={(event) => {
              const chosen = candidates.find((domain) => domain.id === Number(event.target.value))
              if (chosen) primary.mutate(chosen)
            }}
          >
            {candidates.map((domain) => (
              <MenuItem key={domain.id} value={domain.id}>
                {domain.hostname}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangingPrimary(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(transferCode)} onClose={() => setTransferCode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Transfer {transferCode?.domain}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Give this code to the registrar you are moving the domain to. The domain keeps working here until the transfer completes.
          </Typography>
          <Box sx={{ fontFamily: 'monospace', fontSize: 18, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center', letterSpacing: 1 }}>{transferCode?.auth_code}</Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferCode(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.hostname ?? ''}?`}
        body={removing?.source === 'purchased' ? 'The domain stays registered to you; it just stops pointing to your store.' : 'Visitors to this domain will no longer reach your store.'}
        confirmLabel="Remove domain"
        destructive
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
