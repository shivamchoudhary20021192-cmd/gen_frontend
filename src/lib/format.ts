export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

/**
 * The store's money, set once the store is known (ShopProvider). Until then —
 * and for the founding Indian store — rupees, as the admin always showed.
 */
let storeMoney = { currency: 'INR', locale: 'en-IN' }

export function configureMoney(currency: string, locale: string | null | undefined): void {
  storeMoney = { currency: currency.toUpperCase(), locale: locale || 'en' }
}

export function storeCurrency(): string {
  return storeMoney.currency
}

/**
 * An amount in the store's currency. Rupees stay whole (Indian retail prices
 * are whole rupees in practice); other currencies keep their minor units.
 */
export function formatMoney(amount: number | null | undefined): string {
  return formatMoneyIn(amount, storeMoney.currency)
}

/** An amount in a given currency — an order paid in another market's money. */
export function formatMoneyIn(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat(storeMoney.locale, {
      style: 'currency',
      currency,
      ...(currency === 'INR' ? { maximumFractionDigits: 0 } : {}),
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min === null) return '—'
  if (max === null || min === max) return formatMoney(min)
  return `${formatMoney(min)} – ${formatMoney(max)}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  // A time still to come ("next check in 6h").
  if (diffMs < -60_000) {
    const ahead = Math.round(-diffMs / 60000)
    if (ahead < 60) return `in ${ahead}m`
    if (ahead < 24 * 60) return `in ${Math.round(ahead / 60)}h`
    if (ahead < 30 * 24 * 60) return `in ${Math.round(ahead / 1440)}d`
    return formatDate(iso)
  }
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

/** "CA" → "Canada". */
export function countryName(code: string): string {
  try {
    return regionNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** "CGST 9%" stays as it is; "Sales tax" becomes "Sales tax (7.25%)". */
export function taxLineLabel(line: { name: string; rate: number }): string {
  return line.name.includes('%') ? line.name : `${line.name} (${line.rate}%)`
}
