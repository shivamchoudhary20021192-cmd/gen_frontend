/**
 * Dashboard API Client
 * 
 * Provides type-safe API functions for fetching dashboard data.
 * All functions follow the existing API client pattern using the shared `api` client.
 */

import { api } from '../../../api/client'
import type {
  DashboardOverviewResponse,
  RevenueChartData,
  OrdersChartData,
  TopProductsResponse,
  RecentOrdersResponse,
  DashboardAlertsResponse,
  ChartPeriod,
} from '../types/dashboard.types'

// ── Dashboard Overview (KPIs) ────────────────────────────────────────────────

export async function fetchDashboardOverview(
  signal?: AbortSignal
): Promise<DashboardOverviewResponse> {
  return api.get<DashboardOverviewResponse>('/dashboard/overview', undefined, signal)
}

// ── Revenue Chart ────────────────────────────────────────────────────────────

export interface FetchRevenueChartParams {
  period: ChartPeriod
}

export async function fetchRevenueChart(
  params: FetchRevenueChartParams,
  signal?: AbortSignal
): Promise<RevenueChartData> {
  return api.get<RevenueChartData>(
    '/dashboard/revenue-chart',
    { period: params.period },
    signal
  )
}

// ── Orders Chart ─────────────────────────────────────────────────────────────

export interface FetchOrdersChartParams {
  period: ChartPeriod
}

export async function fetchOrdersChart(
  params: FetchOrdersChartParams,
  signal?: AbortSignal
): Promise<OrdersChartData> {
  return api.get<OrdersChartData>(
    '/dashboard/orders-chart',
    { period: params.period },
    signal
  )
}

// ── Top Products Widget ──────────────────────────────────────────────────────

export interface FetchTopProductsParams {
  limit?: number
  period?: ChartPeriod
}

export async function fetchTopProducts(
  params: FetchTopProductsParams = {},
  signal?: AbortSignal
): Promise<TopProductsResponse> {
  return api.get<TopProductsResponse>(
    '/dashboard/top-products',
    {
      limit: params.limit ?? 5,
      period: params.period ?? '30d',
    },
    signal
  )
}

// ── Recent Orders Widget ─────────────────────────────────────────────────────

export interface FetchRecentOrdersParams {
  limit?: number
}

export async function fetchRecentOrders(
  params: FetchRecentOrdersParams = {},
  signal?: AbortSignal
): Promise<RecentOrdersResponse> {
  return api.get<RecentOrdersResponse>(
    '/dashboard/recent-orders',
    { limit: params.limit ?? 10 },
    signal
  )
}

// ── Alerts Widget ────────────────────────────────────────────────────────────

export async function fetchDashboardAlerts(
  signal?: AbortSignal
): Promise<DashboardAlertsResponse> {
  return api.get<DashboardAlertsResponse>('/dashboard/alerts', undefined, signal)
}

// ── Export all as namespace for convenience ──────────────────────────────────

export const dashboardApi = {
  fetchOverview: fetchDashboardOverview,
  fetchRevenueChart,
  fetchOrdersChart,
  fetchTopProducts,
  fetchRecentOrders,
  fetchAlerts: fetchDashboardAlerts,
} as const
