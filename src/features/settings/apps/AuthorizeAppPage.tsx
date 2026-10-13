import { Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Divider, Stack, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../../api/client'
import { errorMessage } from '../../../lib/errors'
import type { App, Scope } from './appTypes'

interface Preview {
  app: App
  requested_scopes: Scope[]
  already_granted: Scope[]
  redirect_uri: string
  shop: { id: string; name: string; domain: string }
}

/**
 * The install screen an app sends a merchant to (Shopify's OAuth grant):
 * which store, which app, what it may do. Approving hands the app a one-time
 * code on its redirect URL.
 */
export function AuthorizeAppPage() {
  const [params] = useSearchParams()
  const request = {
    client_id: params.get('client_id') ?? '',
    scope: params.get('scope') ?? undefined,
    redirect_uri: params.get('redirect_uri') ?? '',
    state: params.get('state') ?? undefined,
  }
  const preview = useQuery({
    queryKey: ['oauth-preview', request],
    queryFn: () => api.get<Preview>('/oauth/authorize', request),
    enabled: Boolean(request.client_id && request.redirect_uri),
    retry: false,
  })
  const approve = useMutation({
    mutationFn: () => api.post<{ redirect_to: string }>('/oauth/authorize', request),
    onSuccess: ({ redirect_to }) => window.location.assign(redirect_to),
  })

  const data = preview.data
  const granted = new Set(data?.already_granted.map((scope) => scope.scope) ?? [])
  const isUpdate = granted.size > 0

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          {!request.client_id || !request.redirect_uri ? (
            <Alert severity="error">This install link is incomplete. Start the install again from the app.</Alert>
          ) : preview.isLoading ? (
            <Stack sx={{ alignItems: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Stack>
          ) : preview.isError ? (
            <Alert severity="error">{errorMessage(preview.error)}</Alert>
          ) : data ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar variant="rounded" src={data.app.icon_url ?? undefined} sx={{ width: 48, height: 48 }}>
                  {data.app.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {isUpdate ? `${data.app.name} wants more access` : `Install ${data.app.name}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    on {data.shop.name} · {data.shop.domain}
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <Typography variant="subtitle2">This app will be able to:</Typography>
              <Stack spacing={1}>
                {data.requested_scopes.map((scope) => (
                  <Stack key={scope.scope} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                    <CheckIcon fontSize="small" color={granted.has(scope.scope) ? 'disabled' : 'success'} sx={{ mt: 0.25 }} />
                    <Typography variant="body2">
                      {scope.description}
                      {granted.has(scope.scope) && (
                        <Typography component="span" variant="caption">
                          {' '}
                          (already allowed)
                        </Typography>
                      )}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              {data.app.privacy_policy_url && (
                <Typography variant="caption">
                  By installing, you share store data with {data.app.developer_name ?? 'the developer'} under{' '}
                  <a href={data.app.privacy_policy_url} target="_blank" rel="noopener noreferrer">
                    their privacy policy
                  </a>
                  .
                </Typography>
              )}
              {approve.isError && <Alert severity="error">{errorMessage(approve.error)}</Alert>}
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button onClick={() => window.history.back()} disabled={approve.isPending}>
                  Cancel
                </Button>
                <Button variant="contained" onClick={() => approve.mutate()} disabled={approve.isPending}>
                  {approve.isPending ? 'Installing…' : isUpdate ? 'Update access' : 'Install app'}
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  )
}
