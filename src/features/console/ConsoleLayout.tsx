import {
  AppBar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AppsIcon from '@mui/icons-material/Apps'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import MailOutlineIcon from '@mui/icons-material/EmailOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import StorefrontIcon from '@mui/icons-material/Storefront'
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined'
import { useState, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { tokens } from '../../theme'
import { useOperator } from './useOperator'
import HistoryIcon from '@mui/icons-material/History'
import LanguageIcon from '@mui/icons-material/Language'

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/console', label: 'Overview', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { to: '/console/stores', label: 'Stores', icon: <StorefrontIcon fontSize="small" /> },
  { to: '/console/plans', label: 'Plans', icon: <SellOutlinedIcon fontSize="small" /> },
  { to: '/console/billing', label: 'Platform billing', icon: <ReceiptLongIcon fontSize="small" /> },
  { to: '/console/exchange-rates', label: 'Exchange rates', icon: <CurrencyExchangeIcon fontSize="small" /> },
  { to: '/console/apps', label: 'App store', icon: <AppsIcon fontSize="small" /> },
  { to: '/console/jobs', label: 'Background jobs', icon: <WorkHistoryOutlinedIcon fontSize="small" /> },
  { to: '/console/emails', label: 'Platform email', icon: <MailOutlineIcon fontSize="small" /> },
  { to: '/console/domains', label: 'Domains', icon: <LanguageIcon fontSize="small" /> },
  { to: '/console/audit', label: 'Audit log', icon: <HistoryIcon fontSize="small" /> },
]

const DRAWER = 232
const TOPBAR = 56

/**
 * The operators' console: the platform seen from above — every store, the
 * plans they are on, what the platform bills them, the exchange rates behind
 * every market, the app store, the job queue and the platform's own email.
 * Only people with a platform role get here; everyone else goes back to their
 * store.
 */
export function ConsoleLayout() {
  const { admin } = useAuth()
  const { role, isOperator } = useOperator()
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('md'))
  const [open, setOpen] = useState(false)
  const location = useLocation()

  if (!isOperator) return <Navigate to="/dashboard" replace />

  const nav = (
    <Box sx={{ py: 1.5 }}>
      <List dense disablePadding>
        {NAV.map((item) => {
          const active = item.to === '/console' ? location.pathname === '/console' : location.pathname.startsWith(item.to)
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={() => setOpen(false)}
              selected={active}
              sx={{ mx: 1, borderRadius: 1.5, mb: 0.25, '&.Mui-selected': { bgcolor: tokens.paper, fontWeight: 600 } }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: active ? 600 : 500 } } }} />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: tokens.surface }}>
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: tokens.topbar, zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: `${TOPBAR}px !important`, gap: 1.5 }}>
          {!wide && (
            <IconButton color="inherit" onClick={() => setOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          )}
          <Typography sx={{ fontWeight: 700, letterSpacing: '0.16em', fontSize: 14 }}>VEYLOG</Typography>
          <Typography sx={{ color: '#B5B5B5', fontSize: 13 }}>Platform console</Typography>
          <Chip size="small" label={role === 'admin' ? 'Admin' : 'Support · read only'} sx={{ bgcolor: '#303030', color: '#FFFFFF', height: 22 }} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ color: '#B5B5B5', fontSize: 12, display: { xs: 'none', sm: 'block' } }}>{admin?.email}</Typography>
          <Button component={NavLink} to="/dashboard" size="small" startIcon={<ArrowBackIcon fontSize="small" />} sx={{ color: '#FFFFFF' }}>
            Store admin
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={wide ? 'permanent' : 'temporary'}
        open={wide || open}
        onClose={() => setOpen(false)}
        sx={{ width: DRAWER, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER, bgcolor: tokens.rail, borderRight: 'none', boxSizing: 'border-box' } }}
      >
        <Toolbar sx={{ minHeight: `${TOPBAR}px !important` }} />
        {nav}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 3 }, pb: 6 }}>
        <Toolbar sx={{ minHeight: `${TOPBAR}px !important` }} />
        <Box sx={{ maxWidth: 1200, mx: 'auto', pt: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
