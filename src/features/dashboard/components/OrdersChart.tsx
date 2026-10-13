/**
 * OrdersChart Component
 * 
 * Displays order distribution by status using a bar chart.
 * Shows breakdown of orders by status (pending, processing, shipped, etc.)
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
  Chip,
} from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipContentProps,
} from 'recharts'
import { ChartPeriodSelector, EmptyState } from './index'
import { useOrdersChart, useChartPeriod } from '../hooks/useDashboard'
import { formatMoney } from '../../../lib/format'
import { tokens } from '../../../theme'
import type { ChartPeriod, OrderStatus } from '../types/dashboard.types'

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#ff9800',
  confirmed: '#03a9f4',
  processing: '#2196f3',
  packed: '#3f51b5',
  shipped: '#9c27b0',
  out_for_delivery: '#673ab7',
  delivered: '#4caf50',
  cancelled: '#f44336',
  returned: '#795548',
  rto: '#e91e63',
}

/**
 * Status label mapping
 */
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  rto: 'RTO',
}

/**
 * Custom tooltip for the orders chart
 */
const CustomTooltip = memo<Partial<TooltipContentProps<number, string>>>(function CustomTooltip({
  active,
  payload,
}) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as { status: OrderStatus; count: number; revenue: number }

  return (
    <Card
      elevation={3}
      sx={{
        p: 1.5,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: STATUS_COLORS[data.status] }}>
          {STATUS_LABELS[data.status]}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {data.count} {data.count === 1 ? 'order' : 'orders'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Revenue: {formatMoney(data.revenue)}
        </Typography>
      </Stack>
    </Card>
  )
})

export interface OrdersChartProps {
  /** Initial period selection */
  initialPeriod?: ChartPeriod
}

/**
 * OrdersChart Component
 * 
 * Visualizes order distribution by status over a selected time period.
 * Features:
 * - Responsive design with mobile optimization
 * - Period selector (7d, 30d, 90d, 1y)
 * - Color-coded status bars
 * - Interactive tooltips with count and revenue
 * - Legend showing total per status
 * - Loading and error states
 */
export const OrdersChart = memo<OrdersChartProps>(function OrdersChart({
  initialPeriod = '30d',
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { period, setPeriod } = useChartPeriod(initialPeriod)
  const { data, isLoading, isError, error } = useOrdersChart({ period })

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Orders by Status</Typography>
            <Alert severity="error">
              Failed to load orders data: {error?.message ?? 'Unknown error'}
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
              <Typography variant="h6">Orders by Status</Typography>
              <ChartPeriodSelector period={period} onChange={setPeriod} disabled />
            </Box>
            <EmptyState
              title="No orders data"
              description="Order statistics will appear here once orders are placed."
            />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const chartData = data?.data ?? []
  const totalOrders = chartData.reduce((sum, item) => sum + item.count, 0)

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
              <Typography variant="h6">Orders by Status</Typography>
              {!isLoading && totalOrders > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {totalOrders} total {totalOrders === 1 ? 'order' : 'orders'}
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
                <BarChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: isMobile ? 0 : 10,
                    left: isMobile ? 0 : 10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
                  <XAxis
                    dataKey="status"
                    tickFormatter={(value: OrderStatus) => STATUS_LABELS[value]}
                    stroke={tokens.subdued}
                    tick={{ fontSize: 11 }}
                    tickLine={{ stroke: tokens.border }}
                  />
                  <YAxis
                    stroke={tokens.subdued}
                    tick={{ fontSize: 11 }}
                    tickLine={{ stroke: tokens.border }}
                    width={isMobile ? 40 : 50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={800}>
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>

          {/* Legend */}
          {!isLoading && chartData.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: 'center',
                pt: 1,
              }}
            >
              {chartData.map((item) => (
                <Chip
                  key={item.status}
                  label={`${STATUS_LABELS[item.status]}: ${item.count}`}
                  size="small"
                  sx={{
                    backgroundColor: `${STATUS_COLORS[item.status]}20`,
                    color: STATUS_COLORS[item.status],
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
              ))}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
})
