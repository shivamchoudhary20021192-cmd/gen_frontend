import type { ChipProps } from '@mui/material'

export type RequestType = 'access' | 'portability' | 'correction' | 'erasure' | 'withdraw_consent' | 'grievance'
export type RequestStatus = 'verifying' | 'received' | 'in_progress' | 'scheduled' | 'completed' | 'rejected' | 'cancelled'
export type ConsentMethod = 'accept_all' | 'reject_all' | 'custom' | 'opt_out_page' | 'gpc' | 'api' | 'account'

export interface PrivacyRequest {
  id: number
  reference: string
  type: RequestType
  type_label: string
  status: RequestStatus
  source: 'storefront' | 'account' | 'admin' | 'api'
  contact: string
  requester_country: string | null
  details: string | null
  customer: { id: number; name: string | null; email: string | null; erased: boolean } | null
  verified_at: string | null
  due_at: string | null
  overdue: boolean
  scheduled_for: string | null
  processed_at: string | null
  completed_at: string | null
  outcome_note: string | null
  created_at: string
  updated_at: string
}

export interface RequestList {
  requests: PrivacyRequest[]
  pagination: { page: number; limit: number; total: number }
  counts: Partial<Record<RequestStatus, number>>
  overdue: number
}

export interface RequestDetail {
  request: PrivacyRequest
  subject: { customer_id: number | null; emails: string[]; phones: string[]; orders: number; last_order_at: string | null }
  exports: { id: number; size_bytes: number; expires_at: string; downloaded_at: string | null; sent_to_customer: boolean; created_at: string }[]
  erasure_would_run_at: string | null
}

export interface ConsentRecord {
  id: number
  consent_id: string
  customer: { id: number; name: string | null; email: string | null } | null
  country: string | null
  consent_required: boolean
  sale_opt_out_region: boolean
  purposes: { analytics: boolean; marketing: boolean; preferences: boolean; sale_of_data: boolean }
  method: ConsentMethod
  gpc: boolean
  policy_version: number | null
  locale: string | null
  page_path: string | null
  ip_prefix: string | null
  user_agent: string | null
  created_at: string
}

export interface Overview {
  requests: { open: number; overdue: number; counts: Partial<Record<RequestStatus, number>>; next: PrivacyRequest[] }
  consents: {
    days: number
    total: number
    by_method: Partial<Record<ConsentMethod, number>>
    allowed_percent: { analytics: number; marketing: number; preferences: number; sale_of_data: number }
    countries: { country: string | null; count: number }[]
  }
  banner: { enabled: boolean; regions: 'required' | 'all' | 'custom'; sale_opt_out_enabled: boolean; honor_gpc: boolean }
  policies: { kind: string; title: string; published: boolean; version: number; updated_at: string | null }[]
  grievance_officer_named: boolean
  exports_held: number
  storefront_url: string
}

export const privacyKeys = {
  all: ['privacy'] as const,
  overview: ['privacy', 'overview'] as const,
  requests: (params: Record<string, unknown>) => ['privacy', 'requests', params] as const,
  request: (id: number) => ['privacy', 'request', id] as const,
  consents: (params: Record<string, unknown>) => ['privacy', 'consents', params] as const,
  settings: ['privacy', 'settings'] as const,
  policies: ['privacy', 'policies'] as const,
}

export const TYPE_LABEL: Record<RequestType, string> = {
  access: 'Access',
  portability: 'Data portability',
  correction: 'Correction',
  erasure: 'Erasure',
  withdraw_consent: 'Withdraw consent',
  grievance: 'Grievance',
}

export const TYPE_HELP: Record<RequestType, string> = {
  access: 'Send them a copy of the personal data the store holds.',
  portability: 'The same data, as a machine-readable file they can take elsewhere.',
  correction: 'Fix something that is wrong or out of date, then complete the request.',
  erasure: 'Erase their personal data after a grace period. Orders and invoices stay, without tracking data, because tax law requires them.',
  withdraw_consent: 'Stop all marketing by email, SMS and WhatsApp, and record the withdrawal.',
  grievance: 'A concern about how their data is handled. Answer it, then complete the request.',
}

export const STATUS: Record<RequestStatus, { label: string; color: ChipProps['color'] }> = {
  verifying: { label: 'Awaiting confirmation', color: 'default' },
  received: { label: 'To do', color: 'warning' },
  in_progress: { label: 'In progress', color: 'info' },
  scheduled: { label: 'Erasure scheduled', color: 'secondary' },
  completed: { label: 'Completed', color: 'success' },
  rejected: { label: 'Refused', color: 'error' },
  cancelled: { label: 'Cancelled', color: 'default' },
}

export const SOURCE_LABEL: Record<PrivacyRequest['source'], string> = {
  storefront: 'Storefront form',
  account: 'Customer account',
  admin: 'Staff',
  api: 'API',
}

export const METHOD_LABEL: Record<ConsentMethod, string> = {
  accept_all: 'Accepted all',
  reject_all: 'Rejected all',
  custom: 'Chose preferences',
  opt_out_page: 'Privacy choices page',
  gpc: 'Global Privacy Control',
  api: 'Theme or app',
  account: 'Customer account',
}
