/**
 * AlertsWidget Component
 * 
 * Displays critical alerts and notifications requiring admin attention.
 * Shows low stock, failed payments, pending returns, and system errors.
 */

import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Alert as MuiAlert,
  Stack,
  Link,
  Skeleton,
  Badge,
  IconButton,
  Tooltip,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import InventoryIcon from '@mui/icons-material/Inventory'
import PaymentIcon from '@mui/icons-material/Payment'
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn'
import BugReportIcon from '@mui/icons-material/BugReport'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { useDashboardAlerts } from '../hooks/useDashboard'
import { EmptyState } from './index'
import { formatRelative } from '../../../lib/format'
import { tokens } from '../../../theme'
import type { AlertType, AlertSeverity } from '../types/dashboard.types'

/**
 * Alert type icon mapping
 */
const ALERT_TYPE_ICONS: Record<AlertType, React.ReactElement> = {
  low_stock: <InventoryIcon fontSize="small" />,
  failed_payment: <PaymentIcon fontSize="small" />,
  pending_return: <AssignmentReturnIcon fontSize="small" />,
  system_error: <BugReportIcon fontSize="small" />,
}

/**
 * Alert severity configuration
 */
const SEVERITY_CONFIG: Record<
  AlertSeverity,
  {
    color: 'info' | 'warning' | 'error'
    icon: React.ReactElement
  }
> = {
  info: {
    color: 'info',
    icon: <InfoOutlinedIcon fontSize="small" />,
  },
  warning: {
    color: 'warning',
    icon: <WarningAmberIcon fontSize="small" />,
  },
  critical: {
    color: 'error',
    icon: <ErrorOutlineIcon fontSize="small" />,
  },
}

/**
 * Loading skeleton for alerts
 */
const AlertsSkeleton = memo(function AlertsSkeleton() {
  return (
    <Stack spacing={1.5}>
      {[...Array(3)].map((_, index) => (
        <Box key={index}>
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
        </Box>
      ))}
    </Stack>
  )
})

/**
 * AlertsWidget Component
 * 
 * Displays system alerts and notifications requiring admin attention.
 * Features:
 * - Severity-based color coding
 * - Icon indicators for alert types
 * - Clickable links to relevant pages
 * - Relative timestamps
 * - Badge showing total alert count
 * - Loading and error states
 * - Empty state for no alerts
 */
export const AlertsWidget = memo(function AlertsWidget() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useDashboardAlerts()

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Alerts</Typography>
            <MuiAlert severity="error">
              Failed to load alerts: {error?.message ?? 'Unknown error'}
            </MuiAlert>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const alerts = data?.alerts ?? []
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length

  // Empty state
  if (!isLoading && alerts.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Alerts</Typography>
            <EmptyState
              icon={<NotificationsIcon sx={{ fontSize: 64, color: tokens.success }} />}
              title="All clear!"
              description="No alerts or issues requiring your attention."
            />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {/* Header with badge */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Alerts</Typography>
            {!isLoading && alerts.length > 0 && (
              <Tooltip title={`${criticalCount} critical alert${criticalCount !== 1 ? 's' : ''}`}>
                <Badge badgeContent={alerts.length} color={criticalCount > 0 ? 'error' : 'default'}>
                  <NotificationsIcon sx={{ color: tokens.subdued }} />
                </Badge>
              </Tooltip>
            )}
          </Box>

          {/* Alerts List */}
          {isLoading ? (
            <AlertsSkeleton />
          ) : (
            <Stack spacing={1.5}>
              {alerts.slice(0, 5).map((alert) => (
                <MuiAlert
                  key={alert.id}
                  severity={SEVERITY_CONFIG[alert.severity].color}
                  icon={ALERT_TYPE_ICONS[alert.type]}
                  sx={{
                    alignItems: 'center',
                    '& .MuiAlert-message': {
                      width: '100%',
                    },
                  }}
                  action={
                    alert.link ? (
                      <IconButton
                        size="small"
                        onClick={() => navigate(alert.link!)}
                        sx={{ color: 'inherit' }}
                      >
                        →
                      </IconButton>
                    ) : undefined
                  }
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {alert.title}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      {alert.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelative(alert.createdAt)}
                    </Typography>
                  </Box>
                </MuiAlert>
              ))}

              {alerts.length > 5 && (
                <Box sx={{ textAlign: 'center', pt: 1 }}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => {
                      // Navigate to a dedicated alerts page if it exists
                      // or show a modal with all alerts
                      console.log('View all alerts')
                    }}
                    sx={{ textDecoration: 'none' }}
                  >
                    View {alerts.length - 5} more alert{alerts.length - 5 !== 1 ? 's' : ''}
                  </Link>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
})
