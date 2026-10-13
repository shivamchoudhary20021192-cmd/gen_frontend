export type DomainStatus = 'pending_dns' | 'provisioning_ssl' | 'active' | 'misconfigured' | 'ssl_failed' | 'expired'

export interface DnsRecordCheck {
  type: 'CNAME' | 'A' | 'AAAA' | 'TXT' | 'CAA'
  name: string
  value: string
  purpose: string
  status: 'ok' | 'missing' | 'wrong' | 'optional'
  found: string[]
}

export interface DnsProblem {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface Domain {
  id: number
  hostname: string
  root_domain: string
  kind: 'platform' | 'custom'
  source: 'platform' | 'connected' | 'purchased' | 'transferred'
  status: DomainStatus
  is_primary: boolean
  redirect_to_primary: boolean
  pair: { id: number; hostname: string } | null
  market: { id: number; name: string } | null
  locale: string | null
  ownership: { verified: boolean; method: string | null }
  certificate: { status: 'none' | 'pending' | 'active' | 'failed'; issuer: string | null; expires_at: string | null }
  reason: string | null
  dns: { records: DnsRecordCheck[]; problems: DnsProblem[]; checked_at: string | null; resolvers: { name: string; ok: boolean }[] } | null
  last_checked_at: string | null
  next_check_at: string | null
  created_at: string
}

export interface Registration {
  id: number
  domain: string
  registrar: string
  kind: 'registration' | 'transfer'
  status: 'pending' | 'transferring' | 'active' | 'expired' | 'transferred_out' | 'failed'
  auto_renew: boolean
  privacy: boolean
  registered_at: string | null
  expires_at: string | null
  renewal: { amount: number; currency: string }
  last_error: string | null
}

export interface DomainsResponse {
  domains: Domain[]
  registrations: Registration[]
  edge: { provider: string; addresses: { ipv4: string[]; ipv6: string[] } }
}

export interface DomainEvent {
  id: number
  event: string
  from: string | null
  to: string | null
  detail: Record<string, unknown> | null
  at: string
}

export interface DomainDetail {
  domain: Domain
  events: DomainEvent[]
}

export interface DomainOffer {
  domain: string
  available: boolean
  premium: boolean
  price: { amount: number; currency: string }
  renewal: { amount: number; currency: string }
}

export const domainKeys = {
  all: ['domains'] as const,
  one: (id: number) => ['domains', id] as const,
  search: (q: string) => ['domains', 'search', q] as const,
}

/** "hi" → "Hindi", for labels; the code itself if the browser does not know it. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

/** A domain that is one language's home for every market (fr.example.com): it serves, never redirects. */
export function isLanguageDomain(domain: Pick<Domain, 'market' | 'locale' | 'redirect_to_primary' | 'is_primary'>): boolean {
  return !domain.is_primary && !domain.market && Boolean(domain.locale) && !domain.redirect_to_primary
}

export const STATUS: Record<DomainStatus, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default'; hint: string }> = {
  pending_dns: { label: 'Waiting for DNS', color: 'warning', hint: 'Add the DNS records at your domain provider.' },
  provisioning_ssl: { label: 'Securing', color: 'info', hint: 'DNS is set. Issuing the SSL certificate — usually a few minutes.' },
  active: { label: 'Connected', color: 'success', hint: 'Live and secure.' },
  misconfigured: { label: 'Needs attention', color: 'error', hint: 'Its DNS no longer points to your store.' },
  ssl_failed: { label: 'Certificate problem', color: 'error', hint: 'The SSL certificate could not be issued.' },
  expired: { label: 'Not checking', color: 'default', hint: 'DNS was not set up within 14 days. Verify to try again.' },
}
