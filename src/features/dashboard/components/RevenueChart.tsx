/**
 * RevenueChart Component
 * 
 * Displays revenue trends over time using an area chart.
 * Supports period selection and shows comparison with previous period.
 */

import { memo } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Alert,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts'
import { ChartPeriodSelector, EmptyState } from './index'
import { useRevenueChart, useChartPeriod } from '../hooks/useDashboard'
import { formatMoney } from '../../../lib/format'
import { tokens } from '../../../theme'
import type { ChartPeriod } from '../types/dashboard.types'

/**
 * Custom tooltip for the revenue chart
 */
const CustomTooltip = memo<Partial<TooltipContentProps<number, string>>>(function CustomTooltip({
  active,
  payload,
}) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as { date: string; revenue: number; orders: number }

  return (
    <Card
      elevation={3}
      sx={{
        p: 1.5,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {formatDate(data.date)}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.success }}>
          Revenue: {formatMoney(data.revenue)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data.orders} {data.orders === 1 ? 'order' : 'orders'}
        </Typography>
      </Stack>
    </Card>
  )
})

/**
 * Format date for chart axis based on period
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/**
 * Format date for tooltip (more detailed)
 */

export interface RevenueChartProps {
  /** Initial period selection */
  initialPeriod?: ChartPeriod
}

/**
 * RevenueChart Component
 * 
 * Visualizes revenue trends over a selected time period.
 * Features:
 * - Responsive design with mobile optimization
 * - Period selector (7d, 30d, 90d, 1y)
 * - Interactive tooltips
 * - Growth comparison with previous period
 * - Loading and error states
 */
export const RevenueChart = memo<RevenueChartProps>(function RevenueChart({
  initialPeriod = '30d',
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { period, setPeriod } = useChartPeriod(initialPeriod)
  const { data, isLoading, isError, error } = useRevenueChart({ period })

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Revenue Trends</Typography>
            <Alert severity="error">
              Failed to load revenue data: {error?.message ?? 'Unknown error'}
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!isLoading && data && data.data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Revenue Trends</Typography>
              <ChartPeriodSelector period={period} onChange={setPeriod} disabled />
            </Box>
            <EmptyState
              title="No revenue data"
              description="Revenue data will appear here once orders are placed."
            />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const chartData = data?.data ?? []
  const comparison = data?.comparison

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {/* Header with period selector */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h6">Revenue Trends</Typography>
              {comparison && !isLoading && (
                <Typography variant="caption" color="text.secondary">
                  {comparison.growth >= 0 ? '+' : ''}
                  {comparison.growth.toFixed(1)}% vs previous period
                </Typography>
              )}
            </Box>
            <ChartPeriodSelector period={period} onChange={setPeriod} disabled={isLoading} />
          </Box>

          {/* Chart */}
          <Box sx={{ width: '100%', height: isMobile ? 250 : 300 }}>
            {isLoading ? (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tokens.hover,
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Loading chart...
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: isMobile ? 0 : 10,
                    left: isMobile ? 0 : 10,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={tokens.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke={tokens.subdued}
                    tick={{ fontSize: 11 }}
                    tickLine={{ stroke: tokens.border }}
                  />
                  <YAxis
                    tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
                    stroke={tokens.subdued}
                    tick={{ fontSize: 11 }}
                    tickLine={{ stroke: tokens.border }}
                    width={isMobile ? 50 : 70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={tokens.success}
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
})
