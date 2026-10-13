/**
 * Dashboard Data Hooks
 * 
 * Custom React hooks using TanStack Query for fetching and managing dashboard data.
 * Implements proper caching strategies, auto-refresh, and error handling.
 * 
 * Architecture patterns:
 * - Stale-while-revalidate for optimal UX
 * - Background refetching at intervals appropriate to data freshness requirements
 * - Centralized error handling
 * - Type-safe query keys for cache invalidation
 */

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useState, useCallback, useMemo } from 'react'
import {
  fetchDashboardOverview,
  fetchRevenueChart,
  fetchOrdersChart,
  fetchTopProducts,
  fetchRecentOrders,
  fetchDashboardAlerts,
  type FetchTopProductsParams,
} from '../api/dashboardApi'
import type {
  DashboardOverviewResponse,
  RevenueChartData,
  OrdersChartData,
  TopProductsResponse,
  RecentOrdersResponse,
  DashboardAlertsResponse,
  ChartPeriod,
} from '../types/dashboard.types'

// ── Query Keys (centralized for cache management) ────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: () => [...dashboardKeys.all, 'overview'] as const,
  revenueChart: (period: ChartPeriod) => [...dashboardKeys.all, 'revenue-chart', period] as const,
  ordersChart: (period: ChartPeriod) => [...dashboardKeys.all, 'orders-chart', period] as const,
  topProducts: (params: FetchTopProductsParams) => [...dashboardKeys.all, 'top-products', params] as const,
  recentOrders: (limit: number) => [...dashboardKeys.all, 'recent-orders', limit] as const,
  alerts: () => [...dashboardKeys.all, 'alerts'] as const,
} as const

// ── Configuration Constants ──────────────────────────────────────────────────

const REFETCH_INTERVALS = {
  OVERVIEW: 60_000, // 60 seconds for KPIs
  CHARTS: 300_000, // 5 minutes for charts
  RECENT_ORDERS: 30_000, // 30 seconds for recent orders
  ALERTS: 15_000, // 15 seconds for alerts
  TOP_PRODUCTS: 300_000, // 5 minutes for top products
} as const

const STALE_TIMES = {
  OVERVIEW: 30_000, // Consider stale after 30s
  CHARTS: 120_000, // Consider stale after 2 minutes
  RECENT_ORDERS: 15_000, // Consider stale after 15s
  ALERTS: 10_000, // Consider stale after 10s
  TOP_PRODUCTS: 120_000, // Consider stale after 2 minutes
} as const

// ── Dashboard Overview Hook ──────────────────────────────────────────────────

export interface UseDashboardOverviewOptions {
  enabled?: boolean
  refetchInterval?: number | false
}

export function useDashboardOverview(
  options: UseDashboardOverviewOptions = {}
): UseQueryResult<DashboardOverviewResponse, Error> {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: ({ signal }) => fetchDashboardOverview(signal),
    staleTime: STALE_TIMES.OVERVIEW,
    refetchInterval: options.refetchInterval ?? REFETCH_INTERVALS.OVERVIEW,
    refetchOnWindowFocus: true,
    enabled: options.enabled !== false,
  })
}

// ── Revenue Chart Hook ───────────────────────────────────────────────────────

export interface UseRevenueChartOptions {
  period: ChartPeriod
  enabled?: boolean
}

export function useRevenueChart(
  options: UseRevenueChartOptions
): UseQueryResult<RevenueChartData, Error> {
  return useQuery({
    queryKey: dashboardKeys.revenueChart(options.period),
    queryFn: ({ signal }) => fetchRevenueChart({ period: options.period }, signal),
    staleTime: STALE_TIMES.CHARTS,
    refetchInterval: REFETCH_INTERVALS.CHARTS,
    refetchOnWindowFocus: true,
    enabled: options.enabled !== false,
  })
}

// ── Orders Chart Hook ────────────────────────────────────────────────────────

export interface UseOrdersChartOptions {
  period: ChartPeriod
  enabled?: boolean
}

