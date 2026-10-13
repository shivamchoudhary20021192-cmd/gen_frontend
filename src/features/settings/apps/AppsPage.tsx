import {
  Alert,
  Avatar,
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
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AppsIcon from '@mui/icons-material/Apps'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SecretReveal } from '../../../components/SecretReveal'
import { SectionCard } from '../../../components/SectionCard'
import { UpgradeNotice } from '../../../components/UpgradeNotice'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage, isPlanError } from '../../../lib/errors'
import { formatDate, formatRelative } from '../../../lib/format'
import { useShop } from '../../../shop/useShop'
import { appKeys, type App, type Installation, type Scope, type StorefrontToken } from './appTypes'
import { ThemeExtensionDialog } from './ThemeExtensionDialog'

type TabKey = 'installed' | 'store' | 'develop'

function AppIcon({ name, url }: { name: string; url: string | null }) {
  return (
    <Avatar variant="rounded" src={url ?? undefined} sx={{ width: 36, height: 36, bgcolor: 'action.selected', color: 'text.primary', fontSize: 16 }}>
      {url ? null : name.charAt(0).toUpperCase()}
    </Avatar>
  )
}

/**
 * Settings → Apps and sales channels: apps installed from the app store,
 * the store's own custom apps (Admin API tokens), and Storefront API tokens
 * for a headless storefront.
 */
