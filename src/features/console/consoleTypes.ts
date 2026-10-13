/** Shapes the operators' API (/platform/api/v1) returns. */

export type ShopStatus = 'provisioning' | 'active' | 'paused' | 'frozen' | 'suspended' | 'closed'

export interface ConsoleOverview {
  shops_by_status: Partial<Record<ShopStatus, number>>
  shops_by_plan: Record<string, number>
  revenue: { currency: string; mrr: number; paying: number; trialing: number }[]
  outstanding: { currency: string; total: number; bills: number }[]
  signups_last_30_days: { day: string; total: number }[]
  newest_shops: { id: number; handle: string; name: string; status: ShopStatus; country_code: string; created_at: string; plan: string | null }[]
  jobs: JobStat[]
  pods: unknown
}

export interface JobStat {
  queue: string
  status: 'pending' | 'running' | 'dead'
  count: number
  oldest: string | null
}

export interface ConsoleShop {
  id: number
  public_id: string
  handle: string
  name: string
  status: ShopStatus
  plan: string | null
  pod_id: number
  vertical: string
  country_code: string
  currency: string
  primary_domain: string | null
  owner_email: string | null
  created_at: string
}

export interface ConsolePlan {
  id: number
  handle: string
  name: string
  tagline: string | null
  price_amount: string
  currency: string
  billing_interval: 'month' | 'year'
  trial_days: number
  transaction_fee_bps: number
  limits: Record<string, number | null> | string
  features: Record<string, boolean> | string
  is_public: number
  is_active: number
  sort_order: number
}

export interface ConsoleShopDetail {
  shop: Record<string, unknown> & {
    id: number
    handle: string
    name: string
    status: ShopStatus
    status_reason: string | null
    email: string | null
    phone: string | null
    country_code: string
    currency: string
    timezone: string
    vertical: string
    pod_id: number
    created_at: string
    provisioned_at: string | null
    closed_at: string | null
  }
  plan: ConsolePlan | null
  domains: { id: number; hostname: string; kind: string; is_primary: number; verification_status: string }[]
  subscription: {
    status: string
    price_amount: string
    currency: string
    billing_interval: string
    trial_ends_at: string | null
    current_period_end: string
    provider: string
  } | null
  staff: { admin_user_id: number; email: string; first_name: string; last_name: string | null; is_owner: number; has_full_access: number; status: string; last_accessed_at: string | null }[]
  invoices: { id: number; number: string; status: string; total: number; currency: string; issued_at: string; paid_at: string | null }[]
}

export interface ConsoleInvoice {
  id: number
  number: string
  shop: { id: number; handle: string; name: string }
  kind: string
  status: 'open' | 'paid' | 'failed' | 'void'
  total: number
  currency: string
  issued_at: string
  paid_at: string | null
  attempts: number
  last_error: string | null
}

export interface ExchangeRate {
  currency: string
  per_usd: number
  source: 'ecb' | 'manual' | string
  updated_at: string
}

export interface ConsoleApp {
  id: string
  client_id: string
  handle: string
  name: string
  tagline: string | null
  developer_name: string | null
  app_url: string | null
  distribution: 'public' | 'custom'
  status: string
  requested_scopes: { scope: string; description: string }[]
  redirect_urls: string[]
  compliance_webhook_url: string | null
  created_at: string
}

export interface ConsoleEmail {
  id: number
  shop_id: number | null
  to: string
  template: string
  subject: string
  body: string | null
  status: string
  provider: string | null
  error: string | null
  attempts: number
  created_at: string
  sent_at: string | null
}

export const consoleKeys = {
  overview: ['console', 'overview'] as const,
  shops: (params: Record<string, unknown>) => ['console', 'shops', params] as const,
  shop: (id: number) => ['console', 'shop', id] as const,
  plans: ['console', 'plans'] as const,
  invoices: (params: Record<string, unknown>) => ['console', 'invoices', params] as const,
  rates: ['console', 'rates'] as const,
  apps: ['console', 'apps'] as const,
  jobs: ['console', 'jobs'] as const,
  emails: (params: Record<string, unknown>) => ['console', 'emails', params] as const,
}

export const STATUS_CHIP: Record<ShopStatus, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  provisioning: { label: 'Provisioning', color: 'info' },
  active: { label: 'Active', color: 'success' },
  paused: { label: 'Paused', color: 'default' },
  frozen: { label: 'Frozen', color: 'warning' },
  suspended: { label: 'Suspended', color: 'error' },
  closed: { label: 'Closed', color: 'default' },
}

/** JSON columns arrive as strings from some drivers and as objects from others. */
export function parseJson<T>(value: T | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
