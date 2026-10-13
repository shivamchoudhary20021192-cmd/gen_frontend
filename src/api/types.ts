/** Mirrors the API response shapes from the Veylog admin backend. */

export interface Pagination {
  total: number
  page: number
  limit: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    request_id: string
    details?: Record<string, string[]> | Record<string, unknown>
  }
}

// ── auth ─────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: number
  public_id: string
  email: string
  first_name: string
  last_name: string | null
  phone: string | null
  job_title: string | null
  status: 'invited' | 'active' | 'suspended' | 'disabled'
  is_super_admin: boolean
  /** What this person may do to the platform itself: operators run the console. */
  platform_role?: 'none' | 'support' | 'admin'
  mfa_enabled: boolean
  avatar_media_id: number | null
  timezone: string
  last_login_at: string | null
  created_at: string
  roles?: { id: number; slug: string; name: string }[]
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
  admin: AdminUser
  permissions: string[]
  must_change_password: boolean
}

export interface Role {
  id: number
  slug: string
  name: string
  description: string | null
  is_system: boolean
  level: number
  permission_count: number
  admin_count: number
}

// ── media ────────────────────────────────────────────────────────────────────
export type MediaStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'quarantined'

export interface MediaVariant {
  key: string
  format: string
  width: number
  height: number
  size_bytes: number
  url: string
}

export interface Media {
  id: number
  public_id: string
  url: string
  storage_key: string
  disk: string
  folder_id: number | null
  original_filename: string
  mime_type: string
  media_type: 'image' | 'video' | 'audio' | 'document' | 'other'
  size_bytes: number
  width: number | null
  height: number | null
  aspect_ratio: number | null
  /** Video only. */
  duration_ms: number | null
  /** Video only: the still frame extracted on upload, or null if there is none. */
  poster_url: string | null
  alt_text: string | null
  title: string | null
  caption: string | null
  focal_point: { x: number; y: number }
  dominant_color: string | null
  blurhash: string | null
  placeholder: string | null
  status: MediaStatus
  usage_count: number
  created_at: string
  variants?: MediaVariant[]
  srcset?: Record<string, string>
}

export interface MediaFolder {
  id: number
  parent_id: number | null
  name: string
  slug: string
  path: string
  depth: number
  media_count: number
}

// ── catalog ──────────────────────────────────────────────────────────────────
export interface Category {
  id: number
  parent_id: number | null
  slug: string
  name: string
  short_description: string | null
  description: string | null
  banner_media_id: number | null
  thumbnail_media_id: number | null
  path: string
  depth: number
  sort_order: number
  is_active: boolean
  show_in_menu: boolean
  /** Products filed directly in this category. */
  product_count: number
  /** ...plus everything in its sub-categories — what ?category_id= returns. */
  total_product_count: number
  children?: Category[]
}

export interface ProductVariant {
  id: number
  public_id: string
  sku: string
  /** Which option values this row is — e.g. ['monet']. */
  option_values: string[]
  barcode: string | null
  variant_title: string | null
  net_quantity: string | null
  /** "30 ml — about six weeks of nightly use". */
  size_description: string | null
  volume_ml: number | null
  weight_grams: number | null
  mrp: number
  price: number
  cost_price: number | null
  discount_active: boolean
  discount_percent: number
  sale_starts_at: string | null
  sale_ends_at: string | null
  position: number
  is_default: boolean
  status: string
  track_inventory: boolean
  allow_backorder: boolean
  low_stock_threshold: number
  max_per_order: number
  image_media_id: number | null
  inventory_quantity: number
  inventory_on_hand: number
}

export interface ProductImage {
  media_id: number
  url: string
  alt: string | null
  width: number | null
  height: number | null
  placeholder: string | null
  dominant_color: string | null
  focal_point: { x: number; y: number }
  position: number
  is_primary: boolean
  status: MediaStatus
}

