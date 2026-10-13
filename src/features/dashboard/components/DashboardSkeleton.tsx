/**
 * DashboardSkeleton Component
 * 
 * Loading skeleton for the entire dashboard page.
 * Provides a visual placeholder that matches the final layout structure.
 */

import { Box, Card, CardContent, Grid, Skeleton, Stack } from '@mui/material'
import { memo } from 'react'

/**
 * Skeleton for a single KPI card
 */
const KPICardSkeleton = memo(function KPICardSkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="circular" width={32} height={32} />
          </Box>
          <Skeleton variant="text" width="40%" height={40} />
          <Skeleton variant="text" width="50%" height={16} />
        </Stack>
      </CardContent>
    </Card>
  )
})

/**
 * Skeleton for a chart card
 */
const ChartSkeleton = memo(function ChartSkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton variant="text" width="40%" height={28} />
            <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 1 }} />
          </Box>
          <Skeleton variant="rectangular" width="100%" height={280} sx={{ borderRadius: 2 }} />
        </Stack>
      </CardContent>
    </Card>
  )
})

/**
 * Skeleton for a widget card (like top products or recent orders)
 */
const WidgetSkeleton = memo(function WidgetSkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton variant="text" width="40%" height={28} />
            <Skeleton variant="text" width="15%" height={24} />
          </Box>
          {[...Array(5)].map((_, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 1,
              }}
            >
              <Skeleton variant="rectangular" width={48} height={48} sx={{ borderRadius: 1 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
              <Skeleton variant="text" width={60} height={20} />
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
})

/**
 * Complete dashboard loading skeleton
 * 
 * Matches the final dashboard layout structure:
 * - 4 KPI cards at the top
 * - 2 chart cards in the middle
 * - 2 widget cards at the bottom
 */
export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <Box>
      {/* KPI Cards Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[...Array(4)].map((_, index) => (
          <Grid key={`kpi-${index}`} size={{ xs: 12, sm: 6, md: 3 }}>
            <KPICardSkeleton />
          </Grid>
        ))}
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <ChartSkeleton />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <ChartSkeleton />
        </Grid>
      </Grid>

      {/* Widgets Row */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <WidgetSkeleton />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <WidgetSkeleton />
        </Grid>
      </Grid>
    </Box>
  )
})
