import type { Plan } from '../../../shop/types'

export interface Invoice {
  id: number
  number: string
  kind: 'cycle' | 'plan_change' | 'manual'
  status: 'open' | 'paid' | 'failed' | 'void'
  currency: string
  subtotal?: number
  tax_total?: number
  tax_note?: string | null
  customer_tax_id?: string | null
  total: number
  period_start: string | null
  period_end: string | null
  issued_at: string
  paid_at: string | null
  attempts: number
  next_attempt_at: string | null
  last_error: string | null
  lines?: { kind: 'subscription' | 'transaction_fee' | 'proration' | 'adjustment' | 'domain' | 'tax'; description: string; amount: number; period_start: string | null; period_end: string | null }[]
}

export interface BillingOverview {
  provider: string
  publishable_key: string | null
  payment_method: { label: string; expires: string | null } | null
  outstanding: Invoice[]
  pending_lines: { kind: string; description: string; amount: number; currency: string }[]
  frozen: boolean
  tax_details?: { legal_name: string | null; tax_id: string | null; tax_region: string | null; billing_email: string | null }
  platform_tax?: { country: string; name: string; rate: number; tax_id: string | null } | null
}

export interface SubscriptionView {
  plan: Plan | null
  subscription: {
    status: 'trialing' | 'active' | 'past_due' | 'frozen' | 'cancelled'
    trial_ends_at: string | null
    current_period_start: string
    current_period_end: string
    cancel_at_period_end: number | boolean
    provider: string
  } | null
  usage: Record<string, { used: number; limit: number | null }>
}

export interface CollectResult {
  invoice: Invoice
  outcome: 'paid' | 'failed' | 'requires_action' | 'pending' | 'already_settled'
  client_secret: string | null
}

/** What POST /billing/payment-method hands back: how to collect a card. */
export type CardSetup =
  | { provider: string; client_secret: string; publishable_key: string }
  | { provider: string; test_tokens: { token: string; description: string }[] }
  | { provider: string; message: string }

export const billingKeys = {
  overview: ['billing', 'overview'] as const,
  subscription: ['billing', 'subscription'] as const,
  plans: ['billing', 'plans'] as const,
  invoices: ['billing', 'invoices'] as const,
  invoice: (id: number) => ['billing', 'invoice', id] as const,
}

export const LIMIT_LABELS: Record<string, string> = {
  staff_accounts: 'Staff accounts',
  products: 'Products',
  locations: 'Locations',
  custom_domains: 'Custom domains',
  themes: 'Themes',
  webhook_subscriptions: 'Webhooks',
  installed_apps: 'Apps',
  storage_gb: 'Storage (GB)',
}

export const FEATURE_LABELS: Record<string, string> = {
  custom_domain: 'Your own domain',
  third_party_integrations: 'Third-party integrations',
  api_access: 'API access',
  abandoned_checkout_recovery: 'Abandoned checkout recovery',
  advanced_reports: 'Advanced reports',
  multi_location_inventory: 'Multi-location inventory',
  remove_platform_branding: 'Remove platform branding',
  automation_flows: 'Automation flows',
  marketing_campaigns: 'Marketing campaigns',
}
