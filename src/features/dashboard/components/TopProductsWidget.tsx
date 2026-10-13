/**
 * TopProductsWidget Component
 * 
 * Displays a list of top-selling products with thumbnails, units sold, and revenue.
 * Provides quick navigation to product details.
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
  Avatar,
  Link,
  Skeleton,
  Chip,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
import { useTopProducts } from '../hooks/useDashboard'
import { EmptyState } from './index'
import { formatMoney } from '../../../lib/format'
import { tokens } from '../../../theme'
import type { ChartPeriod } from '../types/dashboard.types'

/**
 * Loading skeleton for product list
 */
const ProductSkeleton = memo(function ProductSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1.5,
            borderBottom: index < 4 ? `1px solid ${tokens.border}` : 'none',
          }}
        >
          <Skeleton variant="rectangular" width={48} height={48} sx={{ borderRadius: 1 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="70%" height={20} />
            <Skeleton variant="text" width="40%" height={16} />
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Skeleton variant="text" width={60} height={20} />
            <Skeleton variant="text" width={40} height={16} />
          </Box>
        </Box>
      ))}
    </>
  )
})

export interface TopProductsWidgetProps {
  /** Number of products to display */
  limit?: number
  /** Time period for calculations */
  period?: ChartPeriod
}

/**
 * TopProductsWidget Component
 * 
 * Displays top-selling products ranked by revenue.
 * Features:
 * - Product thumbnails with fallback
 * - Units sold and revenue metrics
 * - Click-through to product detail page
 * - Loading and error states
 * - Empty state for no data
 */
export const TopProductsWidget = memo<TopProductsWidgetProps>(function TopProductsWidget({
  limit = 5,
  period = '30d',
}) {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useTopProducts({ limit, period })

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Top Products</Typography>
              <Chip
                size="small"
                label={period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? '90 days' : '1 year'}
                variant="outlined"
              />
            </Box>
            <Alert severity="error">
              Failed to load top products: {error?.message ?? 'Unknown error'}
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const products = data?.products ?? []

  // Empty state
  if (!isLoading && products.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Top Products</Typography>
              <Chip
                size="small"
                label={period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? '90 days' : '1 year'}
                variant="outlined"
              />
            </Box>
            <EmptyState
              icon={<TrendingUpIcon sx={{ fontSize: 64, color: tokens.faint }} />}
              title="No sales data yet"
              description="Top-selling products will appear here once orders are placed."
            />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6">Top Products</Typography>
            <Chip
              size="small"
              label={period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? '90 days' : '1 year'}
              variant="outlined"
            />
          </Box>

          {/* Product List */}
          {isLoading ? (
            <ProductSkeleton />
          ) : (
            <Stack spacing={0}>
              {products.map((product, index) => (
                <Box
                  key={product.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.5,
                    borderBottom: index < products.length - 1 ? `1px solid ${tokens.border}` : 'none',
                    transition: 'background-color 0.2s',
                    '&:hover': {
                      backgroundColor: tokens.hover,
                      cursor: 'pointer',
                    },
                  }}
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  {/* Rank Badge */}
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: index === 0 ? tokens.success : tokens.hover,
                      color: index === 0 ? tokens.white : tokens.subdued,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </Box>

                  {/* Product Thumbnail */}
                  <Avatar
                    variant="rounded"
                    src={product.thumbnail ? `/media/${product.thumbnail}` : undefined}
                    sx={{
                      width: 48,
                      height: 48,
                      backgroundColor: tokens.hover,
                    }}
                  >
                    <ImageNotSupportedIcon sx={{ color: tokens.subdued, fontSize: 24 }} />
                  </Avatar>

                  {/* Product Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/products/${product.id}`)
                      }}
                      sx={{
                        color: tokens.ink,
                        fontWeight: 600,
                        textAlign: 'left',
                        textDecoration: 'none',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {product.name}
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {product.unitsSold} {product.unitsSold === 1 ? 'unit' : 'units'} sold
                    </Typography>
                  </Box>

                  {/* Revenue */}
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.success }}>
                      {formatMoney(product.revenue)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
})