export function AppsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey | null) ?? 'installed'
  const { can } = useAuth()
  const { flash, success, error: flashError, clear } = useFlash()

  return (
    <>
      <PageHeader title="Apps and sales channels" subtitle="Extend your store, and let your own code talk to it." />
      <Tabs value={tab} onChange={(_event, value: TabKey) => setParams({ tab: value }, { replace: true })} sx={{ mb: 2 }}>
        <Tab value="installed" label="Installed" />
        <Tab value="store" label="App store" />
        {can('apps.develop') && <Tab value="develop" label="Develop apps" />}
      </Tabs>
      {tab === 'installed' && <InstalledApps onDone={success} onError={flashError} />}
      {tab === 'store' && <AppStore />}
      {tab === 'develop' && can('apps.develop') && <DevelopApps onDone={success} onError={flashError} />}
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function InstalledApps({ onDone, onError }: { onDone(message: string): void; onError(message: string): void }) {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const [removing, setRemoving] = useState<Installation | null>(null)
  const installations = useQuery({ queryKey: appKeys.installations, queryFn: () => api.get<{ installations: Installation[] }>('/apps') })
  const uninstall = useMutation({
    mutationFn: (installation: Installation) => api.delete(`/apps/installations/${installation.id}`),
    onSuccess: (_result, installation) => {
      setRemoving(null)
      onDone(`${installation.app?.name ?? 'App'} uninstalled`)
      void queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
    onError: (caught) => onError(errorMessage(caught)),
  })
  const list = (installations.data?.installations ?? []).filter((installation) => installation.status === 'active')

  return (
    <SectionCard title="Installed apps" flush={list.length > 0}>
      {list.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No apps installed. Browse the app store, or build your own under Develop apps.
        </Typography>
      ) : (
        <Table size="small">
          <TableBody>
            {list.map((installation) => (
              <TableRow key={installation.id} hover>
                <TableCell sx={{ width: 52 }}>
                  <AppIcon name={installation.app?.name ?? '?'} url={installation.app?.icon_url ?? null} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {installation.app?.name ?? 'Removed app'}
                    </Typography>
                    {installation.app?.distribution === 'custom' && <Chip size="small" label="Custom" variant="outlined" />}
                  </Stack>
                  <Typography variant="caption">
                    Installed {formatDate(installation.installed_at)} · {installation.granted_scopes.length} permission{installation.granted_scopes.length === 1 ? '' : 's'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <ScopeSummary scopes={installation.granted_scopes} />
                </TableCell>
                <TableCell align="right">
                  {installation.app?.app_url && (
                    <Button size="small" href={installation.app.app_url} target="_blank" rel="noopener">
                      Open
                    </Button>
                  )}
                  {can('apps.manage') && (
                    <Button size="small" color="error" onClick={() => setRemoving(installation)}>
                      Uninstall
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Uninstall ${removing?.app?.name ?? 'this app'}?`}
        body="Its access to your store is revoked immediately and its webhooks stop. The app is told it was removed."
        confirmLabel="Uninstall"
        destructive
        busy={uninstall.isPending}
        onConfirm={() => removing && uninstall.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
    </SectionCard>
  )
}

function ScopeSummary({ scopes }: { scopes: Scope[] }) {
  if (scopes.length === 0) return null
  const writes = scopes.filter((scope) => scope.scope.startsWith('write_')).length
  return (
    <Tooltip title={scopes.map((scope) => scope.description).join(' · ')}>
      <Typography variant="caption" sx={{ cursor: 'help', textDecoration: 'underline dotted' }}>
        {writes > 0 ? `Can change ${writes} area${writes === 1 ? '' : 's'}` : 'Read only'}
      </Typography>
    </Tooltip>
  )
}

function AppStore() {
  const catalog = useQuery({ queryKey: appKeys.catalog, queryFn: () => api.get<{ apps: App[] }>('/apps/catalog') })
  const apps = catalog.data?.apps ?? []
  if (!catalog.isLoading && apps.length === 0) {
    return (
      <SectionCard title="App store">
        <Stack spacing={1} sx={{ alignItems: 'center', py: 3 }}>
          <AppsIcon color="disabled" sx={{ fontSize: 40 }} />
          <Typography variant="body2" color="text.secondary">
            No public apps have been published yet.
          </Typography>
        </Stack>
      </SectionCard>
    )
  }
  return (
    <Grid container spacing={2}>
      {apps.map((app) => (
        <Grid key={app.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                <AppIcon name={app.name} url={app.icon_url} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {app.name}
                  </Typography>
                  <Typography variant="caption">{app.developer_name ?? 'Independent developer'}</Typography>
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                {app.tagline ?? app.description ?? ''}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center' }}>
                {app.installed ? (
                  <Chip size="small" label="Installed" color="success" />
                ) : app.app_url ? (
                  <Button size="small" variant="outlined" href={app.app_url} target="_blank" rel="noopener">
                    Install
                  </Button>
                ) : null}
                {app.privacy_policy_url && (
                  <Link href={app.privacy_policy_url} target="_blank" rel="noopener" variant="caption">
                    Privacy
                  </Link>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

function DevelopApps({ onDone, onError }: { onDone(message: string): void; onError(message: string): void }) {
  const queryClient = useQueryClient()
  const { summary } = useShop()
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<{ title: string; items: { label: string; value: string }[] } | null>(null)
  const [deleting, setDeleting] = useState<App | null>(null)
  const [rotating, setRotating] = useState<App | null>(null)
  const [tokenTitle, setTokenTitle] = useState('')
  const [revoking, setRevoking] = useState<StorefrontToken | null>(null)

  const [extending, setExtending] = useState<App | null>(null)
  const custom = useQuery({ queryKey: appKeys.custom, queryFn: () => api.get<{ apps: App[] }>('/apps/custom') })
  const tokens = useQuery({ queryKey: appKeys.storefrontTokens, queryFn: () => api.get<{ storefront_access_tokens: StorefrontToken[] }>('/storefront_access_tokens') })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['apps'] })

  const rotate = useMutation({
    mutationFn: (app: App) => api.post<{ access_token: string }>(`/apps/custom/${app.id}/access-token`),
    onSuccess: (result, app) => {
      setRotating(null)
      setRevealed({ title: `New token for ${app.name}`, items: [{ label: 'Admin API access token', value: result.access_token }] })
    },
    onError: (caught) => onError(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (app: App) => api.delete(`/apps/custom/${app.id}`),
    onSuccess: (_result, app) => {
      setDeleting(null)
      onDone(`${app.name} deleted`)
      refresh()
    },
    onError: (caught) => onError(errorMessage(caught)),
  })
  const createToken = useMutation({
    mutationFn: () => api.post<{ storefront_access_token: { id: number; title: string; access_token: string } }>('/storefront_access_tokens', { title: tokenTitle }),
    onSuccess: (result) => {
      setTokenTitle('')
      setRevealed({ title: result.storefront_access_token.title, items: [{ label: 'Storefront API access token', value: result.storefront_access_token.access_token }] })
      refresh()
    },
    onError: (caught) => onError(errorMessage(caught)),
  })
  const revoke = useMutation({
    mutationFn: (token: StorefrontToken) => api.delete(`/storefront_access_tokens/${token.id}`),
    onSuccess: () => {
      setRevoking(null)
      onDone('Token revoked')
      refresh()
    },
    onError: (caught) => onError(errorMessage(caught)),
  })

  const apiAccess = summary?.entitlements.features.api_access ?? true

  return (
    <>
      {!apiAccess && <UpgradeNotice message="Your plan does not include API access. Upgrade to build custom apps." />}
      <SectionCard
        title="Custom apps"
        description="Apps built for this store only: an Admin API token with exactly the permissions you choose."
        actions={
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setCreating(true)} disabled={!apiAccess}>
            Create app
          </Button>
        }
        flush={(custom.data?.apps.length ?? 0) > 0}
      >
        {(custom.data?.apps.length ?? 0) === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No custom apps yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>App</TableCell>
                <TableCell>Client ID</TableCell>
                <TableCell>Permissions</TableCell>
                <TableCell>Created</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {custom.data!.apps.map((app) => (
                <TableRow key={app.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{app.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{app.client_id}</TableCell>
                  <TableCell>
                    <ScopeSummary scopes={app.requested_scopes} />
                  </TableCell>
                  <TableCell>{formatDate(app.created_at)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setExtending(app)}>
                      Theme extension
                    </Button>
                    <Button size="small" onClick={() => setRotating(app)}>
                      New token
                    </Button>
                    <IconButton size="small" onClick={() => setDeleting(app)}>
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Storefront API tokens" description="Public tokens for a headless storefront or mobile app to read products and build carts. They cannot see orders or customers.">
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" label="Token name" placeholder="Mobile app" value={tokenTitle} onChange={(event) => setTokenTitle(event.target.value)} sx={{ minWidth: 260 }} />
          <Button variant="outlined" disabled={tokenTitle.trim().length < 2 || createToken.isPending} onClick={() => createToken.mutate()}>
            Create token
          </Button>
        </Stack>
        {(tokens.data?.storefront_access_tokens.length ?? 0) > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {tokens.data!.storefront_access_tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell>{token.title}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{token.token_hint}</TableCell>
                  <TableCell>{formatRelative(token.last_used_at)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" color="error" onClick={() => setRevoking(token)}>
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <ThemeExtensionDialog app={extending} onClose={() => setExtending(null)} onDeployed={onDone} />
      {creating && (
        <CreateCustomAppDialog
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false)
            setRevealed({
              title: `${result.app.name} is installed`,
              items: [
                { label: 'Admin API access token', value: result.access_token },
                { label: 'Client secret (verifies webhooks)', value: result.client_secret },
              ],
            })
            refresh()
          }}
        />
      )}

      <Dialog open={Boolean(revealed)} onClose={() => setRevealed(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{revealed?.title}</DialogTitle>
        <DialogContent>{revealed && <SecretReveal items={revealed.items} />}</DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setRevealed(null)}>
            I have copied it
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(rotating)}
        title={`New token for ${rotating?.name ?? ''}?`}
        body="The current token stops working immediately. Update anything that uses it."
        confirmLabel="Replace token"
        busy={rotate.isPending}
        onConfirm={() => rotating && rotate.mutate(rotating)}
        onClose={() => setRotating(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="Its token stops working and its webhooks are removed. This cannot be undone."
        confirmLabel="Delete app"
        destructive
        typeToConfirm={deleting?.name}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={Boolean(revoking)}
        title={`Revoke ${revoking?.title ?? ''}?`}
        body="Storefronts using this token stop working immediately."
        confirmLabel="Revoke"
        destructive
        busy={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        onClose={() => setRevoking(null)}
      />
    </>
  )
}

function CreateCustomAppDialog({ onClose, onCreated }: { onClose(): void; onCreated(result: { app: App; access_token: string; client_secret: string }): void }) {
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [error, setError] = useState<{ text: string; plan: boolean } | null>(null)
  const scopes = useQuery({ queryKey: appKeys.scopes, queryFn: () => api.get<{ scopes: Scope[] }>('/apps/scopes'), staleTime: Infinity })

  // read_x and write_x side by side, one row per area.
  const areas = useMemo(() => {
    const map = new Map<string, { read?: Scope; write?: Scope }>()
    for (const scope of scopes.data?.scopes ?? []) {
      const [verb, ...rest] = scope.scope.split('_')
      const area = rest.join('_')
      const entry = map.get(area) ?? {}
      if (verb === 'read') entry.read = scope
      else if (verb === 'write') entry.write = scope
      else entry.read = scope
      map.set(area, entry)
    }
    return [...map.entries()]
  }, [scopes.data])

  const toggle = (scope: string, on: boolean) => {
    const next = new Set(chosen)
    if (on) {
      next.add(scope)
      // Writing implies reading.
      if (scope.startsWith('write_')) next.add(scope.replace(/^write_/, 'read_'))
    } else {
      next.delete(scope)
      if (scope.startsWith('read_')) next.delete(scope.replace(/^read_/, 'write_'))
    }
    setChosen(next)
  }

  const create = useMutation({
    mutationFn: () => api.post<{ app: App; access_token: string; client_secret: string }>('/apps/custom', { name, scopes: [...chosen] }),
    onSuccess: onCreated,
    onError: (caught) => setError({ text: errorMessage(caught), plan: isPlanError(caught) }),
  })

  return (
    <Dialog open onClose={create.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create a custom app</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (error.plan ? <UpgradeNotice message={error.text} /> : <Alert severity="error">{error.text}</Alert>)}
          <TextField label="App name" value={name} onChange={(event) => setName(event.target.value)} placeholder="ERP sync" autoFocus fullWidth />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Admin API permissions
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
              Give the app only what it needs.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Area</TableCell>
                  <TableCell align="center">Read</TableCell>
                  <TableCell align="center">Write</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {areas.map(([area, entry]) => (
                  <TableRow key={area}>
                    <TableCell>
                      <Typography variant="body2">{area.replace(/_/g, ' ')}</Typography>
                      <Typography variant="caption">{(entry.write ?? entry.read)?.description}</Typography>
                    </TableCell>
                    {(['read', 'write'] as const).map((verb) => (
                      <TableCell key={verb} align="center">
                        {entry[verb] ? (
                          <FormControlLabel
                            sx={{ m: 0 }}
                            label=""
                            control={<Checkbox size="small" checked={chosen.has(entry[verb]!.scope)} onChange={(event) => toggle(entry[verb]!.scope, event.target.checked)} />}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending || name.trim().length < 2 || chosen.size === 0}>
          {create.isPending ? 'Creating…' : 'Create and install'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
