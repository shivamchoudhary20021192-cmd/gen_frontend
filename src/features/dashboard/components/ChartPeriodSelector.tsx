/**
 * ChartPeriodSelector Component
 * 
 * Button group for selecting chart time periods (7d, 30d, 90d, 1y).
 * Used across multiple chart components for consistent UX.
 */

import { memo } from 'react'
import { ToggleButton, ToggleButtonGroup, type SxProps, type Theme } from '@mui/material'
import type { ChartPeriod } from '../types/dashboard.types'

export interface ChartPeriodSelectorProps {
  /** Currently selected period */
  period: ChartPeriod
  /** Callback when period changes */
  onChange: (period: ChartPeriod) => void
  /** Disable the selector */
  disabled?: boolean
  /** Custom styles */
  sx?: SxProps<Theme>
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '1y': '1 Year',
}

const PERIODS: readonly ChartPeriod[] = ['7d', '30d', '90d', '1y'] as const

/**
 * ChartPeriodSelector Component
 * 
 * Provides a compact button group for selecting time periods.
 * Follows MUI ToggleButton patterns for single-selection.
 */
export const ChartPeriodSelector = memo<ChartPeriodSelectorProps>(function ChartPeriodSelector({
  period,
  onChange,
  disabled = false,
  sx,
}) {
  const handleChange = (_event: React.MouseEvent<HTMLElement>, newPeriod: ChartPeriod | null) => {
    // Don't allow deselecting (always have one period selected)
    if (newPeriod !== null) {
      onChange(newPeriod)
    }
  }

  return (
    <ToggleButtonGroup
      value={period}
      exclusive
      onChange={handleChange}
      disabled={disabled}
      size="small"
      sx={{
        ...sx,
      }}
    >
      {PERIODS.map((p) => (
        <ToggleButton
          key={p}
          value={p}
          sx={{
            px: 2,
            py: 0.5,
            textTransform: 'none',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {PERIOD_LABELS[p]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
})
