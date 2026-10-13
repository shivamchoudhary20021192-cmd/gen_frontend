import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { ProductInput, VariantInput } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { ProductCollectionsCard } from './ProductCollectionsCard'
import { ProductDiscountsCard } from './ProductDiscountsCard'
import { ThemeTemplateCard } from '../merchandising/themes/ThemeTemplateCard'
import { ProductMediaCard, type SelectedImage } from './ProductMediaCard'
import { SectionsCard } from './SectionsCard'
import { ShadesCard, shadeFromValue, type ShadeDraft } from './ShadesCard'
import { VariantsCard } from './VariantsCard'
import {
  useCategories,
  useCreateProduct,
  useProduct,
  useProductAction,
  useUpdateProduct,  useSetShadeImages,
} from './useProducts'
import { useLookups, csvToLookupValues, lookupValuesToCSV } from '../../hooks/useLookups'

interface FormState {
  name: string
  subtitle: string
  short_description: string
  description: string
  full_inci: string
  texture: string
  scent: string
  manufacturer_name: string
  country_of_origin: string
  shelf_life_months: string
  pao_months: string
  category_id: number | ''
  tags: string
  meta_title: string
  meta_description: string
  
  // Product Attributes
  benefits_array: string
  skin_types: string
  skin_concerns: string
  finish: string
  coverage: string
  shade_family: string
  formulation_type: string
  ph_level: string
  absorption_rate: string
  
  // Formulation
  ingredient_highlights: string
  free_from: string
  
  // Certifications & Claims
  claims: string
  is_hypoallergenic: boolean
  is_non_comedogenic: boolean
  pregnancy_safe: string
  
  // Usage Instructions
  usage_instructions: string
  application_method: string
  usage_frequency: string
  
  // Performance
  results_timeline: string
  clinical_study_summary: string
  has_before_after_study: boolean
  
  // Sensory
  texture_description: string
  color_description: string
  feel_on_skin: string
  
  // Sustainability
  packaging_type: string
  packaging_material: string
  is_recyclable: boolean
  is_refillable: boolean
  is_eco_friendly: boolean
  is_carbon_neutral: boolean
  
  // Demographics
  age_range: string
  gender_target: string
  
  // Seasonal
  is_seasonal: boolean
  season: string
  is_limited_edition: boolean
  
  // Sample
  is_sample: boolean
  sample_of_product_id: string
  
  // Videos
  tutorial_video_url: string
  demo_video_url: string

  /**
   * The shelf tag. One of 'none' | 'new' | 'bestseller' | 'custom'.
   *
   * Held as a single choice rather than as the two booleans and the free-text
   * field the API keeps, because a product wears one tag and a form offering
   * three independent switches invites a card with three labels on it.
   */
  tag_kind: string
  tag_label: string
  tag_expires_at: string
  is_gift_card: boolean
}

/**
 * The tags a product may wear, and what each one is for.
 *
 * Deliberately a short closed list plus an escape hatch. The alternative — a
 * free-text box on every product — is how a catalogue ends up with "Bestseller",
 * "BEST SELLER" and "best-seller" all rendering differently on the same shelf.
 */
const TAG_KINDS = [
  { value: 'none', label: 'No tag', hint: 'Most products. A label on every card is a label on none.' },
  { value: 'new', label: 'New', hint: 'Shown for 45 days after the publish date, then it lapses by itself.' },
  { value: 'bestseller', label: 'Best seller', hint: 'Stays until you take it off.' },
  { value: 'custom', label: 'Something else', hint: 'Your own wording — "Limited edition", "Award winner".' },
] as const

/** The stored columns, read back as the single choice the form offers. */
function tagFieldsFrom(product: {
  is_new?: boolean
  is_bestseller?: boolean
  badge?: string | null
  badge_expires_at?: string | null
}): { tag_kind: string; tag_label: string; tag_expires_at: string } {
  const badge = (product.badge ?? '').trim()
  const spoken = badge.toLowerCase()
  const blank = { tag_label: '', tag_expires_at: '' }

  if (product.is_bestseller || spoken === 'bestseller' || spoken === 'best seller') {
    return { tag_kind: 'bestseller', ...blank }
  }
  if (product.is_new || spoken === 'new') return { tag_kind: 'new', ...blank }
  if (badge) {
    return {
      tag_kind: 'custom',
      tag_label: badge,
      // <input type="date"> wants YYYY-MM-DD and nothing else.
      tag_expires_at: product.badge_expires_at ? String(product.badge_expires_at).slice(0, 10) : '',
    }
  }
  return { tag_kind: 'none', ...blank }
}

