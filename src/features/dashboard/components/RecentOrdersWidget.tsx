/**
 * RecentOrdersWidget Component
 * 
 * Displays a list of recent orders with customer info, amount, and status.
 * Provides quick navigation to order detail pages.
 */

import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Alert,
  Stack,
  Chip,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import ReceiptIcon from '@mui/icons-material/Receipt'
import { useRecentOrders } from '../hooks/useDashboard'
import { EmptyState } from './index'
import { formatMoney, formatRelative } from '../../../lib/format'
import { tokens } from '../../../theme'
import type { OrderStatus } from '../types/dashboard.types'

/**
 * Status chip configuration - matches backend order_status enum
 */
const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' }
> = {
  pending: { label: 'Pending', color: 'warning' },
  confirmed: { label: 'Confirmed', color: 'info' },
  processing: { label: 'Processing', color: 'info' },
  packed: { label: 'Packed', color: 'primary' },
  shipped: { label: 'Shipped', color: 'secondary' },
  out_for_delivery: { label: 'Out for Delivery', color: 'primary' },
  delivered: { label: 'Delivered', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' },
  returned: { label: 'Returned', color: 'warning' },
  rto: { label: 'RTO', color: 'error' },
}

/**
 * Loading skeleton for order table
 */
const OrdersSkeleton = memo(function OrdersSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton variant="text" width="80%" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="60%" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="70%" />
          </TableCell>
          <TableCell>
            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="50%" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
})

export interface RecentOrdersWidgetProps {
  /** Number of orders to display */
  limit?: number
}

/**
 * RecentOrdersWidget Component
 * 
 * Displays recent orders in a compact table format.
 * Features:
 * - Order ID with click-through to detail page
 * - Customer name
 * - Order amount
 * - Status chip with color coding
 * - Relative timestamp
 * - Loading and error states
 * - Empty state for no orders
 */
export const RecentOrdersWidget = memo<RecentOrdersWidgetProps>(function RecentOrdersWidget({
  limit = 10,
}) {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useRecentOrders({ limit })

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Recent Orders</Typography>
            <Alert severity="error">
              Failed to load recent orders: {error?.message ?? 'Unknown error'}
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const orders = data?.orders ?? []

  // Empty state
  if (!isLoading && orders.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Recent Orders</Typography>
            <EmptyState
              icon={<ReceiptIcon sx={{ fontSize: 64, color: tokens.faint }} />}
              title="No orders yet"
              description="Recent orders will appear here once customers start placing orders."
            />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Recent Orders</Typography>
            {!isLoading && orders.length > 0 && (
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/orders')}
                sx={{ textDecoration: 'none' }}
              >
                View all
              </Link>
            )}
          </Box>
        </Box>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: tokens.subdued, fontSize: 11, textTransform: 'uppercase' }}>
                  Order
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.subdued, fontSize: 11, textTransform: 'uppercase' }}>
                  Customer
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.subdued, fontSize: 11, textTransform: 'uppercase' }}>
                  Amount
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.subdued, fontSize: 11, textTransform: 'uppercase' }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.subdued, fontSize: 11, textTransform: 'uppercase' }}>
                  Time
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <OrdersSkeleton />
              ) : (
                orders.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { borderBottom: 0 },
                    }}
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <TableCell>
                      <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/orders/${order.id}`)
                        }}
                        sx={{
                          color: tokens.ink,
                          fontWeight: 600,
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        #{order.publicId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.customerName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatMoney(order.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_CONFIG[order.status].label}
                        color={STATUS_CONFIG[order.status].color}
                        size="small"
                        sx={{ fontSize: 11, height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatRelative(order.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
})
