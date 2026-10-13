import { Box, CircularProgress } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (status === 'anonymous') {
    // Remember where they were headed so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
