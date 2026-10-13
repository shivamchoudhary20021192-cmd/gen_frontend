import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, platformApi } from '../../api/client'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SecretReveal } from '../../components/SecretReveal'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { consoleKeys, type ConsoleApp } from './consoleTypes'
import { useOperator } from './useOperator'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default' | 'info'> = { published: 'success', draft: 'info', delisted: 'default', in_review: 'warning' }

/**
 * The app store, curated. A public app is listed for every store once an
 * operator publishes it — and only if it handles privacy requests (the
 * compliance webhook). Custom apps belong to one store and are listed here
 * for support, never published.
 */
export function ConsoleAppsPage() {
  const queryClient = useQueryClient()
  const { canAct } = useOperator()
  const { flash, success, error: flashError, clear } = useFlash()
  const [registering, setRegistering] = useState(false)
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null)
  const [rotating, setRotating] = useState<ConsoleApp | null>(null)
  const [showCustom, setShowCustom] = useState(false)

  const apps = useQuery({ queryKey: consoleKeys.apps, queryFn: () => platformApi.get<{ apps: ConsoleApp[] }>('/apps') })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: consoleKeys.apps })

  const setListed = useMutation({
    mutationFn: ({ app, action }: { app: ConsoleApp; action: 'publish' | 'delist' }) => platformApi.post(`/apps/${app.id}/${action}`),
    onSuccess: (_result, { app, action }) => {
      success(action === 'publish' ? `${app.name} is in the app store` : `${app.name} is delisted`)
      refresh()
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const rotate = useMutation({
    mutationFn: (app: ConsoleApp) => platformApi.post<{ client_secret: string }>(`/apps/${app.id}/rotate-secret`),
    onSuccess: (result, app) => {
      setRotating(null)
      setSecret({ title: `New client secret for ${app.name}`, value: result.client_secret })
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const all = apps.data?.apps ?? []
  const list = all.filter((app) => showCustom || app.distribution === 'public')

  return (
    <>
      <PageHeader
        title="App store"
        subtitle={`${all.filter((app) => app.distribution === 'public' && app.status === 'published').length} published · ${all.filter((app) => app.distribution === 'custom').length} custom apps across stores`}
        actions={
          canAct && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRegistering(true)}>
              Register app
            </Button>
          )
        }
      />
      <SectionCard
        title="Apps"
        actions={<FormControlLabel control={<Checkbox size="small" checked={showCustom} onChange={(event) => setShowCustom(event.target.checked)} />} label="Include custom apps" />}
        flush
      >
        {list.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No apps registered yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>App</TableCell>
                <TableCell>Scopes</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Registered</TableCell>
                {canAct && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((app) => (
                <TableRow key={app.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Avatar variant="rounded" sx={{ width: 32, height: 32, fontSize: 14 }}>
                        {app.name.charAt(0)}
                      </Avatar>
                      <div>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {app.name}
                        </Typography>
                        <Typography variant="caption">
                          {app.developer_name ?? (app.distribution === 'custom' ? 'Custom app' : '—')} · {app.client_id}
                        </Typography>
                      </div>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{app.requested_scopes.map((scope) => scope.scope).join(', ') || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" label={app.status} color={STATUS_COLOR[app.status] ?? 'default'} />
                      {app.distribution === 'custom' && <Chip size="small" label="Custom" variant="outlined" />}
                      {app.distribution === 'public' && !app.compliance_webhook_url && <Chip size="small" label="No privacy webhook" color="warning" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDate(app.created_at)}</TableCell>
                  {canAct && (
                    <TableCell align="right">
                      {app.distribution === 'public' && app.status !== 'published' && (
                        <Button size="small" disabled={setListed.isPending} onClick={() => setListed.mutate({ app, action: 'publish' })}>
                          Publish
                        </Button>
                      )}
                      {app.distribution === 'public' && app.status === 'published' && (
                        <Button size="small" color="error" disabled={setListed.isPending} onClick={() => setListed.mutate({ app, action: 'delist' })}>
                          Delist
                        </Button>
                      )}
                      <Button size="small" color="inherit" onClick={() => setRotating(app)}>
                        New secret
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {registering && (
        <RegisterAppDialog
          onClose={() => setRegistering(false)}
          onCreated={(name, clientSecret) => {
            setRegistering(false)
            setSecret({ title: `${name} is registered`, value: clientSecret })
            refresh()
          }}
        />
      )}

      <Dialog open={Boolean(secret)} onClose={() => setSecret(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{secret?.title}</DialogTitle>
        <DialogContent>{secret && <SecretReveal items={[{ label: 'Client secret', value: secret.value }]} />}</DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSecret(null)}>
            I have copied it
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={Boolean(rotating)}
        title={`New client secret for ${rotating?.name ?? ''}?`}
        body="The current secret stops working immediately: the developer must update their app before installs and webhooks work again."
        confirmLabel="Replace secret"
        destructive
        busy={rotate.isPending}
        onConfirm={() => rotating && rotate.mutate(rotating)}
        onClose={() => setRotating(null)}
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function RegisterAppDialog({ onClose, onCreated }: { onClose(): void; onCreated(name: string, clientSecret: string): void }) {
  const scopes = useQuery({ queryKey: ['apps', 'scopes'], queryFn: () => api.get<{ scopes: { scope: string; description: string }[] }>('/apps/scopes'), staleTime: Infinity })
  const [draft, setDraft] = useState({
    name: '',
    tagline: '',
    developer_name: '',
    developer_email: '',
    app_url: '',
    redirect_url: '',
    privacy_policy_url: '',
    compliance_webhook_url: '',
  })
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }))

  const create = useMutation({
    mutationFn: () =>
      platformApi.post<{ app: ConsoleApp; client_secret: string }>('/apps', {
        name: draft.name.trim(),
        tagline: draft.tagline.trim() || null,
        developer_name: draft.developer_name.trim() || null,
        developer_email: draft.developer_email.trim() || null,
        app_url: draft.app_url.trim() || null,
        privacy_policy_url: draft.privacy_policy_url.trim() || null,
        compliance_webhook_url: draft.compliance_webhook_url.trim() || null,
        redirect_urls: draft.redirect_url.split(/\s+/).filter(Boolean),
        requested_scopes: [...chosen],
      }),
    onSuccess: (result) => onCreated(result.app.name, result.client_secret),
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      setError(errorMessage(caught))
    },
  })

  const field = (key: keyof typeof draft, label: string, helper?: string) => (
    <TextField label={label} value={draft[key]} onChange={(event) => set(key, event.target.value)} error={Boolean(errors[key])} helperText={errors[key] ?? helper} size="small" fullWidth />
  )

  return (
    <Dialog open onClose={create.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Register a public app</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>{field('name', 'App name')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('tagline', 'Tagline', 'One line on the app store card.')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('developer_name', 'Developer')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('developer_email', 'Developer email')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('app_url', 'App URL', 'Where merchants start the install.')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('redirect_url', 'Redirect URLs', 'Where OAuth sends the code back; space-separated.')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('privacy_policy_url', 'Privacy policy URL')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('compliance_webhook_url', 'Privacy webhook URL', 'Required before publishing: customer data requests and erasure.')}</Grid>
          </Grid>
          <div>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Scopes it will ask for
            </Typography>
            <Grid container spacing={0}>
              {(scopes.data?.scopes ?? []).map((scope) => (
                <Grid key={scope.scope} size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={chosen.has(scope.scope)}
                        onChange={(event) => {
                          const next = new Set(chosen)
                          if (event.target.checked) next.add(scope.scope)
                          else next.delete(scope.scope)
                          setChosen(next)
                        }}
                      />
                    }
                    label={<Typography variant="body2">{scope.scope}</Typography>}
                  />
                </Grid>
              ))}
            </Grid>
          </div>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={create.isPending || draft.name.trim().length < 2 || !draft.redirect_url.trim()} onClick={() => create.mutate()}>
          Register
        </Button>
      </DialogActions>
    </Dialog>
  )
}
