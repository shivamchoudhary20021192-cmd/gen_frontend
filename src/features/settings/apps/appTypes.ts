export interface Scope {
  scope: string
  description: string
  permissions: string[]
}

export interface App {
  id: string
  client_id: string
  handle: string
  name: string
  tagline: string | null
  description: string | null
  icon_url: string | null
  developer_name: string | null
  support_url: string | null
  privacy_policy_url: string | null
  app_url: string | null
  distribution: 'public' | 'custom'
  status: string
  requested_scopes: Scope[]
  redirect_urls: string[]
  client_secret_hint: string | null
  created_at: string
  installed?: boolean
}

export interface Installation {
  id: number
  app: { id: string; handle: string; name: string; icon_url: string | null; app_url: string | null; distribution: 'public' | 'custom' } | null
  granted_scopes: Scope[]
  status: string
  installed_at: string
}

export interface StorefrontToken {
  id: number
  title: string
  token_hint: string
  last_used_at: string | null
  created_at: string
}

export const appKeys = {
  installations: ['apps', 'installations'] as const,
  catalog: ['apps', 'catalog'] as const,
  scopes: ['apps', 'scopes'] as const,
  custom: ['apps', 'custom'] as const,
  storefrontTokens: ['apps', 'storefront-tokens'] as const,
}
