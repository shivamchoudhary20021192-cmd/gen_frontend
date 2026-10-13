/**
 * EmptyState Component
 * 
 * Displays a friendly message when there's no data to show.
 * Used in widgets and charts when queries return empty results.
 */

import { memo } from 'react'
import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'
import { tokens } from '../../../theme'

export interface EmptyStateProps {
  /** Icon to display */
  icon?: React.ReactNode
  /** Main message */
  title: string
  /** Optional description */
  description?: string
  /** Optional action button */
  action?: React.ReactNode
  /** Custom styles */
  sx?: SxProps<Theme>
}

/**
 * EmptyState Component
 * 
 * Provides a consistent empty state UI across dashboard widgets.
 * Can include an icon, title, description, and optional action.
 */
export const EmptyState = memo<EmptyStateProps>(function EmptyState({
  icon,
  title,
  description,
  action,
  sx,
}) {
  const Icon = icon ?? <InboxIcon sx={{ fontSize: 64, color: tokens.faint }} />

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        py: 4,
        ...sx,
      }}
    >
      <Stack spacing={2} sx={{ maxWidth: 400, textAlign: 'center', alignItems: 'center' }}>
        {Icon}
        <Typography variant="subtitle1" color="text.primary">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
        {action && <Box sx={{ mt: 2 }}>{action}</Box>}
      </Stack>
    </Box>
  )
})
