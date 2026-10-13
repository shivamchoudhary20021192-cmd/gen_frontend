import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { AuthShell } from './AuthShell'

/**
 * "Forgot your password?". The answer is the same whether or not the address
 * has an account, so this page cannot be used to find out who is a merchant.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api.anonymous<{ message: string }>('POST', '/auth/password/forgot', { email })
      setSent(result.message)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      footer={
        <Link component={RouterLink} to="/login" variant="body2">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Stack spacing={2}>
          <Alert severity="success">{sent}</Alert>
          <Typography variant="body2" color="text.secondary">
            The link works once, for an hour. Check your spam folder if it does not arrive in a few minutes.
          </Typography>
        </Stack>
      ) : (
        <form onSubmit={submit} noValidate>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Enter the email you sign in with and we will send you a link to choose a new password.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoFocus
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" fullWidth disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Send reset link'}
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