export interface ProductSummary {
  id: number
  public_id: string
  slug: string
  name: string
  subtitle: string | null
  status: 'draft' | 'in_review' | 'active' | 'archived'
  visibility: string
  product_type: string
  category: { id: number; name?: string | null; slug?: string | null } | null
  is_new: boolean
  is_bestseller: boolean
  badge: string | null
  /** When a hand-written badge stops being shown. Null means it never does. */
  badge_expires_at: string | null
  min_price: number | null
  max_price: number | null
  in_stock: boolean
  inventory_quantity: number
  variant_count: number
  image_count: number
  primary_image: { url: string; alt: string | null } | null
  rating_average: number
  review_count: number
  total_sold: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductOptionValue {
  id: number
  value: string
  /** 'shimmery apricot' — the line beside the name. */
  descriptor: string | null
  /** 'limited edition', 'new'. */
  badge: string | null
  description: string | null
  swatch_hex: string | null
  swatch_media_id: number | null
  swatch: string | null
  is_active: boolean
  position: number
  /** Derived from stock, never stored. */
  is_sold_out: boolean
  /** The cheapest variant carrying this value. */
  price: number | null
  images: { media_id: number; url: string; alt: string | null; is_primary: boolean }[]
}

export interface ProductOption {
  id: number
  name: string
  position: number
  display_type: string
  values: ProductOptionValue[]
}

/** What the form sends back: a bare name, or a shade with its presentation. */
export interface OptionValueInput {
  value: string
  descriptor?: string | null
  badge?: string | null
  description?: string | null
  swatch_hex?: string | null
  swatch_media_id?: number | null
  is_active?: boolean
}

export interface OptionInput {
  name: string
  display_type?: 'dropdown' | 'pill' | 'swatch'
  values: (string | OptionValueInput)[]
}

export interface Product extends ProductSummary {
  /** Moved to Products (new), which owns it: this editor shows it read-only. */
  catalog_managed?: boolean
  /** The Online Store template: null for the default, or an alternate's suffix. */
  template_suffix?: string | null
  short_description: string | null
  description: string | null
  full_inci: string | null
  texture: string | null
  scent: string | null
  fragrance_disclosure: string | null
  suitability_note: string | null
  contraindications: string | null
  patch_test_note: string | null
  routine_position: string
  time_of_day: string
  compliance: {
    manufacturer_name: string | null
    marketed_by_name: string | null
    country_of_origin: string | null
    shelf_life_months: number | null
    pao_months: number | null
    storage_instructions: string | null
  }
  tax_class_id: number | null
  default_variant_id: number | null
  options: ProductOption[]
  variants: ProductVariant[]
  images: ProductImage[]
  benefits: { id: number; benefit: string; detail: string | null; benefit_kind: string }[]
  usage_steps: { id: number; step_no: number; instruction: string; time_of_day: string }[]
  skin_types: { id: number; slug: string; name: string }[]
  concerns: { id: number; slug: string; name: string; is_primary?: number }[]
  ingredients: { id: number; slug: string; name: string; role: string | null; concentration: string | null }[]
  tags: string[]
  seo: {
    meta_title: string | null
    meta_description: string | null
    canonical_url: string | null
    robots_index: number | boolean
  }
  
  // New cosmetic-specific fields (JSON from backend)
  benefits_array?: string[] | null
  skin_types_array?: string[] | null
  skin_concerns?: string[] | null
  finish?: string | null
  coverage?: string | null
  shade_family?: string | null
  formulation_type?: string | null
  ph_level?: string | null
  absorption_rate?: string | null
  key_ingredients?: Array<{ name: string; percentage?: string; purpose?: string }> | null
  ingredient_highlights?: string | null
  free_from?: string[] | null
  certifications?: Array<{ type: string; authority?: string; year?: number }> | null
  claims?: string[] | null
  is_hypoallergenic?: boolean
  is_non_comedogenic?: boolean
  pregnancy_safe?: string | null
  usage_instructions?: string | null
  application_method?: string | null
  usage_frequency?: string | null
  best_used_with?: number[] | null
  results_timeline?: string | null
  clinical_study_summary?: string | null
  has_before_after_study?: boolean
  texture_description?: string | null
  color_description?: string | null
  feel_on_skin?: string | null
  packaging_type?: string | null
  packaging_material?: string | null
  is_recyclable?: boolean
  is_refillable?: boolean
  is_eco_friendly?: boolean
  is_carbon_neutral?: boolean
  age_range?: string | null
  gender_target?: string
  is_seasonal?: boolean
  season?: string | null
  is_limited_edition?: boolean
  is_sample?: boolean
  /** Sold as a gift card: issued and emailed when paid; no delivery, tax or discounts. */
  is_gift_card?: boolean
  sample_of_product_id?: number | null
  tutorial_video_url?: string | null
  demo_video_url?: string | null
  awards?: Array<{ name: string; authority?: string; year?: number }> | null
  press_features?: Array<{ publication: string; date?: string; url?: string }> | null
}

// ── request payloads ─────────────────────────────────────────────────────────
export interface VariantInput {
  id?: number
  sku: string
  /** Which option values this variant is — e.g. ['monet'] or ['30ml','monet']. */
  option_values?: string[]
  variant_title?: string | null
  net_quantity?: string | null
  size_description?: string | null
  mrp: number
  price: number
  weight_grams?: number | null
  inventory_quantity?: number
  is_default?: boolean
  position?: number
}

export interface ProductInput {
  name: string
  slug?: string
  subtitle?: string | null
  category_id?: number | null
  status?: 'draft' | 'in_review' | 'active' | 'archived'
  short_description?: string | null
  description?: string | null
  full_inci?: string | null
  texture?: string | null
  scent?: string | null
  manufacturer_name?: string | null
  marketed_by_name?: string | null
  country_of_origin?: string
  shelf_life_months?: number | null
  pao_months?: number | null
  is_new?: boolean
  is_bestseller?: boolean
  badge?: string | null
  badge_expires_at?: string | null
  variants?: VariantInput[]
  images?: { media_id: number; alt?: string | null; position?: number; is_primary?: boolean }[]
  benefits?: { benefit: string; detail?: string | null }[]
  tags?: string[]
  seo?: {
    meta_title?: string | null
    meta_description?: string | null
  }
  
