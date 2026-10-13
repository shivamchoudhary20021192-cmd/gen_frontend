import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
    return <Navigate to={from ?? '/products'} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
      navigate(from ?? '/products', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) {
        // The API returns the same message for a wrong password and an unknown
        // email on purpose; surfacing it verbatim keeps that property.
        setError(
          caught.code === 'ACCOUNT_LOCKED' || caught.code === 'RATE_LIMITED'
            ? caught.message
            : caught.status === 401
              ? 'Email or password is incorrect.'
              : caught.message,
        )
      } else {
        setError('Could not reach the server. Is the API running on port 4000?')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to your store admin"
      footer={
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            New here?{' '}
            <Link component={RouterLink} to="/signup">
              Start a store
            </Link>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Five failed attempts locks the account for 15 minutes.
          </Typography>
        </Stack>
      }
    >
      <form onSubmit={submit} noValidate>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            placeholder="you@yourstore.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            autoFocus
            required
            fullWidth
          />
          <Box>
            <TextField
              label="Password"
              placeholder="Your password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ display: 'inline-block', mt: 0.75 }}>
              Forgot password?
            </Link>
          </Box>
          <Button type="submit" variant="contained" size="large" fullWidth disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  )
}
