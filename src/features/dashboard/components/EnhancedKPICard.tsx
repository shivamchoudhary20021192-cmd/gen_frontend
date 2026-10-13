/**
 * EnhancedKPICard Component
 * 
 * World-class KPI card following top UI/UX principles:
 * - Visual Hierarchy (Nielsen Norman Group)
 * - Progressive Disclosure (Don Norman)
 * - Gestalt Principles (proximity, similarity, closure)
 * - Micro-interactions (Stripe, Linear)
 * - Data Ink Ratio (Edward Tufte)
 * 
 * Design Inspiration: Linear, Stripe, Apple HIG, Material Design 3
 */

import { memo } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Skeleton,
  alpha,
  useTheme,
  Tooltip,
  IconButton,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { tokens } from '../../../theme'

export interface EnhancedKPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
    period?: string
  }
  icon?: React.ReactNode
  loading?: boolean
  error?: boolean
  info?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  animate?: boolean
}

/**
 * Get color scheme based on card type
 */
const getColorScheme = (color: string, theme: any) => {
  const schemes = {
    primary: {
      bg: alpha(theme.palette.primary.main, 0.08),
      icon: theme.palette.primary.main,
      trend: theme.palette.primary.main,
    },
    success: {
      bg: alpha(tokens.success, 0.08),
      icon: tokens.success,
      trend: tokens.success,
    },
    warning: {
      bg: alpha(tokens.warning, 0.08),
      icon: tokens.warning,
      trend: tokens.warning,
    },
    error: {
      bg: alpha(tokens.critical, 0.08),
      icon: tokens.critical,
      trend: tokens.critical,
    },
    info: {
      bg: alpha(tokens.info, 0.08),
      icon: tokens.info,
      trend: tokens.info,
    },
  }
  return schemes[color as keyof typeof schemes] || schemes.primary
}

/**
 * EnhancedKPICard Component
 */
export const EnhancedKPICard = memo<EnhancedKPICardProps>(function EnhancedKPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading = false,
  error = false,
  info,
  color = 'primary',
  animate = true,
}) {
  const theme = useTheme()
  const colorScheme = getColorScheme(color, theme)

  // Determine trend direction
  const trendValue = trend?.value ?? 0
  const isPositive = trendValue > 0
  const isNegative = trendValue < 0

  const TrendIcon = isPositive ? TrendingUpIcon : isNegative ? TrendingDownIcon : TrendingFlatIcon
  const trendColor = isPositive ? tokens.success : isNegative ? tokens.critical : tokens.subdued

  if (loading) {
    return (
      <Card
        elevation={0}
        sx={{
          height: '100%',
          border: `1px solid ${tokens.border}`,
          borderRadius: 2,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: tokens.surface,
        }}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="circular" width={40} height={40} />
            </Box>
            <Skeleton variant="text" width="50%" height={40} />
            <Skeleton variant="text" width="70%" height={16} />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card
        elevation={0}
        sx={{
          height: '100%',
          border: `1px solid ${alpha(tokens.critical, 0.2)}`,
          borderRadius: 2,
          background: alpha(tokens.critical, 0.04),
        }}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Typography variant="body2" color="error">
            Failed to load
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: `1px solid ${tokens.border}`,
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: tokens.surface,
        position: 'relative',
        overflow: 'hidden',
        
        // Micro-interaction: Subtle hover effect
        '&:hover': {
          borderColor: colorScheme.icon,
          boxShadow: `0 4px 20px ${alpha(colorScheme.icon, 0.12)}`,
          transform: 'translateY(-2px)',
          
          '& .icon-container': {
            transform: 'scale(1.1) rotate(5deg)',
          },
          
          '& .value-text': {
            color: colorScheme.icon,
          },
        },

        // Accessibility: Focus visible
        '&:focus-within': {
          outline: `2px solid ${colorScheme.icon}`,
          outlineOffset: 2,
        },

        // Animation on mount
        ...(animate && {
          animation: 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes fadeInUp': {
            from: {
              opacity: 0,
              transform: 'translateY(20px)',
            },
            to: {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
        }),
      }}
    >
      {/* Decorative gradient bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${colorScheme.icon}, ${alpha(colorScheme.icon, 0.5)})`,
        }}
      />

      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Header: Title + Icon */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: tokens.subdued,
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {title}
                </Typography>
                {info && (
                  <Tooltip title={info} arrow placement="top">
                    <IconButton size="small" sx={{ p: 0.25 }}>
                      <InfoOutlinedIcon sx={{ fontSize: 14, color: tokens.subdued }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Icon with glassmorphism effect */}
            {icon && (
              <Box
                className="icon-container"
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorScheme.bg,
                  color: colorScheme.icon,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {icon}
              </Box>
            )}
          </Box>

          {/* Value: Large, scannable number */}
          <Box>
            <Typography
              className="value-text"
              variant="h4"
              sx={{
                fontWeight: 700,
                fontSize: { xs: 28, sm: 32 },
                lineHeight: 1.2,
                color: tokens.ink,
                transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {value}
            </Typography>
          </Box>

          {/* Trend or Subtitle */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {trend && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  alignSelf: 'flex-start',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  backgroundColor: alpha(trendColor, 0.08),
                }}
              >
                <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontSize: 12,
                    color: trendColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {isPositive && '+'}
                  {trendValue.toFixed(1)}%
                </Typography>
                {trend.label && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 11,
                      color: tokens.subdued,
                      ml: 0.5,
                    }}
                  >
                    {trend.label}
                  </Typography>
                )}
              </Box>
            )}

            {subtitle && (
              <Typography
                variant="caption"
                sx={{
                  color: tokens.subdued,
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
})
