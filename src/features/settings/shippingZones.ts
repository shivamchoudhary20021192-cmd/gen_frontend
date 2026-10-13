import { countryName } from '../../lib/format'

export interface ZoneArea {
  country: string | null
  region: string | null
  postal_prefix: string | null
}

export interface ShippingZone {
  id: number
  name: string
  is_active: boolean
  areas: ZoneArea[]
  rate_count: number
}

export const zonesKey = ['shipping-zones'] as const

export function describeArea(area: ZoneArea, home: string): string {
  const parts: string[] = []
  if (area.country && area.country !== home) parts.push(countryName(area.country))
  if (area.region) parts.push(area.region)
  if (area.postal_prefix) parts.push(`postcodes ${area.postal_prefix}…`)
  return parts.join(' · ') || countryName(area.country ?? home)
}
