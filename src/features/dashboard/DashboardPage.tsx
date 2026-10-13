/**
 * DashboardPage Component
 * 
 * Main dashboard page that provides at-a-glance overview of the e-commerce platform.
 * Displays KPIs, charts, and widgets in a responsive grid layout.
 * 
 * Architecture:
 * - Permission-based rendering (requires analytics.view)
 * - Responsive grid layout (adapts to mobile, tablet, desktop)
 * - Staggered data loading for optimal perceived performance
 * - Manual refresh capability
 * - Comprehensive error handling
 */

import { memo, Suspense } from 'react'
import { Box, Grid, Alert, Stack } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import InventoryIcon from '@mui/icons-material/Inventory'
import PeopleIcon from '@mui/icons-material/People'
import { useAuth } from '../../auth/useAuth'
import { useDashboardOverview, useChartPeriod } from './hooks/useDashboard'
import {
  EnhancedKPICard,
  RefreshButton,
  AdvancedRevenueChart,
  AdvancedOrdersChart,
  TopProductsWidget,
  RecentOrdersWidget,
  AlertsWidget,
  PremiumDashboardHeader,
  SectionHeader,
} from './components'
import { formatMoney } from '../../lib/format'
import { tokens } from '../../theme'
import { SetupGuide } from './SetupGuide'

/**
 * KPI Cards Section
 * 
 * Displays the four main KPI metrics at the top of the dashboard.
 * Uses the overview data hook with proper loading and error states.
 */
const KPICardsSection = memo(function KPICardsSection() {
  const { data, isLoading, isError, refetch } = useDashboardOverview()

  // Show loading skeleton on initial load
  if (isLoading && !data) {
    return (
      <Grid container spacing={3}>
        {[...Array(4)].map((_, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <EnhancedKPICard title="Loading..." value="—" loading />
          </Grid>
        ))}
      </Grid>
    )
  }

  // Show error state
  if (isError || !data) {
    return (
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Alert severity="error" action={<RefreshButton onRefresh={() => refetch()} />}>
            Failed to load dashboard metrics. Please try refreshing.
          </Alert>
        </Grid>
      </Grid>
    )
  }

  const { revenue, orders, products, customers } = data.overview

  return (
    <Grid container spacing={3}>
      {/* Revenue KPI */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <EnhancedKPICard
          title="Revenue (Month)"
          value={formatMoney(revenue.month)}
          trend={{
            value: revenue.growth,
            label: 'vs last month',
          }}
          icon={<TrendingUpIcon />}
          color="success"
          subtitle={`Today: ${formatMoney(revenue.today)}`}
        />
      </Grid>

      {/* Orders KPI */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <EnhancedKPICard
          title="Orders"
          value={orders.today}
          subtitle={`${orders.pending} pending, ${orders.processing} processing`}
          icon={<ShoppingCartIcon />}
          color="primary"
        />
      </Grid>

      {/* Products KPI */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <EnhancedKPICard
          title="Products"
          value={products.published}
          subtitle={
            products.lowStock > 0
              ? `${products.lowStock} low stock`
              : products.outOfStock > 0
              ? `${products.outOfStock} out of stock`
              : 'All in stock'
          }
          icon={<InventoryIcon />}
          color={products.lowStock > 0 ? 'warning' : products.outOfStock > 0 ? 'error' : 'info'}
        />
      </Grid>

      {/* Customers KPI */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <EnhancedKPICard
          title="Customers"
          value={customers.totalActive}
          subtitle={`${customers.newToday} new today`}
          icon={<PeopleIcon />}
          color="info"
        />
      </Grid>
    </Grid>
  )
})

/**
 * Charts Section
 * 
 * Displays advanced revenue and orders charts with multiple visualization options.
 * Uses lazy loading to optimize initial page load.
 */
const ChartsSection = memo(function ChartsSection() {
  const { period } = useChartPeriod('30d')

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <AdvancedRevenueChart initialPeriod={period} />
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <AdvancedOrdersChart initialPeriod={period} />
      </Grid>
    </Grid>
  )
})

/**
 * Widgets Section
 * 
 * Displays top products and recent orders side by side.
 */
const WidgetsSection = memo(function WidgetsSection() {
  const { period } = useChartPeriod('30d')

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <TopProductsWidget period={period} />
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <RecentOrdersWidget />
      </Grid>
    </Grid>
  )
})

/**
 * Alerts Section
 * 
 * Displays critical alerts banner if there are any alerts.
 * Only shows when alerts exist to avoid visual clutter.
 */
const AlertsSection = memo(function AlertsSection() {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <AlertsWidget />
      </Grid>
    </Grid>
  )
})

/**
 * DashboardPage Component
 * 
 * Main dashboard page with comprehensive layout and functionality.
 * 
 * Features:
 * - Permission-based access control
 * - Responsive grid layout (mobile, tablet, desktop)
 * - Staggered component loading for perceived performance
 * - Manual refresh with visual feedback
 * - Error boundaries for each section
 * - Accessibility-compliant markup
 * 
 * Layout Structure:
 * 1. Page Header with refresh button
 * 2. KPI Cards (4 columns on desktop, 2 on tablet, 1 on mobile)
 * 3. Charts (2 columns on desktop, 1 on mobile)
 * 4. Widgets (2 columns on desktop, 1 on mobile)
 * 5. Alerts (full width, only if present)
 */
export function DashboardPage() {
  const { can } = useAuth()
  const { dataUpdatedAt, refetch } = useDashboardOverview()

  // Permission check
  if (!can('analytics.view')) {
    return (
      <Box>
        <PremiumDashboardHeader
          lastUpdated={null}
          onRefresh={() => refetch()}
        />
        <SetupGuide />
        <Alert severity="warning">
          You don't have permission to view analytics. Contact your administrator for access.
        </Alert>
      </Box>
    )
  }

  // Calculate last updated timestamp
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null

  return (
    <Box>
      {/* Premium Dashboard Header with Live Badge */}
      <PremiumDashboardHeader
        lastUpdated={lastUpdated}
        onRefresh={() => refetch()}
      />

      <SetupGuide />

      {/* Main Content */}
      <Stack spacing={4}>
        {/* KPI Cards - Always visible, loads first */}
        <KPICardsSection />

        {/* Charts Section */}
        <Box>
          <SectionHeader
            title="Analytics"
            description="Revenue and order trends"
          />
          <Suspense
            fallback={
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Box sx={{ height: 380, backgroundColor: tokens.hover, borderRadius: 2 }} />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Box sx={{ height: 380, backgroundColor: tokens.hover, borderRadius: 2 }} />
                </Grid>
              </Grid>
            }
          >
            <ChartsSection />
          </Suspense>
        </Box>

        {/* Widgets Section */}
        <Box>
          <SectionHeader
            title="Insights"
            description="Top products and recent activity"
          />
          <Suspense
            fallback={
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Box sx={{ height: 400, backgroundColor: tokens.hover, borderRadius: 2 }} />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Box sx={{ height: 400, backgroundColor: tokens.hover, borderRadius: 2 }} />
                </Grid>
              </Grid>
            }
          >
            <WidgetsSection />
          </Suspense>
        </Box>

        {/* Alerts - Load last, only show if there are alerts */}
        <Suspense fallback={null}>
          <AlertsSection />
        </Suspense>
      </Stack>
    </Box>
  )
}

/**
 * Export the page component as default for route lazy loading
 */
export default DashboardPage
