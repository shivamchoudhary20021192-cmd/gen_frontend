import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  Menu,
  MenuItem,
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
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
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
import { formatRelative } from '../../../lib/format'
import { useShop } from '../../../shop/useShop'
import { ConnectDialog } from './ConnectDialog'
import {
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  integrationKeys,
  type Category,
  type Connection,
  type ConnectionDetail,
  type Provider,
} from './integrationTypes'

const CATEGORIES: Category[] = ['payments', 'shipping', 'email', 'sms', 'whatsapp', 'tax']

function statusChip(connection: Connection) {
  if (!connection.available) return <Chip size="small" label="Provider retired" color="default" />
  if (connection.status === 'error') return <Chip size="small" label="Needs attention" color="error" />
  if (connection.status === 'disabled') return <Chip size="small" label="Off" />
  return <Chip size="small" label="Active" color="success" />
}

/**
 * Settings → Integrations: the services the store's money and messages flow
 * through — payment gateways, couriers, SMS/WhatsApp/email senders and tax
 * engines — each connected with the merchant's own account.
 */
export function IntegrationsPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const { summary } = useShop()
  const canManage = can('integrations.manage')
  const { flash, success, error: flashError, info, clear } = useFlash()
  const [browsing, setBrowsing] = useState(false)
  const [connecting, setConnecting] = useState<{ provider: Provider; connection?: Connection } | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<Connection | null>(null)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; connection: Connection } | null>(null)

  const connections = useQuery({ queryKey: integrationKeys.list, queryFn: () => api.get<{ connections: Connection[] }>('/integrations') })
  const catalog = useQuery({ queryKey: integrationKeys.catalog, queryFn: () => api.get<{ providers: Provider[] }>('/integrations/catalog'), staleTime: 10 * 60_000 })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['integrations'] })

  const providers = useMemo(() => new Map((catalog.data?.providers ?? []).map((provider) => [provider.key, provider])), [catalog.data])
  const list = connections.data?.connections ?? []

  const test = useMutation({
    mutationFn: (connection: Connection) => api.post<{ ok: boolean; message: string | null; account: string | null }>(`/integrations/${connection.id}/test`),
    onSuccess: (result, connection) => {
      if (result.ok) success(`${connection.name} works${result.account ? ` · ${result.account}` : ''}`)
      else flashError(result.message ?? `${connection.provider_name} rejected the keys.`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const makeDefault = useMutation({
    mutationFn: (connection: Connection) => api.post(`/integrations/${connection.id}/default`),
    onSuccess: (_result, connection) => {
      success(`${connection.name} is now used for ${CATEGORY_LABELS[connection.category].toLowerCase()}`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const setStatus = useMutation({
    mutationFn: ({ connection, status }: { connection: Connection; status: 'active' | 'disabled' }) => api.patch(`/integrations/${connection.id}`, { status }),
    onSuccess: (_result, { connection, status }) => {
      info(status === 'active' ? `${connection.name} turned on` : `${connection.name} turned off`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const disconnect = useMutation({
    mutationFn: (connection: Connection) => api.delete(`/integrations/${connection.id}`),
    onSuccess: (_result, connection) => {
      setDisconnecting(null)
      success(`${connection.name} disconnected`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const allowed = summary?.entitlements.features.third_party_integrations ?? true

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Your own accounts with payment, delivery, messaging and tax services."
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBrowsing(true)} disabled={!allowed}>
              Add integration
            </Button>
          )
        }
      />
      {!allowed && <UpgradeNotice message="Your plan does not include third-party integrations. Upgrade to connect your own accounts." />}

      {CATEGORIES.map((category) => {
        const inCategory = list.filter((connection) => connection.category === category)
        return (
          <SectionCard
            key={category}
            title={CATEGORY_LABELS[category]}
            description={CATEGORY_HINTS[category]}
            actions={
              canManage && allowed ? (
                <Button size="small" onClick={() => setBrowsing(true)}>
                  Connect
                </Button>
              ) : undefined
            }
            flush={inCategory.length > 0}
          >
            {inCategory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing connected. {category === 'payments' ? 'Checkout uses the platform defaults.' : ''}
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {inCategory.map((connection) => (
                    <TableRow key={connection.id} hover sx={{ cursor: 'pointer' }} onClick={() => setViewing(connection.id)}>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {connection.name}
                          </Typography>
                          {connection.is_default && <Chip size="small" label="In use" color="primary" />}
                          {connection.mode === 'test' && <Chip size="small" label="Test mode" color="warning" variant="outlined" />}
                        </Stack>
                        <Typography variant="caption">
                          {connection.provider_name}
                          {connection.channels?.length ? ` · ${connection.channels.join(', ')}` : ''}
                          {connection.credentials_hint ? ` · ${connection.credentials_hint}` : ''}
                        </Typography>
                        {connection.last_error && connection.status === 'error' && (
                          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                            {connection.last_error}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{statusChip(connection)}</TableCell>
                      <TableCell>
                        <Typography variant="caption">Used {formatRelative(connection.last_used_at)}</Typography>
                      </TableCell>
                      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                        {canManage && (
                          <IconButton size="small" onClick={(event) => setMenu({ anchor: event.currentTarget, connection })}>
                            <MoreHorizIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        )
      })}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu && [
          <MenuItem key="test" onClick={() => { test.mutate(menu.connection); setMenu(null) }}>
            Test connection
          </MenuItem>,
          <MenuItem
            key="settings"
            disabled={!providers.get(menu.connection.provider)}
            onClick={() => {
              const provider = providers.get(menu.connection.provider)
              if (provider) setConnecting({ provider, connection: menu.connection })
              setMenu(null)
            }}
          >
            Settings and keys
          </MenuItem>,
          <MenuItem key="default" disabled={menu.connection.is_default || menu.connection.status !== 'active'} onClick={() => { makeDefault.mutate(menu.connection); setMenu(null) }}>
            Use for {CATEGORY_LABELS[menu.connection.category].toLowerCase()}
          </MenuItem>,
          <MenuItem
            key="status"
            disabled={menu.connection.is_default && menu.connection.status === 'active'}
            onClick={() => {
              setStatus.mutate({ connection: menu.connection, status: menu.connection.status === 'disabled' ? 'active' : 'disabled' })
              setMenu(null)
            }}
          >
            {menu.connection.status === 'disabled' ? 'Turn on' : 'Turn off'}
          </MenuItem>,
          <MenuItem key="remove" sx={{ color: 'error.main' }} onClick={() => { setDisconnecting(menu.connection); setMenu(null) }}>
            Disconnect
          </MenuItem>,
        ]}
      </Menu>

      <CatalogDialog
        open={browsing}
        providers={catalog.data?.providers ?? []}
        connected={list}
        onClose={() => setBrowsing(false)}
        onPick={(provider) => {
          setBrowsing(false)
          setConnecting({ provider })
        }}
      />

      {connecting && (
        <ConnectDialog
          provider={connecting.provider}
          connection={connecting.connection}
          hasOthers={list.some((connection) => connection.category === connecting.provider.category && connection.id !== connecting.connection?.id)}
          onClose={() => setConnecting(null)}
          onSaved={(detail) => {
            setConnecting(null)
            success(`${detail.connection.name} ${connecting.connection ? 'saved' : 'connected'}${detail.connection.mode === 'test' ? ' in test mode' : ''}`)
            refresh()
          }}
        />
      )}

      <ConnectionDrawer id={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={Boolean(disconnecting)}
        title={`Disconnect ${disconnecting?.name ?? ''}?`}
        body={
          disconnecting?.is_default
            ? `This is the ${CATEGORY_LABELS[disconnecting.category].toLowerCase()} service in use. Anything relying on it falls back to the platform default, or stops.`
            : 'Its keys are deleted. Past orders and messages are kept.'
        }
        confirmLabel="Disconnect"
        destructive
        busy={disconnect.isPending}
        onConfirm={() => disconnecting && disconnect.mutate(disconnecting)}
        onClose={() => setDisconnecting(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function CatalogDialog({ open, providers, connected, onClose, onPick }: { open: boolean; providers: Provider[]; connected: Connection[]; onClose(): void; onPick(provider: Provider): void }) {
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const shown = providers.filter(
    (provider) =>
      (category === 'all' || provider.category === category) &&
      (!search || `${provider.name} ${provider.description}`.toLowerCase().includes(search.toLowerCase())),
  )
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add integration
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <TextField placeholder="Search services" value={search} onChange={(event) => setSearch(event.target.value)} size="small" fullWidth />
          <Tabs value={category} onChange={(_event, value) => setCategory(value)} variant="scrollable">
            <Tab value="all" label="All" />
            {CATEGORIES.map((key) => (
              <Tab key={key} value={key} label={CATEGORY_LABELS[key]} />
            ))}
          </Tabs>
          <Grid container spacing={1.5}>
            {shown.map((provider) => {
              const count = connected.filter((connection) => connection.provider === provider.key).length
              return (
                <Grid key={provider.key} size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardActionArea onClick={() => onPick(provider)} sx={{ height: '100%' }}>
                      <CardContent>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="subtitle2">{provider.name}</Typography>
                          {provider.recommended && <Chip size="small" label="Popular in your country" color="primary" variant="outlined" />}
                          {count > 0 && <Chip size="small" label="Connected" color="success" variant="outlined" />}
                        </Stack>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                          {CATEGORY_LABELS[provider.category]}
                          {provider.channels?.length ? ` · ${provider.channels.join(', ')}` : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {provider.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              )
            })}
            {shown.length === 0 && (
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary">
                  No services match.
                </Typography>
              </Grid>
            )}
          </Grid>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

const WEBHOOK_COLOR: Record<string, 'success' | 'default' | 'error' | 'info'> = { processed: 'success', ignored: 'default', failed: 'error', received: 'info' }

function ConnectionDrawer({ id, onClose }: { id: string | null; onClose(): void }) {
  const detail = useQuery({
    queryKey: integrationKeys.detail(id ?? ''),
    queryFn: () => api.get<ConnectionDetail>(`/integrations/${id}`),
    enabled: Boolean(id),
  })
  const data = detail.data
  return (
    <Drawer anchor="right" open={Boolean(id)} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 } } } }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{data?.connection.name ?? 'Integration'}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        {data && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              {statusChip(data.connection)}
              <Chip size="small" label={data.connection.mode === 'test' ? 'Test mode' : 'Live'} variant="outlined" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {data.connection.provider_name} · connected {formatRelative(data.connection.created_at)} · last verified {formatRelative(data.connection.last_verified_at)}
            </Typography>
            {data.connection.last_error && <Alert severity="error">{data.connection.last_error}</Alert>}
            {data.connection.inbound_url && (
              <Box>
                <Typography variant="subtitle2">Webhook URL</Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  Paste this into {data.connection.provider_name}'s dashboard so it can tell the store about payments and deliveries.
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', bgcolor: 'action.hover', borderRadius: 1, px: 1, py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', flex: 1 }}>
                    {data.connection.inbound_url}
                  </Typography>
                  <IconButton size="small" onClick={() => void navigator.clipboard?.writeText(data.connection.inbound_url ?? '')}>
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              </Box>
            )}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Recent webhooks
              </Typography>
              {data.recent_webhooks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  None received yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Event</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Received</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recent_webhooks.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Typography variant="body2">{event.type}</Typography>
                          {!event.signature_valid && (
                            <Typography variant="caption" color="error">
                              Bad signature
                            </Typography>
                          )}
                          {event.error && (
                            <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                              {event.error}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={event.status} color={WEBHOOK_COLOR[event.status]} />
                        </TableCell>
                        <TableCell>{formatRelative(event.received_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Stack>
        )}
      </Box>
    </Drawer>
  )
}
