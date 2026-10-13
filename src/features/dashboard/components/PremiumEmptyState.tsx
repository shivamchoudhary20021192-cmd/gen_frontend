/**
 * PremiumEmptyState Component
 * 
 * Delightful empty state following best practices:
 * - Clear messaging (Don Norman's feedback principle)
 * - Actionable guidance
 * - Visual interest without distraction
 * - Emotional design (positive, helpful tone)
 * 
 * Design Inspiration: Stripe, Dropbox, Linear
 */

import { memo, type ReactNode } from 'react'
import { Box, Typography, Button, alpha } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { tokens } from '../../../theme'

export interface PremiumEmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  illustration?: 'default' | 'search' | 'filter' | 'error'
  size?: 'small' | 'medium' | 'large'
}

/**
 * Get illustration based on type
 */
const getIllustration = (type: string) => {
  const illustrations = {
    default: (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(tokens.subdued, 0.08),
          border: `2px dashed ${alpha(tokens.subdued, 0.2)}`,
        }}
      >
        <InboxOutlinedIcon sx={{ fontSize: 40, color: tokens.subdued, opacity: 0.5 }} />
      </Box>
    ),
    search: (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(tokens.info, 0.08),
          border: `2px dashed ${alpha(tokens.info, 0.2)}`,
        }}
      >
        <Typography sx={{ fontSize: 32 }}>🔍</Typography>
      </Box>
    ),
    filter: (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(tokens.warning, 0.08),
          border: `2px dashed ${alpha(tokens.warning, 0.2)}`,
        }}
      >
        <Typography sx={{ fontSize: 32 }}>🎯</Typography>
      </Box>
    ),
    error: (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(tokens.critical, 0.08),
          border: `2px dashed ${alpha(tokens.critical, 0.2)}`,
        }}
      >
        <Typography sx={{ fontSize: 32 }}>⚠️</Typography>
      </Box>
    ),
  }
  return illustrations[type as keyof typeof illustrations] || illustrations.default
}

/**
 * PremiumEmptyState Component
 */
export const PremiumEmptyState = memo<PremiumEmptyStateProps>(function PremiumEmptyState({
  title = 'No data found',
  description = 'There is nothing to display right now',
  icon,
  action,
  illustration = 'default',
  size = 'medium',
}) {
  const paddingMap = {
    small: 4,
    medium: 6,
    large: 8,
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: paddingMap[size],
        px: 3,
      }}
    >
      {/* Illustration */}
      <Box
        sx={{
          mb: 3,
          animation: 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        {icon || getIllustration(illustration)}
      </Box>

      {/* Title */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          fontSize: 16,
          color: tokens.ink,
          mb: 1,
          maxWidth: 400,
        }}
      >
        {title}
      </Typography>

      {/* Description */}
      <Typography
        variant="body2"
        sx={{
          color: tokens.subdued,
          fontSize: 14,
          lineHeight: 1.5,
          mb: action ? 3 : 0,
          maxWidth: 400,
        }}
      >
        {description}
      </Typography>

      {/* Action */}
      {action && (
        <Button
          variant="outlined"
          onClick={action.onClick}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            borderColor: tokens.border,
            color: tokens.ink,
            
            '&:hover': {
              borderColor: tokens.ink,
              backgroundColor: alpha(tokens.ink, 0.04),
            },
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  )
})
