/**
 * KPICard Component
 * 
 * Reusable card component for displaying Key Performance Indicators.
 * Supports loading states, error states, trends, and icons.
 */

import { memo } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Skeleton,
  Stack,
  type SxProps,
  type Theme,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import { tokens } from '../../../theme'

export interface KPICardProps {
  /** Card title/label */
  title: string
  /** Main metric value to display */
  value: string | number
  /** Optional subtitle for additional context */
  subtitle?: string
  /** Trend information (growth/decline) */
  trend?: {
    value: number
    label: string
  }
  /** Icon to display in the card header */
  icon?: React.ReactNode
  /** Loading state */
  loading?: boolean
  /** Error state */
  error?: boolean
  /** Error message to display */
  errorMessage?: string
  /** Custom styles */
  sx?: SxProps<Theme>
}

/**
 * KPICard Component
 * 
 * Displays a single KPI metric with optional trend indicator and icon.
 * Handles loading and error states gracefully.
 */
export const KPICard = memo<KPICardProps>(function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading = false,
  error = false,
  errorMessage = 'Failed to load',
  sx,
}) {
  // Error state
  if (error) {
    return (
      <Card sx={{ height: '100%', ...sx }}>
        <CardContent>
          <Stack spacing={2}   sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
            <ErrorOutlineIcon sx={{ fontSize: 40, color: tokens.critical }} />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              {errorMessage}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (loading) {
    return (
      <Card sx={{ height: '100%', ...sx }}>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton variant="text" width="60%" height={20} />
              {icon && <Skeleton variant="circular" width={32} height={32} />}
            </Box>
            <Skeleton variant="text" width="40%" height={40} />
            {subtitle && <Skeleton variant="text" width="50%" height={16} />}
            {trend && <Skeleton variant="text" width="30%" height={20} />}
          </Stack>
        </CardContent>
      </Card>
    )
  }

  // Determine trend color and icon
  const trendColor = trend
    ? trend.value >= 0
      ? tokens.success
      : tokens.critical
    : undefined

  const TrendIcon = trend
    ? trend.value >= 0
      ? TrendingUpIcon
      : TrendingDownIcon
    : null

  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardContent>
        <Stack spacing={2}>
          {/* Header: Title and Icon */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            {icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  backgroundColor: tokens.hover,
                  color: tokens.subdued,
                }}
              >
                {icon}
              </Box>
            )}
          </Box>

          {/* Main Value */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: tokens.inkStrong,
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>

          {/* Subtitle or Trend */}
          <Box sx={{ minHeight: 20 }}>
            {trend ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {TrendIcon && (
                  <TrendIcon
                    sx={{
                      fontSize: 18,
                      color: trendColor,
                    }}
                  />
                )}
                <Typography
                  variant="caption"
                  sx={{
                    color: trendColor,
                    fontWeight: 600,
                  }}
                >
                  {trend.value >= 0 ? '+' : ''}
                  {trend.value}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {trend.label}
                </Typography>
              </Box>
            ) : subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
})
