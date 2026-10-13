/**
 * AdvancedOrdersChart Component
 * 
 * Industry-grade orders visualization with multiple chart types:
 * - Bar Chart (default)
 * - Pie Chart
 * - Donut Chart
 * - Horizontal Bar
 * 
 * Features:
 * - Chart type switcher
 * - Interactive tooltips with detailed breakdown
 * - Responsive design with mobile optimization
 * - Smooth animations and transitions
 * - Export functionality
 * - Custom color schemes per status
 * - Percentage and absolute value displays
 */

import { memo, useState } from 'react'
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import BarChartIcon from '@mui/icons-material/BarChart'
import PieChartIcon from '@mui/icons-material/PieChart'
import DonutSmallIcon from '@mui/icons-material/DonutSmall'
import DownloadIcon from '@mui/icons-material/Download'
import { useOrdersChart } from '../hooks/useDashboard'
import { ChartPeriodSelector, EmptyState, RefreshButton } from './index'
import type { ChartPeriod } from '../types/dashboard.types'
import { tokens } from '../../../theme'

/**
 * Chart type options
 */
type ChartType = 'bar' | 'pie' | 'donut' | 'horizontalBar'

/**
 * Status color mapping for consistent visualization
 */
const STATUS_COLORS: Record<string, string> = {
  pending: '#FFA726',       // Orange
  confirmed: '#42A5F5',     // Blue
  processing: '#66BB6A',    // Green
  packed: '#AB47BC',        // Purple
  shipped: '#26C6DA',       // Cyan
  out_for_delivery: '#5C6BC0', // Indigo
  delivered: '#66BB6A',     // Green
  cancelled: '#EF5350',     // Red
  returned: '#FFA726',      // Orange
  rto: '#EF5350',          // Red
}

/**
 * Custom tooltip for detailed information
 */
const CustomTooltip = memo(function CustomTooltip({ active, payload, total }: any) {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload
  const percentage = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0.0'

  return (
    <Card sx={{ minWidth: 200, boxShadow: 3 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
            {data.status.replace(/_/g, ' ')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Orders:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.count}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Percentage:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {percentage}%
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Revenue:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ₹{data.revenue.toLocaleString('en-IN')}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
})

/**
 * Custom label for pie/donut charts
 */
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null // Don't show labels for slices < 5%

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 600 }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/**
 * Export chart data as CSV
 */
const exportToCSV = (data: any[], period: string) => {
  const headers = ['Status', 'Count', 'Revenue', 'Percentage']
  const total = data.reduce((sum, item) => sum + item.count, 0)
  
  const rows = data.map(item => [
    item.status.replace(/_/g, ' '),
    item.count,
    item.revenue,
    `${((item.count / total) * 100).toFixed(2)}%`
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `orders-by-status-${period}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export interface AdvancedOrdersChartProps {
  initialPeriod?: ChartPeriod
}

/**
 * AdvancedOrdersChart Component
 */
export const AdvancedOrdersChart = memo<AdvancedOrdersChartProps>(function AdvancedOrdersChart({
  initialPeriod = '30d',
}) {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const { data, isLoading, isError, error, refetch } = useOrdersChart({ period })

  // Calculate total for percentage calculations
  const totalOrders = data?.data.reduce((sum, item) => sum + item.count, 0) ?? 0

  // Transform data for better display
  const chartData = data?.data.map(item => ({
    ...item,
    displayName: item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    percentage: totalOrders > 0 ? ((item.count / totalOrders) * 100).toFixed(1) : '0',
  })) ?? []

  // Render chart based on selected type
  const renderChart = () => {
    if (!chartData.length) return null

    switch (chartType) {
      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={chartType === 'donut' ? 100 : 120}
                innerRadius={chartType === 'donut' ? 60 : 0}
                fill="#8884d8"
                dataKey="count"
                animationBegin={0}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.status] || tokens.ink}
                  />
                ))}
              </Pie>
              <RechartsTooltip content={<CustomTooltip total={totalOrders} />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: tokens.ink }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'horizontalBar':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis type="number" stroke={tokens.subdued} />
              <YAxis 
                type="category" 
                dataKey="displayName" 
                stroke={tokens.subdued}
                style={{ fontSize: 12 }}
              />
              <RechartsTooltip content={<CustomTooltip total={totalOrders} />} />
              <Bar 
                dataKey="count" 
                fill={tokens.ink}
                radius={[0, 4, 4, 0]}
                animationBegin={0}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.status] || tokens.ink}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis 
                dataKey="displayName" 
                stroke={tokens.subdued}
                angle={-45}
                textAnchor="end"
                height={80}
                style={{ fontSize: 11 }}
              />
              <YAxis stroke={tokens.subdued} />
              <RechartsTooltip content={<CustomTooltip total={totalOrders} />} />
              <Bar 
                dataKey="count" 
                fill={tokens.ink}
                radius={[4, 4, 0, 0]}
                animationBegin={0}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.status] || tokens.ink}
                  />
                ))}
              </Bar>
            </BarChart>
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
                Orders by Status
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totalOrders} total orders
              </Typography>
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
                <ToggleButton value="bar" aria-label="bar chart">
                  <Tooltip title="Bar Chart">
                    <BarChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="horizontalBar" aria-label="horizontal bar chart">
                  <Tooltip title="Horizontal Bar">
                    <BarChartIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="pie" aria-label="pie chart">
                  <Tooltip title="Pie Chart">
                    <PieChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="donut" aria-label="donut chart">
                  <Tooltip title="Donut Chart">
                    <DonutSmallIcon fontSize="small" />
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
            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
          ) : isError ? (
            <Alert severity="error">
              {error instanceof Error ? error.message : 'Failed to load orders data'}
            </Alert>
          ) : !chartData.length ? (
            <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState title="No orders found for the selected period" />
            </Box>
          ) : (
            <>
              {renderChart()}
              
              {/* Status Summary Chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 1 }}>
                {chartData.slice(0, 5).map((item) => (
                  <Chip
                    key={item.status}
                    label={`${item.displayName}: ${item.count}`}
                    size="small"
                    sx={{
                      backgroundColor: `${STATUS_COLORS[item.status] || tokens.ink}20`,
                      color: STATUS_COLORS[item.status] || tokens.ink,
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  />
                ))}
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
})