  // New cosmetic-specific fields
  benefits_array?: string[] | null
  skin_types?: string[] | null
  skin_concerns?: string[] | null
  finish?: string | null
  coverage?: 'sheer' | 'light' | 'medium' | 'full' | 'buildable' | null
  shade_family?: string | null
  formulation_type?: string | null
  ph_level?: string | null
  absorption_rate?: 'instant' | 'fast' | 'medium' | 'slow' | null
  key_ingredients?: Array<{ name: string; percentage?: string; purpose?: string }> | null
  ingredient_highlights?: string | null
  free_from?: string[] | null
  certifications?: Array<{ type: string; authority?: string; year?: number }> | null
  claims?: string[] | null
  is_hypoallergenic?: boolean
  is_non_comedogenic?: boolean
  pregnancy_safe?: 'safe' | 'consult_doctor' | 'not_recommended' | null
  usage_instructions?: string | null
  application_method?: string | null
  usage_frequency?: string | null
  best_used_with?: number[] | null
  results_timeline?: string | null
  clinical_study_summary?: string | null
  has_before_after_study?: boolean
  texture_description?: string | null
  color_description?: string | null
  feel_on_skin?: string | null
  packaging_type?: string | null
  packaging_material?: string | null
  is_recyclable?: boolean
  is_refillable?: boolean
  is_eco_friendly?: boolean
  is_carbon_neutral?: boolean
  age_range?: string | null
  gender_target?: 'unisex' | 'female' | 'male' | 'non_binary'
  is_seasonal?: boolean
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'all_year' | null
  is_limited_edition?: boolean
  is_sample?: boolean
  /** Sold as a gift card: issued and emailed when paid; no delivery, tax or discounts. */
  is_gift_card?: boolean
  sample_of_product_id?: number | null
  tutorial_video_url?: string | null
  demo_video_url?: string | null
  awards?: Array<{ name: string; authority?: string; year?: number }> | null
  press_features?: Array<{ publication: string; date?: string; url?: string }> | null
}

/**
 * Whether a stock row is out, low, healthy — or not stock-managed at all.
 *
 * Computed server-side by the same SQL expression that produces the low and
 * out-of-stock counters, so the badge in the table can never disagree with the
 * card above it. The page must not re-derive this from quantities.
 */
export type StockState = 'in_stock' | 'low' | 'out_of_stock' | 'untracked'

export interface StockItem {
  inventory_item_id: number
  variant_id: number
  location_id: number
  sku: string
  barcode: string | null
  variant_title: string | null
  product_id: number
  product_name: string
  product_status: string
  track_inventory: boolean
  allow_backorder: boolean
  low_stock_threshold: number
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  quantity_incoming: number
  safety_stock: number
  bin_location: string | null
  last_counted_at: string | null
  location_code: string
  location_name: string
  stock_state: StockState
  image: string | null
  updated_at: string
}

export interface InventoryLocation {
  id: number
  code: string
  name: string
  location_type: 'warehouse' | 'store' | '3pl' | 'virtual'
  address: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    state_code: string | null
    pincode: string | null
    country: string
  }
  gstin: string | null
  contact_name: string | null
  contact_phone: string | null
  is_default: boolean
  is_active: boolean
  fulfils_online_orders: boolean
  priority: number
  item_count: number
  total_on_hand: number
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: number
  variant_id: number
  location_id: number
  movement_type: string
  quantity_delta: number
  quantity_after: number
  reference_type: string | null
  reference_id: number | null
  batch_id: number | null
  unit_cost: number | null
  reason: string | null
  admin_user_id: number | null
  admin_name: string | null
  created_at: string
  sku: string
  variant_title: string | null
  product_name: string
  location_code: string
}

