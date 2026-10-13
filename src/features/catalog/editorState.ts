import type { CatalogProduct, CatalogStatus, Category, Definition, DisplayStyle, ProductMedia, StockLevel, Variant } from './types'

/**
 * The product editor's working copy.
 *
 * Option values carry a local key, and a variant names its values by key, not
 * by name: renaming "Red" to "Crimson" is then one edit that every variant
 * follows, and the save sends each variant's id with its (new) value names —
 * which the API matches by id, so the variant, its stock and its orders stay.
 */

let counter = 0
export const newKey = () => `k${++counter}`

export interface FormValue {
  key: string
  id: number | null
  name: string
  swatch_color: string | null
  swatch_media_id: number | null
  swatch_url: string | null
  linked_metaobject_id: number | null
}

export interface FormOption {
  key: string
  id: number | null
  name: string
  display_style: DisplayStyle
  linked_metaobject_type: string | null
  values: FormValue[]
}

export type VariantFields = Omit<Variant, 'id' | 'public_id' | 'position' | 'title' | 'option_values' | 'inventory' | 'metafields'>

export interface FormVariant extends VariantFields {
  key: string
  id: number | null
  valueKeys: string[]
  /** On hand per location as loaded or edited; sent only when `stockDirty`. */
  stock: Record<number, number>
  available: number
  levels: StockLevel[]
  stockDirty: boolean
  metafields: Record<string, unknown>
}

export interface FormState {
  title: string
  handle: string
  description_html: string
  summary: string
  status: CatalogStatus
  vendor: string
  product_type: string
  category: Category | null
  template_suffix: string
  seo_title: string
  seo_description: string
  is_gift_card: boolean
  media: ProductMedia[]
  tags: string[]
  collection_ids: number[]
  metafields: Record<string, unknown>
  options: FormOption[]
  variants: FormVariant[]
}

export const VARIANT_DEFAULTS: VariantFields = {
  sku: null,
  barcode: null,
  price: 0,
  compare_at_price: null,
  cost: null,
  taxable: true,
  tax_class_id: null,
  hsn_code: null,
  inventory_tracked: true,
  inventory_policy: 'deny',
  requires_shipping: true,
  weight: null,
  weight_unit: 'g',
  length: null,
  width: null,
  height: null,
  dimension_unit: 'cm',
  origin_country: null,
  hs_code: null,
  unit_price: null,
  media_id: null,
  max_per_order: null,
}

const fieldsOf = (variant: Variant): VariantFields => {
  const out = { ...VARIANT_DEFAULTS } as Record<string, unknown>
  for (const key of Object.keys(VARIANT_DEFAULTS)) out[key] = (variant as unknown as Record<string, unknown>)[key]
  return out as unknown as VariantFields
}

const byFullKey = (fields: { namespace: string; key: string; value: unknown }[]) => Object.fromEntries(fields.map((field) => [`${field.namespace}.${field.key}`, field.value]))

export function blankVariant(valueKeys: string[] = [], from?: Partial<VariantFields>): FormVariant {
  return {
    ...VARIANT_DEFAULTS,
    ...(from ? { price: from.price ?? 0, compare_at_price: from.compare_at_price ?? null, cost: from.cost ?? null, weight: from.weight ?? null, weight_unit: from.weight_unit ?? 'g', requires_shipping: from.requires_shipping ?? true, inventory_tracked: from.inventory_tracked ?? true, tax_class_id: from.tax_class_id ?? null, hsn_code: from.hsn_code ?? null } : {}),
    key: newKey(),
    id: null,
    valueKeys,
    stock: {},
    available: 0,
    levels: [],
    stockDirty: false,
    metafields: {},
  }
}

export function emptyForm(): FormState {
  return {
    title: '',
    handle: '',
    description_html: '',
    summary: '',
    status: 'draft',
    vendor: '',
    product_type: '',
    category: null,
    template_suffix: '',
    seo_title: '',
    seo_description: '',
    is_gift_card: false,
    media: [],
    tags: [],
    collection_ids: [],
    metafields: {},
    options: [],
    variants: [blankVariant()],
  }
}

export function formFromProduct(product: CatalogProduct): FormState {
  const options: FormOption[] = product.options.map((option) => ({
    key: newKey(),
    id: option.id ?? null,
    name: option.name,
    display_style: option.display_style ?? 'buttons',
    linked_metaobject_type: option.linked_metaobject_type ?? null,
    values: option.values.map((value) => ({
      key: newKey(),
      id: value.id ?? null,
      name: value.name,
      swatch_color: value.swatch_color ?? null,
      swatch_media_id: value.swatch_media_id ?? null,
      swatch_url: value.swatch_url ?? null,
      linked_metaobject_id: value.linked_metaobject_id ?? null,
    })),
  }))
  return {
    title: product.title,
    handle: product.handle,
    description_html: product.description_html,
    summary: product.summary ?? '',
    status: product.status,
    vendor: product.vendor ?? '',
    product_type: product.product_type ?? '',
    category: product.category,
    template_suffix: product.template_suffix ?? '',
    seo_title: product.seo.title ?? '',
    seo_description: product.seo.description ?? '',
    is_gift_card: product.is_gift_card,
    media: product.media,
    tags: product.tags,
    collection_ids: product.collections.filter((collection) => collection.editable_here).map((collection) => collection.id),
    metafields: byFullKey(product.metafields),
    options,
    variants: product.variants.map((variant) => ({
      ...fieldsOf(variant),
      key: newKey(),
      id: variant.id ?? null,
      valueKeys: variant.option_values.map((name, index) => options[index]?.values.find((value) => value.name.toLowerCase() === name.toLowerCase())?.key ?? ''),
      stock: Object.fromEntries((variant.inventory?.levels ?? []).map((level) => [level.location_id, level.on_hand])),
      available: variant.inventory?.available ?? 0,
      levels: variant.inventory?.levels ?? [],
      stockDirty: false,
      metafields: byFullKey(variant.metafields),
    })),
  }
}

