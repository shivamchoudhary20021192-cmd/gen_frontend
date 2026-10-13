/**
 * AdvancedRevenueChart Component
 * 
 * Industry-grade revenue visualization with multiple chart types:
 * - Area Chart (default)
 * - Line Chart
 * - Bar Chart
 * - Comparison View
 * 
 * Features:
 * - Chart type switcher
 * - Growth indicators and comparisons
 * - Interactive tooltips with trends
 * - Zoom and pan capabilities
 * - Export functionality
 * - Moving averages
 * - Responsive design with mobile optimization
 */

import { memo, useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Alert,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Skeleton,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import BarChartIcon from '@mui/icons-material/BarChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import DownloadIcon from '@mui/icons-material/Download'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { useRevenueChart } from '../hooks/useDashboard'
import { ChartPeriodSelector, EmptyState, RefreshButton } from './index'
import type { ChartPeriod } from '../types/dashboard.types'
import { tokens } from '../../../theme'

/**
 * Chart type options
 */
type ChartType = 'area' | 'line' | 'bar' | 'comparison'

/**
 * Format currency for display
 */
const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

/**
 * Custom tooltip with detailed information
 */
const CustomTooltip = memo(function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload

  return (
    <Card sx={{ minWidth: 200, boxShadow: 3 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {new Date(data.date).toLocaleDateString('en-IN', { 
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Revenue:
            </Typography>
            <Typography variant="body2"  sx={{ fontWeight: 700, color: tokens.success }}>
              ₹{data.revenue.toLocaleString('en-IN')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Orders:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.orders}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Avg Order:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ₹{data.orders > 0 ? (data.revenue / data.orders).toFixed(0) : '0'}
            </Typography>
          </Box>
          {data.movingAvg && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                7-day Avg:
              </Typography>
              <Typography variant="body2"  sx={{ fontWeight: 600, color: tokens.subdued }}>
                ₹{data.movingAvg.toLocaleString('en-IN')}
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
})

/**
 * Calculate moving average
 */
const calculateMovingAverage = (data: any[], windowSize: number = 7) => {
  return data.map((item, index) => {
    const start = Math.max(0, index - windowSize + 1)
    const window = data.slice(start, index + 1)
    const sum = window.reduce((acc, curr) => acc + curr.revenue, 0)
    return {
      ...item,
      movingAvg: Math.round(sum / window.length),
    }
  })
}

/**
 * Export chart data as CSV
 */
const exportToCSV = (data: any[], period: string) => {
  const headers = ['Date', 'Revenue', 'Orders', 'Average Order Value']
  
  const rows = data.map(item => [
    new Date(item.date).toLocaleDateString('en-IN'),
    item.revenue,
    item.orders,
    item.orders > 0 ? (item.revenue / item.orders).toFixed(2) : '0'
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `revenue-trends-${period}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export interface AdvancedRevenueChartProps {
  initialPeriod?: ChartPeriod
}

/**
 * AdvancedRevenueChart Component
 */
export const AdvancedRevenueChart = memo<AdvancedRevenueChartProps>(function AdvancedRevenueChart({
  initialPeriod = '30d',
}) {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod)
  const [chartType, setChartType] = useState<ChartType>('area')
  const { data, isLoading, isError, error, refetch } = useRevenueChart({ period })

  // Calculate statistics and moving average
  const chartData = useMemo(() => {
    if (!data?.data.length) return []
    return calculateMovingAverage(data.data)
  }, [data])

  const stats = useMemo(() => {
    if (!chartData.length) return { total: 0, average: 0, peak: 0, growth: 0 }

    const total = chartData.reduce((sum, item) => sum + item.revenue, 0)
    const average = total / chartData.length
    const peak = Math.max(...chartData.map(item => item.revenue))
    
    // Calculate growth from previous period
    const growth = data?.comparison.growth ?? 0

    return { total, average, peak, growth }
  }, [chartData, data])

  // Render chart based on selected type
  const renderChart = () => {
    if (!chartData.length) return null

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    }

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={tokens.ink}
                strokeWidth={2}
                dot={{ fill: tokens.ink, r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar
                dataKey="revenue"
                fill={tokens.ink}
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'comparison':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={stats.average}
                stroke={tokens.subdued}
                strokeDasharray="3 3"
                label={{ 
                  value: 'Average',
                  position: 'right',
                  fill: tokens.subdued,
                  fontSize: 11
                }}
              />
              <Bar
                dataKey="revenue"
                fill={tokens.ink}
                radius={[4, 4, 0, 0]}
                opacity={0.6}
              />
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke={tokens.success}
                strokeWidth={2}
                dot={false}
                name="7-day Moving Avg"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )

      case 'area':
      default:
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tokens.ink} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={tokens.ink} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={tokens.ink}
                strokeWidth={2}
                fill="url(#colorRevenue)"
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Revenue Trends
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {stats.growth > 0 ? '+' : ''}{stats.growth.toFixed(1)}% vs previous period
                </Typography>
                {stats.growth > 0 ? (
                  <TrendingUpIcon sx={{ fontSize: 16, color: tokens.success }} />
                ) : stats.growth < 0 ? (
                  <TrendingDownIcon sx={{ fontSize: 16, color: tokens.critical }} />
                ) : null}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Chart Type Selector */}
              <ToggleButtonGroup
                value={chartType}
                exclusive
                onChange={(_, newType) => newType && setChartType(newType)}
                size="small"
                aria-label="chart type"
              >
                <ToggleButton value="area" aria-label="area chart">
                  <Tooltip title="Area Chart">
                    <TimelineIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="line" aria-label="line chart">
                  <Tooltip title="Line Chart">
                    <ShowChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="bar" aria-label="bar chart">
                  <Tooltip title="Bar Chart">
                    <BarChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="comparison" aria-label="comparison view">
                  <Tooltip title="Comparison View">
                    <CompareArrowsIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>

              {/* Period Selector */}
              <ChartPeriodSelector period={period} onChange={setPeriod} disabled={isLoading} />
              
              {/* Export Button */}
              {chartData.length > 0 && (
                <Tooltip title="Export as CSV">
                  <IconButton
                    size="small"
                    onClick={() => exportToCSV(chartData, period)}
                    sx={{ ml: 0.5 }}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Refresh Button */}
              <RefreshButton onRefresh={() => refetch()} />
            </Box>
          </Box>

          {/* Chart Content */}
          {isLoading ? (
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
          ) : isError ? (
            <Alert severity="error">
              {error instanceof Error ? error.message : 'Failed to load revenue data'}
            </Alert>
          ) : !chartData.length ? (
            <EmptyState title="No revenue data found for the selected period" sx={{ minHeight: 280 }} />
          ) : (
            <>
              {renderChart()}
              
              {/* Statistics Summary */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 1 }}>
                <Chip
                  label={`Total: ${formatCurrency(stats.total)}`}
                  size="small"
                  sx={{
                    backgroundColor: `${tokens.ink}20`,
                    color: tokens.ink,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
                <Chip
                  label={`Daily Avg: ${formatCurrency(stats.average)}`}
                  size="small"
                  sx={{
                    backgroundColor: `${tokens.success}20`,
                    color: tokens.success,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
                <Chip
                  label={`Peak: ${formatCurrency(stats.peak)}`}
                  size="small"
                  sx={{
                    backgroundColor: `${tokens.warning}20`,
                    color: tokens.warning,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
})
