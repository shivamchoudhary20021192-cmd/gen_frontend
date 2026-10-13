export type Category = 'payments' | 'sms' | 'email' | 'whatsapp' | 'shipping' | 'tax'

export interface CredentialField {
  key: string
  label: string
  secret: boolean
  required: boolean
  placeholder: string | null
  help: string | null
}

export interface ConfigField {
  key: string
  label: string
  type: 'string' | 'boolean' | 'number' | 'select'
  required: boolean
  options: { value: string; label: string }[] | null
  default: string | number | boolean | null
  help: string | null
}

export interface Provider {
  key: string
  name: string
  category: Category
  channels: string[] | null
  description: string
  docs_url: string | null
  recommended: boolean
  supports_webhooks: boolean
  credential_fields: CredentialField[]
  config_fields: ConfigField[]
}

export interface Connection {
  id: string
  provider: string
  provider_name: string
  category: Category
  channels: string[] | null
  name: string
  status: 'active' | 'disabled' | 'error'
  mode: 'live' | 'test'
  is_default: boolean
  credentials_hint: string | null
  config: Record<string, string | number | boolean | null>
  inbound_url: string | null
  last_verified_at: string | null
  last_used_at: string | null
  last_error: string | null
  available: boolean
  created_at: string
  updated_at: string
}

export interface ConnectionDetail {
  connection: Connection
  recent_webhooks: {
    id: number
    type: string
    external_id: string | null
    signature_valid: boolean
    status: 'received' | 'processed' | 'ignored' | 'failed'
    error: string | null
    received_at: string
    processed_at: string | null
  }[]
}

export const CATEGORY_LABELS: Record<Category, string> = {
  payments: 'Payments',
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
  shipping: 'Shipping and couriers',
  tax: 'Tax',
}

export const CATEGORY_HINTS: Record<Category, string> = {
  payments: 'Take cards, UPI, wallets and bank payments at checkout.',
  sms: 'Order updates and one-time codes by text message.',
  email: 'Order confirmations, shipping updates and campaigns.',
  whatsapp: 'Order updates and campaigns on WhatsApp.',
  shipping: 'Book couriers, print labels and track parcels.',
  tax: 'Accurate rates by address, and filing reports.',
}

export const integrationKeys = {
  list: ['integrations', 'list'] as const,
  catalog: ['integrations', 'catalog'] as const,
  detail: (id: string) => ['integrations', 'detail', id] as const,
}