export function useOrdersChart(
  options: UseOrdersChartOptions
): UseQueryResult<OrdersChartData, Error> {
  return useQuery({
    queryKey: dashboardKeys.ordersChart(options.period),
    queryFn: ({ signal }) => fetchOrdersChart({ period: options.period }, signal),
    staleTime: STALE_TIMES.CHARTS,
    refetchInterval: REFETCH_INTERVALS.CHARTS,
    refetchOnWindowFocus: true,
    enabled: options.enabled !== false,
  })
}

// ── Top Products Hook ────────────────────────────────────────────────────────

export interface UseTopProductsOptions extends FetchTopProductsParams {
  enabled?: boolean
}

export function useTopProducts(
  options: UseTopProductsOptions = {}
): UseQueryResult<TopProductsResponse, Error> {
  const params: FetchTopProductsParams = {
    limit: options.limit ?? 5,
    period: options.period ?? '30d',
  }

  return useQuery({
    queryKey: dashboardKeys.topProducts(params),
    queryFn: ({ signal }) => fetchTopProducts(params, signal),
    staleTime: STALE_TIMES.TOP_PRODUCTS,
    refetchInterval: REFETCH_INTERVALS.TOP_PRODUCTS,
    refetchOnWindowFocus: true,
    enabled: options.enabled !== false,
  })
}

// ── Recent Orders Hook ───────────────────────────────────────────────────────

export interface UseRecentOrdersOptions {
  limit?: number
  enabled?: boolean
}

export function useRecentOrders(
  options: UseRecentOrdersOptions = {}
): UseQueryResult<RecentOrdersResponse, Error> {
  const limit = options.limit ?? 10

  return useQuery({
    queryKey: dashboardKeys.recentOrders(limit),
    queryFn: ({ signal }) => fetchRecentOrders({ limit }, signal),
    staleTime: STALE_TIMES.RECENT_ORDERS,
    refetchInterval: REFETCH_INTERVALS.RECENT_ORDERS,
    refetchOnWindowFocus: true,
    enabled: options.enabled !== false,
  })
}

// ── Alerts Hook ──────────────────────────────────────────────────────────────

export interface UseDashboardAlertsOptions {
  enabled?: boolean
}

export function useDashboardAlerts(
  options: UseDashboardAlertsOptions = {}
): UseQueryResult<DashboardAlertsResponse, Error> {
  return useQuery({
    queryKey: dashboardKeys.alerts(),
    queryFn: ({ signal }) => fetchDashboardAlerts(signal),
    staleTime: STALE_TIMES.ALERTS,
    refetchInterval: REFETCH_INTERVALS.ALERTS,
    refetchOnWindowFocus: true,
    enabled: options.enabled !== false,
  })
}

// ── Composite Dashboard Hook (orchestrates all data fetching) ────────────────

export interface UseDashboardDataOptions {
  chartPeriod?: ChartPeriod
  enableAutoRefresh?: boolean
}

export interface DashboardData {
  overview: UseQueryResult<DashboardOverviewResponse, Error>
  revenueChart: UseQueryResult<RevenueChartData, Error>
  ordersChart: UseQueryResult<OrdersChartData, Error>
  topProducts: UseQueryResult<TopProductsResponse, Error>
  recentOrders: UseQueryResult<RecentOrdersResponse, Error>
  alerts: UseQueryResult<DashboardAlertsResponse, Error>
  isLoading: boolean
  isError: boolean
  hasData: boolean
  lastUpdated: Date | null
}

/**
 * Composite hook that fetches all dashboard data with coordinated loading states.
 * Provides a single interface for the main DashboardPage component.
 */
