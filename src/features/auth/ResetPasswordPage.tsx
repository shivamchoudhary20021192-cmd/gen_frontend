import { Alert, Button, Link, Stack, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { AuthShell } from './AuthShell'
import { PASSWORD_HINT, passwordProblem } from './passwordRules'

/** Where the reset email's link lands: choose a new password, once. */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const problem = password ? passwordProblem(password) : null
  const mismatch = confirm.length > 0 && confirm !== password

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.anonymous('POST', '/auth/password/reset', { token, password })
      setDone(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Choose a new password">
      {!token ? (
        <Alert severity="error">
          This link is incomplete. Ask for a new one from <Link component={RouterLink} to="/forgot-password">Forgot password</Link>.
        </Alert>
      ) : done ? (
        <Stack spacing={2}>
          <Alert severity="success">Your password has been changed, and every other device has been signed out.</Alert>
          <Button component={RouterLink} to="/login" variant="contained" size="large" fullWidth>
            Sign in
          </Button>
        </Stack>
      ) : (
        <form onSubmit={submit} noValidate>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              autoFocus
              error={Boolean(problem)}
              helperText={problem ?? PASSWORD_HINT}
              fullWidth
            />
            <TextField
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              error={mismatch}
              helperText={mismatch ? 'The passwords do not match.' : ' '}
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" fullWidth disabled={busy || Boolean(problem) || !password || confirm !== password}>
              {busy ? 'Saving…' : 'Set new password'}
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
