import type { FieldType } from './types'

/** What the field editors share about types: units, reference kinds, keys and labels. */

export const MEASUREMENT_UNITS: Record<string, string[]> = {
  weight: ['g', 'kg', 'mg', 'oz', 'lb'],
  volume: ['ml', 'l', 'cl', 'm3', 'fl_oz', 'gal'],
  dimension: ['cm', 'mm', 'm', 'in', 'ft', 'yd'],
}

export const REFERENCE_KIND: Record<string, string> = {
  product_reference: 'product',
  variant_reference: 'variant',
  collection_reference: 'collection',
  file_reference: 'file',
  metaobject_reference: 'metaobject',
  page_reference: 'page',
}

export function parseFieldType(type: string): { base: string; list: boolean } {
  return type.startsWith('list.') ? { base: type.slice(5), list: true } : { base: type, list: false }
}

/** Turns "Care instructions" into "care_instructions" — a field's key, as Shopify makes it. */
export function keyFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

export function typeLabel(type: string, types: FieldType[] | undefined): string {
  const { base, list } = parseFieldType(type)
  const label = types?.find((item) => item.type === base)?.label ?? base
  return list ? `List of ${label.toLowerCase()}` : label
}