export function useDashboardData(options: UseDashboardDataOptions = {}): DashboardData {
  const [chartPeriod] = useState<ChartPeriod>(options.chartPeriod ?? '30d')

  const overview = useDashboardOverview({
    refetchInterval: options.enableAutoRefresh !== false ? REFETCH_INTERVALS.OVERVIEW : false,
  })

  const revenueChart = useRevenueChart({
    period: chartPeriod,
    enabled: options.enableAutoRefresh !== false,
  })

  const ordersChart = useOrdersChart({
    period: chartPeriod,
    enabled: options.enableAutoRefresh !== false,
  })

  const topProducts = useTopProducts({
    limit: 5,
    period: chartPeriod,
    enabled: options.enableAutoRefresh !== false,
  })

  const recentOrders = useRecentOrders({
    limit: 10,
    enabled: options.enableAutoRefresh !== false,
  })

  const alerts = useDashboardAlerts({
    enabled: options.enableAutoRefresh !== false,
  })

  // Derived states
  const isLoading = useMemo(
    () =>
      overview.isLoading ||
      revenueChart.isLoading ||
      ordersChart.isLoading ||
      topProducts.isLoading ||
      recentOrders.isLoading ||
      alerts.isLoading,
    [
      overview.isLoading,
      revenueChart.isLoading,
      ordersChart.isLoading,
      topProducts.isLoading,
      recentOrders.isLoading,
      alerts.isLoading,
    ]
  )

  const isError = useMemo(
    () =>
      overview.isError ||
      revenueChart.isError ||
      ordersChart.isError ||
      topProducts.isError ||
      recentOrders.isError ||
      alerts.isError,
    [
      overview.isError,
      revenueChart.isError,
      ordersChart.isError,
      topProducts.isError,
      recentOrders.isError,
      alerts.isError,
    ]
  )

  const hasData = useMemo(
    () =>
      Boolean(
        overview.data &&
          revenueChart.data &&
          ordersChart.data &&
          topProducts.data &&
          recentOrders.data &&
          alerts.data
      ),
    [overview.data, revenueChart.data, ordersChart.data, topProducts.data, recentOrders.data, alerts.data]
  )

  const lastUpdated = useMemo(() => {
    const timestamps = [
      overview.dataUpdatedAt,
      revenueChart.dataUpdatedAt,
      ordersChart.dataUpdatedAt,
      topProducts.dataUpdatedAt,
      recentOrders.dataUpdatedAt,
      alerts.dataUpdatedAt,
    ].filter((t): t is number => t > 0)

    return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
  }, [
    overview.dataUpdatedAt,
    revenueChart.dataUpdatedAt,
    ordersChart.dataUpdatedAt,
    topProducts.dataUpdatedAt,
    recentOrders.dataUpdatedAt,
    alerts.dataUpdatedAt,
  ])

  return {
    overview,
    revenueChart,
    ordersChart,
    topProducts,
    recentOrders,
    alerts,
    isLoading,
    isError,
    hasData,
    lastUpdated,
  }
}

// ── Chart Period Management Hook ─────────────────────────────────────────────

export interface UseChartPeriodResult {
  period: ChartPeriod
  setPeriod: (period: ChartPeriod) => void
  availablePeriods: readonly ChartPeriod[]
}

/**
 * Hook for managing chart period selection with validation
 */
export function useChartPeriod(initialPeriod: ChartPeriod = '30d'): UseChartPeriodResult {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod)

  const availablePeriods: readonly ChartPeriod[] = ['7d', '30d', '90d', '1y'] as const

  const handleSetPeriod = useCallback((newPeriod: ChartPeriod) => {
    if (availablePeriods.includes(newPeriod)) {
      setPeriod(newPeriod)
    }
  }, [availablePeriods])

  return {
    period,
    setPeriod: handleSetPeriod,
    availablePeriods,
  }
}

// ── Manual Refresh Hook ──────────────────────────────────────────────────────

export interface UseManualRefreshResult {
  refresh: () => Promise<void>
  isRefreshing: boolean
}

/**
 * Hook for manually refreshing all dashboard data
 */
export function useManualRefresh(): UseManualRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false)
  // The client comes from the provider. There is no module-level singleton to
  // import — reaching for one invalidated nothing and the button did nothing.
  const queryClient = useQueryClient()

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Invalidate all dashboard queries to force refetch
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    } finally {
      // Keep loading state for at least 500ms for better UX
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [queryClient])

  return { refresh, isRefreshing }
}
