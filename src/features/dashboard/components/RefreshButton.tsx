/**
 * RefreshButton Component
 * 
 * Button with loading animation for manually refreshing dashboard data.
 * Shows last updated timestamp and provides visual feedback during refresh.
 */

import { memo } from 'react'
import { Button, CircularProgress, Tooltip, type SxProps, type Theme } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { formatRelative } from '../../../lib/format'

export interface RefreshButtonProps {
  /** Callback when refresh is triggered */
  onRefresh: () => void
  /** Whether a refresh is currently in progress */
  refreshing?: boolean
  /** Last update timestamp */
  lastUpdated?: Date | null
  /** Disable the button */
  disabled?: boolean
  /** Custom styles */
  sx?: SxProps<Theme>
}

/**
 * RefreshButton Component
 * 
 * Provides a manual refresh trigger with visual feedback.
 * Shows a rotating icon during refresh and displays last update time in tooltip.
 */
export const RefreshButton = memo<RefreshButtonProps>(function RefreshButton({
  onRefresh,
  refreshing = false,
  lastUpdated = null,
  disabled = false,
  sx,
}) {
  const tooltipTitle = lastUpdated
    ? `Last updated ${formatRelative(lastUpdated.toISOString())}`
    : 'Refresh dashboard'

  return (
    <Tooltip title={tooltipTitle}>
      <span>
        <Button
          size="small"
          variant="outlined"
          onClick={onRefresh}
          disabled={disabled || refreshing}
          startIcon={
            refreshing ? (
              <CircularProgress size={16} />
            ) : (
              <RefreshIcon
                sx={{
                  transition: 'transform 0.3s ease',
                }}
              />
            )
          }
          sx={{
            minWidth: 'auto',
            ...sx,
          }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </span>
    </Tooltip>
  )
})
