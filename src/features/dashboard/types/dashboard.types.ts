/**
 * Dashboard Module Type Definitions
 * 
 * Defines all TypeScript interfaces and types for the dashboard feature.
 * Follows strict typing principles with no `any` types.
 */

// ── KPI Metrics ──────────────────────────────────────────────────────────────

export interface RevenueMetrics {
  today: number
  month: number
  lastMonth: number
  /** Percentage growth compared to last month */
  growth: number
}

export interface OrderMetrics {
  today: number
  pending: number
  processing: number
  /** Average Order Value */
  avgValue: number
}

export interface ProductMetrics {
  total: number
  published: number
  lowStock: number
  outOfStock: number
}

export interface CustomerMetrics {
  newToday: number
  totalActive: number
  /** Customer Lifetime Value */
  clv: number
  /** Percentage of returning customers */
  returningRate: number
}

export interface DashboardOverview {
  revenue: RevenueMetrics
  orders: OrderMetrics
  products: ProductMetrics
  customers: CustomerMetrics
}

// ── Chart Data ───────────────────────────────────────────────────────────────

export type ChartPeriod = '7d' | '30d' | '90d' | '1y'

export interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
}

export interface RevenueChartData {
  data: RevenueDataPoint[]
  comparison: {
    growth: number
    previousTotal: number
  }
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'packed' 
  | 'shipped' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled' 
  | 'returned' 
  | 'rto';

export interface OrderStatusData {
  status: OrderStatus
  count: number
  revenue: number
}

export interface OrdersChartData {
  data: OrderStatusData[]
}

// ── Widgets ──────────────────────────────────────────────────────────────────

export interface TopProduct {
  id: number
  name: string
  thumbnail: string | null
  unitsSold: number
  revenue: number
}

export interface TopProductsResponse {
  products: TopProduct[]
}

export interface RecentOrder {
  id: number
  publicId: string
  customerName: string
  amount: number
  status: OrderStatus
  createdAt: string
}

export interface RecentOrdersResponse {
  orders: RecentOrder[]
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export type AlertType = 'low_stock' | 'failed_payment' | 'pending_return' | 'system_error'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface DashboardAlert {
  id: number
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  link?: string
  createdAt: string
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[]
}

// ── API Response Wrappers ────────────────────────────────────────────────────

export interface DashboardOverviewResponse {
  overview: DashboardOverview
}

// ── Component Props ──────────────────────────────────────────────────────────

export interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
  }
  icon?: React.ReactNode
  loading?: boolean
  error?: boolean
}

export interface ChartPeriodSelectorProps {
  period: ChartPeriod
  onChange: (period: ChartPeriod) => void
  disabled?: boolean
}

// ── Utility Types ────────────────────────────────────────────────────────────

export interface TimeRange {
  start: Date
  end: Date
}

/**
 * Represents the overall loading state of the dashboard
 */
export interface DashboardLoadingState {
  overview: boolean
  revenueChart: boolean
  ordersChart: boolean
  topProducts: boolean
  recentOrders: boolean
  alerts: boolean
}

/**
 * Represents refresh timestamps for auto-refresh mechanism
 */
export interface DashboardRefreshState {
  overview: number
  charts: number
  recentOrders: number
  alerts: number
}
