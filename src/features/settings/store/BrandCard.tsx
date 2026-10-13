import { Box, Button, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../api/client'
import { SectionCard } from '../../../components/SectionCard'
import { errorMessage, fieldErrors } from '../../../lib/errors'
import { thumbUrl } from '../../../lib/mediaUrl'
import { MediaPicker } from '../../media/MediaPicker'
import { useMediaItem } from '../../media/useMedia'

interface BrandMedia {
  id: number
  url: string
  alt: string | null
}

interface Brand {
  slogan: string | null
  short_description: string | null
  logo: BrandMedia | null
  square_logo: BrandMedia | null
  social_links: { platform: string; url: string }[]
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  threads: 'Threads',
}

const brandKey = ['shop', 'brand'] as const

/**
 * Settings → Brand, as a card on Store details: the logo, slogan and line
 * about the store that every storefront draws in its header and footer, and
 * the store's social profiles. Kept apart from themes, so a new theme never
 * loses them.
 */
export function BrandCard({ canManage, onSaved, onError }: { canManage: boolean; onSaved(message: string): void; onError(message: string): void }) {
  const brand = useQuery({ queryKey: brandKey, queryFn: () => api.get<{ brand: Brand; platforms: string[] }>('/shop/brand') })
  if (!brand.data) return <SectionCard title="Brand" description="Loading…" />
  return <BrandForm key={JSON.stringify(brand.data.brand)} brand={brand.data.brand} platforms={brand.data.platforms} canManage={canManage} onSaved={onSaved} onError={onError} />
}

function BrandForm({
  brand,
  platforms,
  canManage,
  onSaved,
  onError,
}: {
  brand: Brand
  platforms: string[]
  canManage: boolean
  onSaved(message: string): void
  onError(message: string): void
}) {
  const queryClient = useQueryClient()
  const [slogan, setSlogan] = useState(brand.slogan ?? '')
  const [description, setDescription] = useState(brand.short_description ?? '')
  const [logo, setLogo] = useState<number | null>(brand.logo?.id ?? null)
  const [squareLogo, setSquareLogo] = useState<number | null>(brand.square_logo?.id ?? null)
  const [links, setLinks] = useState(brand.social_links)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dirty =
    slogan !== (brand.slogan ?? '') ||
    description !== (brand.short_description ?? '') ||
    logo !== (brand.logo?.id ?? null) ||
    squareLogo !== (brand.square_logo?.id ?? null) ||
    JSON.stringify(links) !== JSON.stringify(brand.social_links)

  const save = useMutation({
    mutationFn: () =>
      api.put('/shop/brand', {
        slogan: slogan.trim() || null,
        short_description: description.trim() || null,
        logo_media_id: logo,
        square_logo_media_id: squareLogo,
        social_links: links.filter((link) => link.url.trim()).map((link) => ({ platform: link.platform, url: link.url.trim() })),
      }),
    onSuccess: () => {
      setErrors({})
      void queryClient.invalidateQueries({ queryKey: brandKey })
      onSaved('Brand saved. Your storefront shows it within a few minutes.')
    },
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      onError(errorMessage(caught))
    },
  })

  const unused = platforms.filter((platform) => !links.some((link) => link.platform === platform))

  return (
    <SectionCard
      title="Brand"
      description="How your store looks wherever it is shown: the storefront header and footer, checkout, emails and apps."
      actions={
        <Button size="small" variant="outlined" disabled={!canManage || !dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LogoField label="Logo" hint="Wide, for the header. A transparent PNG or SVG works best." value={logo} onChange={setLogo} disabled={!canManage} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LogoField label="Square logo" hint="For browser tabs, app icons and social previews." value={squareLogo} onChange={setSquareLogo} disabled={!canManage} square />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Slogan"
            value={slogan}
            onChange={(event) => setSlogan(event.target.value.slice(0, 160))}
            placeholder="Conscious skincare"
            helperText={errors.slogan ?? 'A few words under your name. Leave blank for none.'}
            error={Boolean(errors.slogan)}
            disabled={!canManage}
            fullWidth
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Short description"
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 500))}
            placeholder="What you sell and why, in a sentence or two."
            helperText={errors.short_description ?? `${description.length}/500 · shown in the storefront footer and used for search previews.`}
            error={Boolean(errors.short_description)}
            disabled={!canManage}
            multiline
            minRows={2}
            fullWidth
          />
        </Grid>
        <Grid size={12}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Social links
          </Typography>
          <Stack spacing={1}>
            {links.map((link, index) => (
              <Stack key={link.platform} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  select
                  size="small"
                  value={link.platform}
                  onChange={(event) => setLinks(links.map((entry, i) => (i === index ? { ...entry, platform: event.target.value } : entry)))}
                  disabled={!canManage}
                  sx={{ width: 170, flexShrink: 0 }}
                >
                  {[link.platform, ...unused].map((platform) => (
                    <MenuItem key={platform} value={platform}>
                      {PLATFORM_LABELS[platform] ?? platform}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  value={link.url}
                  onChange={(event) => setLinks(links.map((entry, i) => (i === index ? { ...entry, url: event.target.value } : entry)))}
                  placeholder={`https://${link.platform === 'x' ? 'x.com' : `${link.platform}.com`}/yourstore`}
                  error={Boolean(errors[`social_links.${index}.url`] || errors.url)}
                  helperText={errors[`social_links.${index}.url`]}
                  disabled={!canManage}
                  fullWidth
                />
                <IconButton size="small" onClick={() => setLinks(links.filter((_, i) => i !== index))} disabled={!canManage} aria-label="Remove link">
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          {unused.length > 0 && canManage && (
            <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => setLinks([...links, { platform: unused[0], url: '' }])}>
              Add social link
            </Button>
          )}
        </Grid>
      </Grid>
    </SectionCard>
  )
}

function LogoField({ label, hint, value, onChange, disabled, square }: { label: string; hint: string; value: number | null; onChange(value: number | null): void; disabled: boolean; square?: boolean }) {
  const [open, setOpen] = useState(false)
  const media = useMediaItem(value)
  const item = media.data?.media
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: square ? 64 : 140,
            height: 64,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            bgcolor: 'action.hover',
            backgroundImage: 'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%)',
            backgroundSize: '12px 12px',
          }}
        >
          {item ? <Box component="img" src={thumbUrl(item, 'md')} alt="" sx={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} /> : <Typography variant="caption">None</Typography>}
        </Box>
        <Stack spacing={0.5}>
          <Button size="small" variant="outlined" disabled={disabled} onClick={() => setOpen(true)}>
            {value ? 'Change' : 'Select'}
          </Button>
          {value && (
            <Button size="small" color="inherit" disabled={disabled} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </Stack>
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
        {hint}
      </Typography>
      <MediaPicker
        open={open}
        multiple={false}
        title={label}
        initialSelectedIds={value ? [value] : []}
        onClose={() => setOpen(false)}
        onSelect={(picked) => {
          if (picked[0]) onChange(picked[0].id)
          setOpen(false)
        }}
      />
    </Box>
  )
}
