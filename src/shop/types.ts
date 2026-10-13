/** The current store, as GET /shop returns it. */
export interface Shop {
  id: string
  handle: string
  name: string
  email: string | null
  phone: string | null
  status: 'provisioning' | 'active' | 'paused' | 'frozen' | 'suspended' | 'closed'
  status_reason: string | null
  vertical: string
  country_code: string
  currency: string
  timezone: string
  locale: string
  weight_unit: 'g' | 'kg' | 'lb' | 'oz'
  tax_engine: string
  storefront_password_enabled: boolean
  primary_domain: string | null
  storefront_url: string
  provisioned_at: string | null
  created_at: string
}

export interface Plan {
  handle: string
  name: string
  tagline: string | null
  price: { amount: number; currency: string; interval: 'month' | 'year' }
  trial_days: number
  transaction_fee_percent: number
  limits: Record<string, number | null>
  features: Record<string, boolean>
  current: boolean
}

export interface ShopSummary {
  shop: Shop
  plan: Plan | null
  subscription: {
    status: 'trialing' | 'active' | 'past_due' | 'frozen' | 'cancelled'
    trial_ends_at: string | null
    current_period_end: string
    cancel_at_period_end: boolean
  } | null
  entitlements: { limits: Record<string, number | null>; features: Record<string, boolean> }
  setup: { provisioning: { total: number; done: number; failed: string[] } } & Record<string, unknown>
}

/** A store this person is on the staff of (GET /auth/shops). */
export interface Membership {
  shop_id: number
  handle: string
  name: string
  status: string
  primary_domain: string | null
  is_owner: boolean
  has_full_access: boolean
  member_status: 'invited' | 'active' | 'suspended'
}
