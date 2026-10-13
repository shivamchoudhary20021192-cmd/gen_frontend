import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { AuthShell } from './AuthShell'
import { PASSWORD_HINT, passwordProblem } from './passwordRules'

interface Invitation {
  email: string
  shop: { name: string; handle: string } | null
  needs_password: boolean
}

/**
 * Where a staff invitation's link lands. Someone new chooses their name and a
 * password; someone who already has an account just accepts, and signs in as
 * usual to find the store in their switcher.
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.anonymous<Invitation>('GET', `/auth/invitations/${encodeURIComponent(token)}`),
    enabled: token.length > 0,
    retry: false,
  })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const needsPassword = invitation.data?.needs_password ?? false
  const problem = needsPassword && password ? passwordProblem(password) : null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.anonymous('POST', '/auth/invitations/accept', {
        token,
        ...(needsPassword ? { password, first_name: firstName || undefined, last_name: lastName || undefined } : {}),
      })
      setDone(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  const shopName = invitation.data?.shop?.name ?? 'the store'

  return (
    <AuthShell title={invitation.data ? `Join ${shopName}` : 'Staff invitation'}>
      {!token ? (
        <Alert severity="error">This invitation link is incomplete. Ask the store owner to send it again.</Alert>
      ) : invitation.isLoading ? (
        <Stack sx={{ alignItems: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : invitation.isError ? (
        <Alert severity="error">
          {invitation.error instanceof ApiError ? invitation.error.message : 'This invitation could not be loaded.'} Ask the store owner to send a new one.
        </Alert>
      ) : done ? (
        <Stack spacing={2}>
          <Alert severity="success">You are now on the staff of {shopName}.</Alert>
          <Button component={RouterLink} to="/login" variant="contained" size="large" fullWidth>
            Sign in
          </Button>
        </Stack>
      ) : (
        <form onSubmit={submit} noValidate>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              You have been invited to help run <strong>{shopName}</strong> as <strong>{invitation.data?.email}</strong>.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {needsPassword ? (
              <>
                <Stack direction="row" spacing={1.5}>
                  <TextField label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" autoFocus fullWidth />
                  <TextField label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" fullWidth />
                </Stack>
                <TextField
                  label="Choose a password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  error={Boolean(problem)}
                  helperText={problem ?? PASSWORD_HINT}
                  fullWidth
                />
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                You already have an account; accepting adds this store to it.
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy || (needsPassword && (!password || Boolean(problem)))}
            >
              {busy ? 'Joining…' : 'Accept invitation'}
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