const EMPTY: FormState = {
  name: '',
  subtitle: '',
  short_description: '',
  description: '',
  full_inci: '',
  texture: '',
  scent: '',
  manufacturer_name: '',
  country_of_origin: 'India',
  shelf_life_months: '',
  pao_months: '',
  category_id: '',
  tags: '',
  meta_title: '',
  meta_description: '',
  
  // Product Attributes
  benefits_array: '',
  skin_types: '',
  skin_concerns: '',
  finish: '',
  coverage: '',
  shade_family: '',
  formulation_type: '',
  ph_level: '',
  absorption_rate: '',
  
  // Formulation
  ingredient_highlights: '',
  free_from: '',
  
  // Certifications & Claims
  claims: '',
  is_hypoallergenic: false,
  is_non_comedogenic: false,
  pregnancy_safe: '',
  
  // Usage Instructions
  usage_instructions: '',
  application_method: '',
  usage_frequency: '',
  
  // Performance
  results_timeline: '',
  clinical_study_summary: '',
  has_before_after_study: false,
  
  // Sensory
  texture_description: '',
  color_description: '',
  feel_on_skin: '',
  
  // Sustainability
  packaging_type: '',
  packaging_material: '',
  is_recyclable: false,
  is_refillable: false,
  is_eco_friendly: false,
  is_carbon_neutral: false,
  
  // Demographics
  age_range: '',
  gender_target: 'unisex',
  
  // Seasonal
  is_seasonal: false,
  season: '',
  is_limited_edition: false,
  
  // Sample
  is_sample: false,
  sample_of_product_id: '',
  
  // Videos
  tutorial_video_url: '',
  demo_video_url: '',

  tag_kind: 'none',
  tag_label: '',
  tag_expires_at: '',
  is_gift_card: false,
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const productId = isNew ? undefined : Number(id)

  const navigate = useNavigate()
  const { can } = useAuth()
  const categories = useCategories()
  const query = useProduct(productId)
  const create = useCreateProduct()
  const update = useUpdateProduct(productId ?? 0)
  const action = useProductAction(productId ?? 0)

  // Load all lookup values for dropdowns
  const { data: lookups, isLoading: lookupsLoading } = useLookups([
    'benefits',
    'skin_types',
    'skin_concerns',
    'finish',
    'coverage',
    'shade_family',
    'formulation_type',
    'absorption_rate',
    'pregnancy_safe',
    'gender_target',
    'season',
    'free_from',
    'claims',
    'certification_type',
    'packaging_type',
    'application_method',
    'age_range',
    'usage_instructions',
    'feel_on_skin',
  ])

  const [form, setForm] = useState<FormState>(EMPTY)
  const [variants, setVariants] = useState<VariantInput[]>([
    { sku: '', variant_title: '', mrp: 0, price: 0, inventory_quantity: 0, is_default: true },
  ])
  // Shades are held beside variants rather than inside them because a shade is
  // a variant: the card owns both so the colour and the sellable row cannot
  // drift apart.
  const [shades, setShades] = useState<ShadeDraft[]>([])
  const setShadeImages = useSetShadeImages()
  const [images, setImages] = useState<SelectedImage[]>([])
  const [keyIngredients, setKeyIngredients] = useState<Array<{ name: string; percentage: string; purpose: string }>>([])
  const [certifications, setCertifications] = useState<Array<{ type: string; authority: string; year: string }>>([])
  const [awards, setAwards] = useState<Array<{ name: string; authority: string; year: string }>>([])
  const [pressFeatures, setPressFeatures] = useState<Array<{ publication: string; date: string; url: string }>>([])
  const [bestUsedWith, setBestUsedWith] = useState<number[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ severity: 'error' | 'warning'; title: string; body: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const product = query.data?.product

  useEffect(() => {
    if (!product) return
    setForm({
      name: product.name,
      subtitle: product.subtitle ?? '',
      short_description: product.short_description ?? '',
      description: product.description ?? '',
      full_inci: product.full_inci ?? '',
      texture: product.texture ?? '',
      scent: product.scent ?? '',
      manufacturer_name: product.compliance.manufacturer_name ?? '',
      country_of_origin: product.compliance.country_of_origin ?? 'India',
      shelf_life_months: product.compliance.shelf_life_months?.toString() ?? '',
      pao_months: product.compliance.pao_months?.toString() ?? '',
      category_id: product.category?.id ?? '',
      tags: product.tags.join(', '),
      meta_title: product.seo.meta_title ?? '',
      meta_description: product.seo.meta_description ?? '',
      
      // Product Attributes
      benefits_array: product.benefits_array?.join(', ') ?? '',
      skin_types: product.skin_types_array?.join(', ') ?? '',
      skin_concerns: product.skin_concerns?.join(', ') ?? '',
      finish: product.finish ?? '',
      coverage: product.coverage ?? '',
      shade_family: product.shade_family ?? '',
      formulation_type: product.formulation_type ?? '',
      ph_level: product.ph_level ?? '',
      absorption_rate: product.absorption_rate ?? '',
      
      // Formulation
      ingredient_highlights: product.ingredient_highlights ?? '',
      free_from: product.free_from?.join(', ') ?? '',
      
      // Certifications & Claims
      claims: product.claims?.join(', ') ?? '',
      is_hypoallergenic: product.is_hypoallergenic ?? false,
      is_non_comedogenic: product.is_non_comedogenic ?? false,
      pregnancy_safe: product.pregnancy_safe ?? '',
      
      // Usage Instructions
      usage_instructions: product.usage_instructions ?? '',
      application_method: product.application_method ?? '',
      usage_frequency: product.usage_frequency ?? '',
      
      // Performance
      results_timeline: product.results_timeline ?? '',
      clinical_study_summary: product.clinical_study_summary ?? '',
      has_before_after_study: product.has_before_after_study ?? false,
      
      // Sensory
      texture_description: product.texture_description ?? '',
      color_description: product.color_description ?? '',
      feel_on_skin: product.feel_on_skin ?? '',
      
      // Sustainability
      packaging_type: product.packaging_type ?? '',
      packaging_material: product.packaging_material ?? '',
      is_recyclable: product.is_recyclable ?? false,
      is_refillable: product.is_refillable ?? false,
      is_eco_friendly: product.is_eco_friendly ?? false,
      is_carbon_neutral: product.is_carbon_neutral ?? false,
      
      // Demographics
      age_range: product.age_range ?? '',
      gender_target: product.gender_target ?? 'unisex',
      
      // Seasonal
      is_seasonal: product.is_seasonal ?? false,
      season: product.season ?? '',
      is_limited_edition: product.is_limited_edition ?? false,
      
      // Sample
      is_sample: product.is_sample ?? false,
      is_gift_card: product.is_gift_card ?? false,
      sample_of_product_id: product.sample_of_product_id?.toString() ?? '',
      
      // Videos
      tutorial_video_url: product.tutorial_video_url ?? '',
      demo_video_url: product.demo_video_url ?? '',

      // The three stored fields collapsed back into the one choice the form
      // offers. A hand-typed "New" or "Bestseller" is read as that tag rather
      // than as custom wording, which is also how the storefront reads it.
      ...tagFieldsFrom(product),
    })
    const shadeOption = product.options.find((option) => option.name.toLowerCase() === 'shade')
    setShades((shadeOption?.values ?? []).map(shadeFromValue))
    setVariants(
      product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        variant_title: variant.variant_title,
        // Dropped here would mean every save silently wiped the size copy off
        // every variant the merchant did not retype.
        size_description: variant.size_description,
        mrp: variant.mrp,
        price: variant.price,
        inventory_quantity: variant.inventory_quantity,
        is_default: variant.is_default,
        // Which shade this row is, as the API reports it. The API matches
        // these by name on save, so losing them here would unlink every variant
        // from its colour.
        option_values: variant.option_values ?? [],
      })),
    )
    setImages(
      product.images.map((image) => ({
        media_id: image.media_id,
        url: image.url,
        alt: image.alt,
        is_primary: image.is_primary,
      })),
    )
    // percentage/purpose are optional on the API type but the inputs below are
    // controlled, so undefined would flip them to uncontrolled mid-edit.
    setKeyIngredients(
      (product.key_ingredients ?? []).map((ingredient) => ({
        name: ingredient.name,
        percentage: ingredient.percentage ?? '',
        purpose: ingredient.purpose ?? '',
      })),
    )
    setCertifications(
      product.certifications?.map((cert) => ({
        type: cert.type,
        authority: cert.authority ?? '',
        year: cert.year?.toString() ?? '',
      })) ?? [],
    )
    setAwards(
      product.awards?.map((award) => ({
        name: award.name,
        authority: award.authority ?? '',
        year: award.year?.toString() ?? '',
      })) ?? [],
    )
    setPressFeatures(
      product.press_features?.map((feature) => ({
        publication: feature.publication,
        date: feature.date ?? '',
        url: feature.url ?? '',
      })) ?? [],
    )
    setBestUsedWith(product.best_used_with ?? [])
  }, [product])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const payload = useMemo<ProductInput>(
    () => ({
      name: form.name.trim(),
      subtitle: form.subtitle.trim() || null,
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      full_inci: form.full_inci.trim() || null,
      texture: form.texture.trim() || null,
      scent: form.scent.trim() || null,
      manufacturer_name: form.manufacturer_name.trim() || null,
      country_of_origin: form.country_of_origin.trim() || 'India',
      shelf_life_months: form.shelf_life_months ? Number(form.shelf_life_months) : null,
      pao_months: form.pao_months ? Number(form.pao_months) : null,
      category_id: form.category_id === '' ? null : form.category_id,
      variants: variants.map((variant, index) => ({ ...variant, position: index })),
      // Only sent when there are shades: an empty array would wipe the Size
      // option off a product that has one and no colours.
      ...(shades.length > 0
        ? {
            options: [
              {
                name: 'Shade',
                display_type: 'swatch' as const,
                values: shades.map((shade) => ({
                  value: shade.value.trim(),
                  descriptor: shade.descriptor.trim() || null,
                  badge: shade.badge.trim() || null,
                  swatch_hex: shade.swatch_hex || null,
                  is_active: shade.is_active,
                })),
              },
            ],
          }
        : {}),
      images: images.map((image, index) => ({
        media_id: image.media_id,
        position: index,
        is_primary: index === 0,
      })),
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      seo: {
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
      },
      
      // Product Attributes
      benefits_array: form.benefits_array
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean) || null,
      skin_types: form.skin_types
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) || null,
      skin_concerns: form.skin_concerns
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) || null,
      finish: form.finish.trim() || null,
      coverage: form.coverage ? (form.coverage as any) : null,
      shade_family: form.shade_family.trim() || null,
      formulation_type: form.formulation_type.trim() || null,
      ph_level: form.ph_level.trim() || null,
      absorption_rate: form.absorption_rate ? (form.absorption_rate as any) : null,
      
      // Formulation
      key_ingredients: keyIngredients.length > 0 ? keyIngredients : null,
      ingredient_highlights: form.ingredient_highlights.trim() || null,
      free_from: form.free_from
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean) || null,
      
      // Certifications & Claims
      certifications: certifications.length > 0 ? certifications.map(c => ({
        type: c.type,
        authority: c.authority || undefined,
        year: c.year ? Number(c.year) : undefined,
      })) : null,
      claims: form.claims
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean) || null,
      is_hypoallergenic: form.is_hypoallergenic,
      is_non_comedogenic: form.is_non_comedogenic,
      pregnancy_safe: form.pregnancy_safe ? (form.pregnancy_safe as any) : null,
      
      // Usage Instructions
      usage_instructions: form.usage_instructions.trim() || null,
      application_method: form.application_method.trim() || null,
      usage_frequency: form.usage_frequency.trim() || null,
      best_used_with: bestUsedWith.length > 0 ? bestUsedWith : null,
      
      // Performance
      results_timeline: form.results_timeline.trim() || null,
      clinical_study_summary: form.clinical_study_summary.trim() || null,
      has_before_after_study: form.has_before_after_study,
      
      // Sensory
      texture_description: form.texture_description.trim() || null,
      color_description: form.color_description.trim() || null,
      feel_on_skin: form.feel_on_skin.trim() || null,
      
      // Sustainability
      packaging_type: form.packaging_type.trim() || null,
      packaging_material: form.packaging_material.trim() || null,
      is_recyclable: form.is_recyclable,
      is_refillable: form.is_refillable,
      is_eco_friendly: form.is_eco_friendly,
      is_carbon_neutral: form.is_carbon_neutral,
      
      // Demographics
      age_range: form.age_range.trim() || null,
      gender_target: form.gender_target as any,
      
      // Seasonal
      is_seasonal: form.is_seasonal,
      season: form.season ? (form.season as any) : null,
      is_limited_edition: form.is_limited_edition,
      
      // Sample
      is_sample: form.is_sample,
      is_gift_card: form.is_gift_card,
      sample_of_product_id: form.sample_of_product_id ? Number(form.sample_of_product_id) : null,
      
      // Videos
      tutorial_video_url: form.tutorial_video_url.trim() || null,
      demo_video_url: form.demo_video_url.trim() || null,

      // One choice out to the three columns the catalogue keeps. Choosing a tag
      // clears the others, so a product cannot be silently flagged twice.
      is_new: form.tag_kind === 'new',
      is_bestseller: form.tag_kind === 'bestseller',
      badge: form.tag_kind === 'custom' ? form.tag_label.trim() || null : null,
      badge_expires_at:
        form.tag_kind === 'custom' && form.tag_expires_at ? new Date(form.tag_expires_at).toISOString() : null,
      
      // Awards & Press
      awards: awards.length > 0 ? awards.map(a => ({
        name: a.name,
        authority: a.authority || undefined,
        year: a.year ? Number(a.year) : undefined,
      })) : null,
      press_features: pressFeatures.length > 0 ? pressFeatures.map(p => ({
        publication: p.publication,
        date: p.date || undefined,
        url: p.url || undefined,
      })) : null,
    }),
    // `shades` belongs here. Without it the memo only recomputed when something
    // else changed, so typing a descriptor never reached the saved payload —
    // the shade's name survived (adding one also changes `variants`) and every
    // edit after that was silently dropped.
    [
      form,
      variants,
      shades,
      images,
      keyIngredients,
      certifications,
      awards,
      pressFeatures,
      bestUsedWith,
    ],
  )

  const handleApiError = (error: unknown, fallbackTitle: string) => {
    if (error instanceof ApiError) {
      setFieldErrors(error.fieldErrors())
      setBanner({
        severity: error.status === 422 ? 'warning' : 'error',
        title: fallbackTitle,
        body: error.message,
      })
    } else {
      setBanner({ severity: 'error', title: fallbackTitle, body: 'Unexpected error.' })
    }
  }

  const save = () => {
    setFieldErrors({})
    setBanner(null)
    if (isNew) {
      create.mutate(payload, {
        onSuccess: (_data) => {
          setToast('Product created.')
          // Navigate to products listing after successful creation
          navigate('/products')
        },
        onError: (error) => handleApiError(error, 'Could not create the product'),
      })
    } else {
      update.mutate(payload, {
        onSuccess: () => {
          setToast('Changes saved.')
          // Navigate to products listing after successful update
          navigate('/products')
        },
        onError: (error) => handleApiError(error, 'Could not save changes'),
      })
    }
  }

  const runAction = (name: 'publish' | 'unpublish' | 'archive' | 'duplicate') => {
    setBanner(null)
    action.mutate(name, {
      onSuccess: (data) => {
        if (name === 'duplicate') {
          navigate(`/products/${data.product.id}`)
          setToast('Duplicated as a draft.')
        } else {
          setToast(`Product ${name === 'publish' ? 'published' : name === 'unpublish' ? 'moved to draft' : 'archived'}.`)
        }
      },
      onError: (error) => {
        // The publish gate returns 422 with the exact list of what's missing.
        // Showing it verbatim beats any message we could invent here.
        handleApiError(error, 'Cannot publish yet')
      },
    })
  }

  if (!isNew && query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  if (lookupsLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
        <Typography variant="caption" sx={{ mt: 2 }}>Loading dropdowns...</Typography>
      </Box>
    )
  }

  if (!isNew && query.isError) {
    return <Alert severity="error">Could not load this product.</Alert>
  }

  const saving = create.isPending || update.isPending
  const catalogManaged = Boolean(product?.catalog_managed)
  const readOnly = !can(isNew ? 'products.create' : 'products.update') || catalogManaged

  return (
    <Box>
      <PageHeader
        back={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/products')}
            sx={{ mb: 1, ml: -1 }}
          >
            Products
          </Button>
        }
        title={isNew ? 'New product' : (product?.name ?? 'Product')}
        subtitle={product ? `/${product.slug}` : 'Draft until you publish it'}
        actions={
          <>
            {!isNew && product && !catalogManaged && can('products.publish') && (
              <Button
                variant="outlined"
                onClick={() => runAction(product.status === 'active' ? 'unpublish' : 'publish')}
                disabled={action.isPending}
              >
                {product.status === 'active' ? 'Unpublish' : 'Publish'}
              </Button>
            )}
            <Button variant="contained" onClick={save} disabled={saving || readOnly}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      {catalogManaged && product && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/catalog/products/${product.id}`)}>
              Open in Products (new)
            </Button>
          }
        >
          <AlertTitle>This product is managed in Products (new)</AlertTitle>
          It was moved there, and is edited there from now on. This page shows it read-only.
        </Alert>
      )}

      {banner && (
        <Alert severity={banner.severity} sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          <AlertTitle>{banner.title}</AlertTitle>
          {banner.body}
          {Object.keys(fieldErrors).length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {Object.entries(fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <Typography variant="body2">{message}</Typography>
                </li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Product name"
                    placeholder="Radiance Vitamin C Serum"
                    value={form.name}
                    onChange={(event) => set('name', event.target.value)}
                    error={Boolean(fieldErrors.name)}
                    helperText={fieldErrors.name}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Subtitle"
                    value={form.subtitle}
                    onChange={(event) => set('subtitle', event.target.value)}
                    placeholder="One-line functional descriptor"
                    fullWidth
                  />
                  <TextField
                    label="Short description"
                    placeholder="A lightweight daily serum that brightens dull skin in four weeks."
                    value={form.short_description}
                    onChange={(event) => set('short_description', event.target.value)}
                    multiline
                    minRows={2}
                    helperText="30–60 words. Required before you can publish."
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    placeholder="The full product story — texture, results, who it suits, how to layer it."
                    value={form.description}
                    onChange={(event) => set('description', event.target.value)}
                    multiline
                    minRows={5}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <ProductMediaCard images={images} onChange={setImages} />

            <ShadesCard
              shades={shades}
              onChange={setShades}
              variants={variants}
              onVariantsChange={setVariants}
              onManageImages={(shade) => {
                // Saved straight away rather than with the form: a photograph
                // attaches to a shade that already exists, and holding it until
                // the next Save would lose it if the person navigated away.
                if (!shade.id || !id) return
                void setShadeImages.mutateAsync({
                  productId: Number(id),
                  optionValueId: shade.id,
                  mediaIds: (shade.images ?? []).map((image) => image.media_id),
                })
              }}
            />

            <VariantsCard variants={variants} onChange={setVariants} errors={fieldErrors} />

            <SectionsCard productId={productId} />

            <Card>
              <CardHeader
                title="Gift card"
                subheader="Sell this product as a gift card: each variant's price is a denomination."
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <FormControlLabel
                  control={<Switch checked={form.is_gift_card} onChange={(event) => set('is_gift_card', event.target.checked)} />}
                  label="This product is a gift card"
                />
                {form.is_gift_card && (
                  <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                    When an order with it is paid, a gift card worth the price paid is issued and sent to the customer for each one bought. It needs no delivery, carries no tax (tax applies when the card is spent), is not discounted, and is paid online — gift cards cannot buy gift cards.
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Shelf tag"
                subheader="The small label on the product card. One per product, and only where it earns its place."
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Tag"
                    value={form.tag_kind}
                    onChange={(event) => set('tag_kind', event.target.value)}
                    helperText={TAG_KINDS.find((kind) => kind.value === form.tag_kind)?.hint}
                    fullWidth
                  >
                    {TAG_KINDS.map((kind) => (
                      <MenuItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  {form.tag_kind === 'custom' && (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 7 }}>
                        <TextField
                          label="Wording"
                          placeholder="Limited edition"
                          value={form.tag_label}
                          onChange={(event) => set('tag_label', event.target.value)}
                          helperText="Two or three words. It is drawn in capitals on the card."
                          slotProps={{ htmlInput: { maxLength: 60 } }}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                          type="date"
                          label="Ends on"
                          value={form.tag_expires_at}
                          onChange={(event) => set('tag_expires_at', event.target.value)}
                          helperText="Optional. After this date the tag stops showing on its own."
                          slotProps={{ inputLabel: { shrink: true } }}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  )}

                  <Alert severity="info" variant="outlined">
                    New lapses 45 days after the product was published, whether or not anyone
                    remembers to come back — a storefront claiming a six-month-old launch is new is
                    the fastest way to stop being believed. Best seller and your own wording stay
                    until you change them, unless you give the wording an end date.
                  </Alert>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Formulation & compliance"
                subheader="Required on the label and before publishing."
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Full INCI"
                    placeholder="Aqua, Ascorbic Acid (10%), Glycerin, Niacinamide, Phenoxyethanol"
                    value={form.full_inci}
                    onChange={(event) => set('full_inci', event.target.value)}
                    multiline
                    minRows={3}
                    helperText="Exactly as legally approved. Required before you can publish."
                    error={Boolean(fieldErrors.product)}
                    fullWidth
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Texture"
                      placeholder="Lightweight gel"
                        value={form.texture}
                        onChange={(event) => set('texture', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Scent"
                        value={form.scent}
                        onChange={(event) => set('scent', event.target.value)}
                        placeholder="Fragrance-free"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Manufacturer / marketer"
                      placeholder="Veylor Labs Pvt Ltd"
                        value={form.manufacturer_name}
                        onChange={(event) => set('manufacturer_name', event.target.value)}
                        helperText="Required before you can publish."
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Country of origin"
                      placeholder="India"
                        value={form.country_of_origin}
                        onChange={(event) => set('country_of_origin', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        label="Shelf life (months)"
                      placeholder="24"
                        type="number"
                        value={form.shelf_life_months}
                        onChange={(event) => set('shelf_life_months', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        label="PAO (months)"
                      placeholder="6"
                        type="number"
                        value={form.pao_months}
                        onChange={(event) => set('pao_months', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Product Attributes"
                subheader="Cosmetic-specific attributes for filtering and recommendations"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  {/* Benefits Multi-Select */}
                  <Autocomplete
                    multiple
                    options={lookups?.benefits || []}
                    getOptionLabel={(option) => option.label}
                    value={csvToLookupValues(form.benefits_array, lookups?.benefits)}
                    onChange={(_e, values) => {
                      set('benefits_array', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Benefits"
                        placeholder="Select benefits"
                        helperText="Choose one or more benefits"
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        // v9 returns `key` inside the item props, and React 19
                        // warns when a key is spread rather than passed.
                        const { key, ...itemProps } = getItemProps({ index })
                        return <Chip key={key} label={option.label} {...itemProps} />
                      })
                    }
                    fullWidth
                  />

                  {/* Skin Types Multi-Select */}
                  <Autocomplete
                    multiple
                    options={lookups?.skin_types || []}
                    getOptionLabel={(option) => option.label}
                    value={csvToLookupValues(form.skin_types, lookups?.skin_types)}
                    onChange={(_e, values) => {
                      set('skin_types', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Skin Types"
                        placeholder="Select skin types"
                        helperText="Choose suitable skin types"
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        const { key, ...itemProps } = getItemProps({ index })
                        return (
                          <Chip
                            key={key}
                            label={option.label}
                            {...itemProps}
                            style={{ backgroundColor: option.color || undefined }}
                          />
                        )
                      })
                    }
                    fullWidth
                  />

                  {/* Skin Concerns Multi-Select */}
                  <Autocomplete
                    multiple
                    options={lookups?.skin_concerns || []}
                    getOptionLabel={(option) => option.label}
                    value={csvToLookupValues(form.skin_concerns, lookups?.skin_concerns)}
                    onChange={(_e, values) => {
                      set('skin_concerns', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Skin Concerns"
                        placeholder="Select skin concerns"
                        helperText="Choose addressed concerns"
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        // v9 returns `key` inside the item props, and React 19
                        // warns when a key is spread rather than passed.
                        const { key, ...itemProps } = getItemProps({ index })
                        return <Chip key={key} label={option.label} {...itemProps} />
                      })
                    }
                    fullWidth
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Finish"
                        value={form.finish}
                        onChange={(event) => set('finish', event.target.value)}
                        fullWidth
                      >
                        <MenuItem value="">Not specified</MenuItem>
                        {(lookups?.finish || []).map((option) => (
                          <MenuItem key={option.id} value={option.code}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Coverage"
                        value={form.coverage}
                        onChange={(event) => set('coverage', event.target.value)}
                        fullWidth
                      >
                        <MenuItem value="">Not specified</MenuItem>
                        {(lookups?.coverage || []).map((option) => (
                          <MenuItem key={option.id} value={option.code}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        options={lookups?.shade_family || []}
                        getOptionLabel={(option) => option.label}
                        value={lookups?.shade_family?.find(o => o.code === form.shade_family) || null}
                        onChange={(_e, value) => set('shade_family', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Shade Family" placeholder="Select shade family" />
                        )}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        options={lookups?.formulation_type || []}
                        getOptionLabel={(option) => option.label}
                        value={lookups?.formulation_type?.find(o => o.code === form.formulation_type) || null}
                        onChange={(_e, value) => set('formulation_type', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Formulation Type" placeholder="Select formulation" />
                        )}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="pH Level"
                        placeholder="5.0-6.0"
                        value={form.ph_level}
                        onChange={(event) => set('ph_level', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Absorption Rate"
                        value={form.absorption_rate}
                        onChange={(event) => set('absorption_rate', event.target.value)}
                        fullWidth
                      >
                        <MenuItem value="">Not specified</MenuItem>
                        {(lookups?.absorption_rate || []).map((option) => (
                          <MenuItem key={option.id} value={option.code}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Ingredients & Formulation"
                subheader="Ingredient transparency and clean beauty"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Key Ingredients
                    </Typography>
                    {keyIngredients.map((ingredient, index) => (
                      <Grid container spacing={1} key={index} sx={{ mb: 1 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Hyaluronic Acid"
                            value={ingredient.name}
                            onChange={(e) => {
                              const updated = [...keyIngredients]
                              updated[index].name = e.target.value
                              setKeyIngredients(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            size="small"
                            placeholder="2%"
                            value={ingredient.percentage}
                            onChange={(e) => {
                              const updated = [...keyIngredients]
                              updated[index].percentage = e.target.value
                              setKeyIngredients(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Hydration"
                            value={ingredient.purpose}
                            onChange={(e) => {
                              const updated = [...keyIngredients]
                              updated[index].purpose = e.target.value
                              setKeyIngredients(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => setKeyIngredients(keyIngredients.filter((_, i) => i !== index))}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setKeyIngredients([...keyIngredients, { name: '', percentage: '', purpose: '' }])}
                    >
                      Add Ingredient
                    </Button>
                  </Box>
                  <TextField
                    label="Ingredient Highlights"
                    placeholder="Powered by 5% Niacinamide and Vitamin C complex"
                    value={form.ingredient_highlights}
                    onChange={(event) => set('ingredient_highlights', event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  {/* Free From Multi-Select */}
                  <Autocomplete
                    multiple
                    options={lookups?.free_from || []}
                    getOptionLabel={(option) => option.label}
                    value={csvToLookupValues(form.free_from, lookups?.free_from)}
                    onChange={(_e, values) => {
                      set('free_from', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Free From"
                        placeholder="Select excluded ingredients"
                        helperText="Choose ingredients this product doesn't contain"
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        // v9 returns `key` inside the item props, and React 19
                        // warns when a key is spread rather than passed.
                        const { key, ...itemProps } = getItemProps({ index })
                        return <Chip key={key} label={option.label} {...itemProps} />
                      })
                    }
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Certifications & Claims"
                subheader="Build trust with verified certifications"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Certifications
                    </Typography>
                    {certifications.map((cert, index) => (
                      <Grid container spacing={1} key={index} sx={{ mb: 1 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Cruelty-Free"
                            value={cert.type}
                            onChange={(e) => {
                              const updated = [...certifications]
                              updated[index].type = e.target.value
                              setCertifications(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Leaping Bunny"
                            value={cert.authority}
                            onChange={(e) => {
                              const updated = [...certifications]
                              updated[index].authority = e.target.value
                              setCertifications(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            size="small"
                            type="number"
                            placeholder="2023"
                            value={cert.year}
                            onChange={(e) => {
                              const updated = [...certifications]
                              updated[index].year = e.target.value
                              setCertifications(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => setCertifications(certifications.filter((_, i) => i !== index))}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setCertifications([...certifications, { type: '', authority: '', year: '' }])}
                    >
                      Add Certification
                    </Button>
                  </Box>
                  {/* Claims Multi-Select */}
                  <Autocomplete
                    multiple
                    options={lookups?.claims || []}
                    getOptionLabel={(option) => option.label}
                    value={csvToLookupValues(form.claims, lookups?.claims)}
                    onChange={(_e, values) => {
                      set('claims', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Claims"
                        placeholder="Select product claims"
                        helperText="Choose verified claims"
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        // v9 returns `key` inside the item props, and React 19
                        // warns when a key is spread rather than passed.
                        const { key, ...itemProps } = getItemProps({ index })
                        return <Chip key={key} label={option.label} {...itemProps} />
                      })
                    }
                    fullWidth
                  />
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_hypoallergenic}
                          onChange={(event) => set('is_hypoallergenic', event.target.checked)}
                        />
                      }
                      label="Hypoallergenic"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_non_comedogenic}
                          onChange={(event) => set('is_non_comedogenic', event.target.checked)}
                        />
                      }
                      label="Non-Comedogenic"
                    />
                  </FormGroup>
                  <TextField
                    select
                    label="Pregnancy Safe"
                    value={form.pregnancy_safe}
                    onChange={(event) => set('pregnancy_safe', event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="">Not specified</MenuItem>
                    {(lookups?.pregnancy_safe || []).map((option) => (
                      <MenuItem key={option.id} value={option.code}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Usage & Performance"
                subheader="Instructions and expected results"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  {/* Usage Instructions Multi-Select */}
                  <Autocomplete
                    multiple
                    freeSolo
                    options={lookups?.usage_instructions || []}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                    value={csvToLookupValues(form.usage_instructions, lookups?.usage_instructions)}
                    onChange={(_e, values) => {
                      set('usage_instructions', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Usage Instructions"
                        placeholder="Select or type instructions"
                        helperText="Choose common instructions or type custom"
                        multiline
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        const { key, ...itemProps } = getItemProps({ index })
                        return (
                          <Chip
                            key={key}
                            label={typeof option === 'string' ? option : option.label}
                            {...itemProps}
                          />
                        )
                      })
                    }
                    fullWidth
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        options={lookups?.application_method || []}
                        getOptionLabel={(option) => option.label}
                        value={lookups?.application_method?.find(o => o.code === form.application_method) || null}
                        onChange={(_e, value) => set('application_method', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Application Method" placeholder="Select method" />
                        )}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Usage Frequency"
                        placeholder="Daily AM & PM"
                        value={form.usage_frequency}
                        onChange={(event) => set('usage_frequency', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    label="Results Timeline"
                    placeholder="Immediate hydration boost. Plumper, smoother skin in 2-4 weeks"
                    value={form.results_timeline}
                    onChange={(event) => set('results_timeline', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Clinical Study Summary"
                    placeholder="In a 4-week clinical study with 100 participants..."
                    value={form.clinical_study_summary}
                    onChange={(event) => set('clinical_study_summary', event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.has_before_after_study}
                        onChange={(event) => set('has_before_after_study', event.target.checked)}
                      />
                    }
                    label="Has Before/After Study"
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Sensory Attributes"
                subheader="Help customers understand the sensory experience"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Texture Description"
                    placeholder="Lightweight, silky gel that glides smoothly"
                    value={form.texture_description}
                    onChange={(event) => set('texture_description', event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  <TextField
                    label="Color Description"
                    placeholder="Transparent gel with slight pearlescence"
                    value={form.color_description}
                    onChange={(event) => set('color_description', event.target.value)}
                    fullWidth
                  />
                  {/* Feel on Skin Multi-Select */}
                  <Autocomplete
                    multiple
                    freeSolo
                    options={lookups?.feel_on_skin || []}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                    value={csvToLookupValues(form.feel_on_skin, lookups?.feel_on_skin)}
                    onChange={(_e, values) => {
                      set('feel_on_skin', lookupValuesToCSV(values));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Feel on Skin"
                        placeholder="Select or type feel characteristics"
                        helperText="Choose common descriptions or type custom"
                      />
                    )}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        const { key, ...itemProps } = getItemProps({ index })
                        return (
                          <Chip
                            key={key}
                            label={typeof option === 'string' ? option : option.label}
                            {...itemProps}
                          />
                        )
                      })
                    }
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Packaging & Sustainability"
                subheader="Eco-conscious packaging information"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        options={lookups?.packaging_type || []}
                        getOptionLabel={(option) => option.label}
                        value={lookups?.packaging_type?.find(o => o.code === form.packaging_type) || null}
                        onChange={(_e, value) => set('packaging_type', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Packaging Type" placeholder="Select packaging type" />
                        )}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Packaging Material"
                        placeholder="50% PCR Plastic, Glass Jar"
                        value={form.packaging_material}
                        onChange={(event) => set('packaging_material', event.target.value)}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_recyclable}
                          onChange={(event) => set('is_recyclable', event.target.checked)}
                        />
                      }
                      label="Recyclable"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_refillable}
                          onChange={(event) => set('is_refillable', event.target.checked)}
                        />
                      }
                      label="Refillable"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_eco_friendly}
                          onChange={(event) => set('is_eco_friendly', event.target.checked)}
                        />
                      }
                      label="Eco-Friendly"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_carbon_neutral}
                          onChange={(event) => set('is_carbon_neutral', event.target.checked)}
                        />
                      }
                      label="Carbon Neutral"
                    />
                  </FormGroup>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Demographics & Marketing"
                subheader="Target audience and product positioning"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        options={lookups?.age_range || []}
                        getOptionLabel={(option) => option.label}
                        value={lookups?.age_range?.find(o => o.code === form.age_range) || null}
                        onChange={(_e, value) => set('age_range', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Age Range" placeholder="Select age range" />
                        )}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Gender Target"
                        value={form.gender_target}
                        onChange={(event) => set('gender_target', event.target.value)}
                        fullWidth
                      >
                        {(lookups?.gender_target || []).map((option) => (
                          <MenuItem key={option.id} value={option.code}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_seasonal}
                          onChange={(event) => set('is_seasonal', event.target.checked)}
                        />
                      }
                      label="Seasonal Product"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_limited_edition}
                          onChange={(event) => set('is_limited_edition', event.target.checked)}
                        />
                      }
                      label="Limited Edition"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.is_sample}
                          onChange={(event) => set('is_sample', event.target.checked)}
                        />
                      }
                      label="Sample Product"
                    />
                  </FormGroup>
                  {form.is_seasonal && (
                    <TextField
                      select
                      label="Season"
                      value={form.season}
                      onChange={(event) => set('season', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">Not specified</MenuItem>
                      {(lookups?.season || []).map((option) => (
                        <MenuItem key={option.id} value={option.code}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  {form.is_sample && (
                    <TextField
                      label="Sample of Product ID"
                      type="number"
                      placeholder="Product ID of full-size product"
                      value={form.sample_of_product_id}
                      onChange={(event) => set('sample_of_product_id', event.target.value)}
                      fullWidth
                    />
                  )}
                  <TextField
                    label="Tutorial Video URL"
                    placeholder="https://youtube.com/..."
                    value={form.tutorial_video_url}
                    onChange={(event) => set('tutorial_video_url', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Demo Video URL"
                    placeholder="https://youtube.com/..."
                    value={form.demo_video_url}
                    onChange={(event) => set('demo_video_url', event.target.value)}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Awards & Press"
                subheader="Recognition and media features"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Awards
                    </Typography>
                    {awards.map((award, index) => (
                      <Grid container spacing={1} key={index} sx={{ mb: 1 }}>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <TextField
                            size="small"
                            placeholder="Best Serum 2023"
                            value={award.name}
                            onChange={(e) => {
                              const updated = [...awards]
                              updated[index].name = e.target.value
                              setAwards(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Allure"
                            value={award.authority}
                            onChange={(e) => {
                              const updated = [...awards]
                              updated[index].authority = e.target.value
                              setAwards(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                          <TextField
                            size="small"
                            type="number"
                            placeholder="2023"
                            value={award.year}
                            onChange={(e) => {
                              const updated = [...awards]
                              updated[index].year = e.target.value
                              setAwards(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => setAwards(awards.filter((_, i) => i !== index))}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setAwards([...awards, { name: '', authority: '', year: '' }])}
                    >
                      Add Award
                    </Button>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Press Features
                    </Typography>
                    {pressFeatures.map((feature, index) => (
                      <Grid container spacing={1} key={index} sx={{ mb: 1 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Elle"
                            value={feature.publication}
                            onChange={(e) => {
                              const updated = [...pressFeatures]
                              updated[index].publication = e.target.value
                              setPressFeatures(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            size="small"
                            type="date"
                            value={feature.date}
                            onChange={(e) => {
                              const updated = [...pressFeatures]
                              updated[index].date = e.target.value
                              setPressFeatures(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <TextField
                            size="small"
                            placeholder="Article URL"
                            value={feature.url}
                            onChange={(e) => {
                              const updated = [...pressFeatures]
                              updated[index].url = e.target.value
                              setPressFeatures(updated)
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => setPressFeatures(pressFeatures.filter((_, i) => i !== index))}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setPressFeatures([...pressFeatures, { publication: '', date: '', url: '' }])}
                    >
                      Add Press Feature
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardHeader title="Status" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Chip
                      size="small"
                      label={product?.status.replace('_', ' ') ?? 'draft'}
                      color={product?.status === 'active' ? 'success' : 'default'}
                      variant={product?.status === 'active' ? 'filled' : 'outlined'}
                    />
                  </Box>
                  {product?.status === 'active' && (
                    <Typography variant="caption" color="text.secondary">
                      Live on the storefront.
                    </Typography>
                  )}
                  {product && (
                    <>
                      <Divider />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => runAction('duplicate')} disabled={action.isPending}>
                          Duplicate
                        </Button>
                        {can('products.publish') && !catalogManaged && product.status !== 'archived' && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => runAction('archive')}
                            disabled={action.isPending}
                          >
                            Archive
                          </Button>
                        )}
                      </Stack>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Organisation" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Category"
                    value={form.category_id}
                    onChange={(event) =>
                      set('category_id', event.target.value === '' ? '' : Number(event.target.value))
                    }
                    fullWidth
                  >
                    <MenuItem value="">Uncategorised</MenuItem>
                    {(categories.data?.categories ?? []).map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {'— '.repeat(category.depth)}
                        {category.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Tags"
                    value={form.tags}
                    onChange={(event) => set('tags', event.target.value)}
                    placeholder="brightening, niacinamide"
                    helperText="Comma separated"
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <ProductCollectionsCard productId={productId} />

            <ProductDiscountsCard productId={productId} />

            <ThemeTemplateCard resource="product" id={productId} value={query.data?.product?.template_suffix} />

            <Card>
              <CardHeader
                title="Search engine listing"
                slotProps={{ title: { variant: 'subtitle1' } }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Meta title"
                    placeholder="Vitamin C Serum for Bright, Even Skin | Veylor"
                    value={form.meta_title}
                    onChange={(event) => set('meta_title', event.target.value)}
                    helperText={`${form.meta_title.length}/60 recommended`}
                    fullWidth
                  />
                  <TextField
                    label="Meta description"
                    placeholder="A 10% vitamin C serum that fades dullness and uneven tone. Dermatologist tested, made in India."
                    value={form.meta_description}
                    onChange={(event) => set('meta_description', event.target.value)}
                    multiline
                    minRows={3}
                    helperText={`${form.meta_description.length}/160 recommended`}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