export function variantTitle(form: Pick<FormState, 'options'>, variant: Pick<FormVariant, 'valueKeys'>): string {
  if (variant.valueKeys.length === 0) return 'Default'
  return variant.valueKeys.map((key, index) => form.options[index]?.values.find((value) => value.key === key)?.name || '…').join(' / ')
}

/** Every combination of the options' values, as value keys. */
export function combinations(options: FormOption[]): string[][] {
  return options.reduce<string[][]>((rows, option) => rows.flatMap((row) => option.values.map((value) => [...row, value.key])), [[]])
}

export function missingCombinations(form: FormState): string[][] {
  const have = new Set(form.variants.map((variant) => variant.valueKeys.join('|')))
  return combinations(form.options).filter((combo) => !have.has(combo.join('|')))
}

// ── option edits, each keeping the variants in step ──────────────────────────

export function addOption(form: FormState): FormState {
  const value: FormValue = { key: newKey(), id: null, name: '', swatch_color: null, swatch_media_id: null, swatch_url: null, linked_metaobject_id: null }
  const option: FormOption = { key: newKey(), id: null, name: '', display_style: 'buttons', linked_metaobject_type: null, values: [value] }
  return { ...form, options: [...form.options, option], variants: form.variants.map((variant) => ({ ...variant, valueKeys: [...variant.valueKeys, value.key] })) }
}

export function removeOption(form: FormState, index: number): FormState {
  const seen = new Set<string>()
  const variants = form.variants
    .map((variant) => ({ ...variant, valueKeys: variant.valueKeys.filter((_, at) => at !== index) }))
    .filter((variant) => {
      const combo = variant.valueKeys.join('|')
      if (seen.has(combo)) return false
      seen.add(combo)
      return true
    })
  return { ...form, options: form.options.filter((_, at) => at !== index), variants: variants.length ? variants : [blankVariant()] }
}

export function addValue(form: FormState, optionIndex: number, name = ''): FormState {
  const value: FormValue = { key: newKey(), id: null, name, swatch_color: null, swatch_media_id: null, swatch_url: null, linked_metaobject_id: null }
  const options = form.options.map((option, at) => (at === optionIndex ? { ...option, values: [...option.values, value] } : option))
  // One new variant per combination of the other options' values that exist today.
  const template = form.variants[0]
  const others = new Map<string, string[]>()
  for (const variant of form.variants) {
    const rest = variant.valueKeys.map((key, at) => (at === optionIndex ? value.key : key))
    others.set(rest.join('|'), rest)
  }
  const added = [...others.values()].map((valueKeys) => blankVariant(valueKeys, template))
  return { ...form, options, variants: [...form.variants, ...added] }
}

export function removeValue(form: FormState, optionIndex: number, valueKey: string): FormState {
  const options = form.options.map((option, at) => (at === optionIndex ? { ...option, values: option.values.filter((value) => value.key !== valueKey) } : option))
  return { ...form, options, variants: form.variants.filter((variant) => variant.valueKeys[optionIndex] !== valueKey) }
}

// ── the save ─────────────────────────────────────────────────────────────────

const blankToNull = (text: string) => (text.trim() ? text.trim() : null)

export function payloadOf(form: FormState, version: number | null, definitions: { product: Definition[]; variant: Definition[] }) {
  const fieldsOut = (values: Record<string, unknown>, defs: Definition[]) =>
    defs.filter((definition) => definition.full_key in values).map((definition) => ({ namespace: definition.namespace, key: definition.key, value: values[definition.full_key] ?? null }))

  return {
    ...(version !== null ? { version } : {}),
    title: form.title,
    handle: blankToNull(form.handle) ?? undefined,
    description_html: form.description_html,
    summary: blankToNull(form.summary),
    status: form.status,
    vendor: blankToNull(form.vendor),
    product_type: blankToNull(form.product_type),
    category_code: form.category?.code ?? null,
    template_suffix: blankToNull(form.template_suffix),
    seo: { title: blankToNull(form.seo_title), description: blankToNull(form.seo_description) },
    is_gift_card: form.is_gift_card,
    media: form.media.map((item) => ({ media_id: item.media_id, alt: item.alt })),
    tags: form.tags,
    collection_ids: form.collection_ids,
    metafields: fieldsOut(form.metafields, definitions.product),
    options: form.options.map((option) => ({
      id: option.id,
      name: option.name,
      display_style: option.display_style,
      linked_metaobject_type: option.linked_metaobject_type,
      values: option.values.map((value) => ({ id: value.id, name: value.name, swatch_color: value.swatch_color, swatch_media_id: value.swatch_media_id, linked_metaobject_id: value.linked_metaobject_id })),
    })),
    variants: form.variants.map((variant) => {
      const { valueKeys, stock, stockDirty, metafields } = variant
      const fields = Object.fromEntries(Object.keys(VARIANT_DEFAULTS).map((key) => [key, variant[key as keyof VariantFields]])) as unknown as VariantFields
      return {
        ...fields,
        id: variant.id,
        sku: fields.sku?.trim() || null,
        barcode: fields.barcode?.trim() || null,
        option_values: valueKeys.map((key, index) => form.options[index]?.values.find((value) => value.key === key)?.name ?? ''),
        ...(stockDirty ? { inventory: Object.entries(stock).map(([location_id, on_hand]) => ({ location_id: Number(location_id), on_hand: Number(on_hand) || 0 })) } : {}),
        metafields: fieldsOut(metafields, definitions.variant),
      }
    }),
  }
}
