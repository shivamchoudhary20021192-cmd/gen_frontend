/**
 * SectionHeader Component
 * 
 * Premium section divider with title, description, and optional actions.
 * Follows visual hierarchy principles for content organization.
 * 
 * Design Inspiration: Stripe, Linear, Apple HIG
 */

import { memo, type ReactNode } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { tokens } from '../../../theme'

export interface SectionHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  badge?: ReactNode
  divider?: boolean
}

/**
 * SectionHeader Component
 */
export const SectionHeader = memo<SectionHeaderProps>(function SectionHeader({
  title,
  description,
  icon,
  action,
  badge,
  divider = true,
}) {
  return (
    <Box
      sx={{
        mb: 3,
        pb: divider ? 2 : 0,
        borderBottom: divider ? `1px solid ${tokens.border}` : 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        {/* Left: Title + Description */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: description ? 0.5 : 0 }}>
            {/* Icon */}
            {icon && (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(tokens.ink, 0.08),
                  color: tokens.ink,
                }}
              >
                {icon}
              </Box>
            )}

            {/* Title */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: 18,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                color: tokens.ink,
              }}
            >
              {title}
            </Typography>

            {/* Badge */}
            {badge && badge}
          </Box>

          {/* Description */}
          {description && (
            <Typography
              variant="body2"
              sx={{
                color: tokens.subdued,
                fontSize: 13,
                lineHeight: 1.5,
                mt: 0.5,
                ml: icon ? 5 : 0,
              }}
            >
              {description}
            </Typography>
          )}
        </Box>

        {/* Right: Actions */}
        {action && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              alignSelf: { xs: 'flex-end', sm: 'center' },
            }}
          >
            {action}
          </Box>
        )}
      </Box>
    </Box>
  )
})
