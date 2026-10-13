/** Products (new) — the shapes /admin/api/v1/catalog answers with. */

export type CatalogStatus = 'draft' | 'active' | 'unlisted' | 'archived'
export type DisplayStyle = 'dropdown' | 'buttons' | 'swatches'

export interface Category {
  code: string
  name: string
  full_name: string
  parent_code?: string | null
  level?: number
  is_leaf?: boolean
}

export interface CatalogListItem {
  id: number
  handle: string
  title: string
  status: CatalogStatus
  vendor: string | null
  product_type: string | null
  category: Category | null
  image: string | null
  option_count: number
  variant_count: number
  price_min: number | null
  price_max: number | null
  inventory: { tracked_variants: number; available: number }
  origin: 'native' | 'classic'
  updated_at: string
  created_at: string
}

export interface CatalogList {
  products: CatalogListItem[]
  next: string | null
  total: number | null
  counts: Record<'all' | CatalogStatus, number> | null
}

export interface OptionValue {
  id?: number | null
  name: string
  position?: number
  swatch_color?: string | null
  swatch_media_id?: number | null
  swatch_url?: string | null
  linked_metaobject_id?: number | null
}

export interface Option {
  id?: number | null
  name: string
  position?: number
  display_style?: DisplayStyle
  linked_metaobject_type?: string | null
  values: OptionValue[]
}

export interface UnitPrice {
  quantity: number
  quantity_unit: string
  reference: number
  reference_unit: string
}

export interface MetafieldValue {
  definition_id?: number | null
  namespace: string
  key: string
  type?: string
  value: unknown
}

export interface StockLevel {
  location_id: number
  location_name: string
  on_hand: number
  available: number
  reserved: number
  incoming: number
}

export interface Variant {
  id?: number | null
  public_id?: string
  position?: number
  title?: string
  option_values: string[]
  sku: string | null
  barcode: string | null
  price: number
  compare_at_price: number | null
  cost: number | null
  taxable: boolean
  tax_class_id: number | null
  hsn_code: string | null
  inventory_tracked: boolean
  inventory_policy: 'deny' | 'continue'
  requires_shipping: boolean
  weight: number | null
  weight_unit: 'g' | 'kg' | 'oz' | 'lb'
  length: number | null
  width: number | null
  height: number | null
  dimension_unit: 'mm' | 'cm' | 'm' | 'in'
  origin_country: string | null
  hs_code: string | null
  unit_price: UnitPrice | null
  media_id: number | null
  max_per_order: number | null
  inventory?: { on_hand: number; available: number; levels: StockLevel[] }
  metafields: MetafieldValue[]
}

export interface ProductMedia {
  media_id: number
  position?: number
  alt: string | null
  default_alt?: string | null
  url: string | null
  media_type?: string
}

export interface CatalogProduct {
  id: number
  public_id: string
  handle: string
  title: string
  description_html: string
  summary: string | null
  status: CatalogStatus
  vendor: string | null
  product_type: string | null
  category: Category | null
  template_suffix: string | null
  seo: { title: string | null; description: string | null }
  is_gift_card: boolean
  published_at: string | null
  origin: 'native' | 'classic'
  version: number
  created_at: string
  updated_at: string
  options: Option[]
  variants: Variant[]
  media: ProductMedia[]
  tags: string[]
  collections: { id: number; title: string; type: string; editable_here: boolean }[]
  metafields: MetafieldValue[]
  locations: Location[]
}

export interface Location {
  id: number
  name: string
  is_default: boolean
}

// ── custom data ──────────────────────────────────────────────────────────────

export type OwnerType = 'product' | 'variant'

export interface Validations {
  min?: number | string | { value: number; unit: string } | null
  max?: number | string | { value: number; unit: string } | null
  regex?: string | null
  choices?: string[] | null
  max_precision?: number | null
  allowed_domains?: string[] | null
  file_types?: ('image' | 'video' | 'document')[] | null
  metaobject_type?: string | null
  scale_min?: number | null
  scale_max?: number | null
  currency_code?: string | null
  list_min?: number | null
  list_max?: number | null
}

export interface Definition {
  id: number
  owner_type: OwnerType
  namespace: string
  key: string
  full_key: string
  name: string
  description: string | null
  type: string
  validations: Validations
  constraints: { product_types?: string[]; categories?: string[] } | null
  required: boolean
  storefront: boolean
  filterable: boolean
  unique_values: boolean
  pinned: boolean
  pinned_position: number | null
  values_count?: number
}

export interface FieldType {
  type: string
  label: string
  group: 'text' | 'number' | 'date' | 'measurement' | 'reference' | 'other'
  listable: boolean
  validations: string[]
}

export interface ReferenceItem {
  id: number
  label: string
  sublabel?: string | null
  image?: string | null
  missing?: boolean
}

export interface MetaobjectField {
  key: string
  name: string
  type: string
  description: string | null
  required: boolean
  validations: Validations
}

export interface MetaobjectDefinition {
  id: number
  type: string
  name: string
  description: string | null
  display_name_key: string | null
  fields: MetaobjectField[]
  publishable: boolean
  translatable: boolean
  storefront: boolean
  entry_count: number
  updated_at: string
}

export interface MetaobjectEntry {
  id: number
  definition_id: number
  type: string
  handle: string
  display_name: string
  status: 'draft' | 'active'
  fields: Record<string, unknown>
  updated_at: string
}

/** A field as the value editor needs it — a product field and a metaobject field alike. */
export interface FieldSpec {
  name: string
  type: string
  description?: string | null
  required?: boolean
  validations: Validations
}

export const STATUS_LABEL: Record<CatalogStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  unlisted: 'Unlisted',
  archived: 'Archived',
}

export const STATUS_COLOR: Record<CatalogStatus, 'success' | 'default' | 'info' | 'warning'> = {
  active: 'success',
  draft: 'default',
  unlisted: 'info',
  archived: 'warning',
}