export interface InventorySummary {
  total_skus: number
  total_on_hand: number
  total_available: number
  low_stock_count: number
  out_of_stock_count: number
}

export interface ShippingRate {
  id: number
  name: string
  zone: 'local' | 'regional' | 'metro' | 'rest_of_india' | 'special' | 'all'
  /** A named shipping zone; null means the rate follows `zone`. */
  zone_id: number | null
  method: 'standard' | 'express' | 'pickup'
  min_order_amount: number
  max_order_amount: number | null
  min_weight_grams: number
  max_weight_grams: number | null
  rate: number
  free_above_amount: number | null
  eta_min_days: number
  eta_max_days: number
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface ShippingCarrier {
  id: number
  code: string
  name: string
  tracking_url_template: string | null
  api_provider: string | null
  supports_cod: boolean
  supports_reverse_pickup: boolean
  logo_media_id: number | null
  is_active: boolean
  priority: number
}

export interface CodRule {
  id: number
  name: string
  is_active: boolean
  min_order_amount: number
  max_order_amount: number | null
  cod_fee: number
  prepaid_discount_amount: number
  prepaid_discount_percent: number
  requires_otp_confirmation: boolean
  max_open_cod_orders: number
  block_if_rto_count_gte: number | null
  blocked_pincodes: string[]
  blocked_categories: string[]
  priority: number
  created_at: string
  updated_at: string
}

export interface PincodeServiceability {
  id: number
  pincode: string
  city: string | null
  district: string | null
  state: string | null
  state_code: string | null
  zone: 'local' | 'regional' | 'metro' | 'rest_of_india' | 'special'
  is_serviceable: boolean
  prepaid_available: boolean
  cod_available: boolean
  express_available: boolean
  standard_eta_min_days: number
  standard_eta_max_days: number
  express_eta_days: number | null
  default_carrier_id: number | null
  default_carrier_name: string | null
  order_cutoff_time: string | null
  notes: string | null
  source: string | null
  updated_at: string
}

export interface PaymentConfig {
  gateway: string
  cod_enabled: boolean
  capture_mode: 'automatic' | 'manual'
  razorpay_key_id: string
  has_key_secret: boolean
  razorpay_key_secret_masked: string
  has_webhook_secret: boolean
  razorpay_webhook_secret_masked: string
  test_mode: boolean
  enabled_methods: string[]
}

export interface PaymentTransaction {
  id: number
  order_id: number
  order_number: string
  gateway: string
  gateway_order_id: string | null
  gateway_payment_id: string | null
  method: string | null
  amount: number
  currency: string
  status: string
  card_network: string | null
  card_last4: string | null
  card_issuer: string | null
  upi_vpa: string | null
  bank: string | null
  wallet: string | null
  is_international: boolean
  gateway_fee: number
  gateway_tax: number
  error_code: string | null
  error_description: string | null
  authorized_at: string | null
  captured_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

export interface PaymentRefund {
  id: number
  order_id: number
  order_number: string
  payment_id: number | null
  gateway_refund_id: string | null
  amount: number
  refund_type: 'full' | 'partial'
  reason: string | null
  internal_note: string | null
  status: string
  speed: 'normal' | 'optimum' | 'instant'
  arn: string | null
  initiated_by_admin_id: number | null
  admin_name: string | null
  processed_at: string | null
  created_at: string
}

export interface PaymentWebhook {
  id: number
  gateway: string
  event_id: string
  event_type: string
  status: 'received' | 'processing' | 'processed' | 'failed' | 'ignored'
  attempts: number
  last_error: string | null
  order_id: number | null
  order_number: string | null
  payment_id: number | null
  received_at: string
  processed_at: string | null
}
