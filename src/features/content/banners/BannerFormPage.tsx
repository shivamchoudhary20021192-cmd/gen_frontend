import { useState, useEffect } from 'react'
import { LinkTargetPicker, isSearchableLinkType } from '../../../components/LinkTargetPicker'
import {
  Box,
  Button,
  Card,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Stack,
  Switch,
  TextField,
  Typography,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { tokens } from '../../../theme'
import { RichTextEditor } from '../pages/RichTextEditor'
import { MediaPicker } from '../../media/MediaPicker'
import type { Media } from '../../../api/types'
import { formatCTR } from './utils'
import {
  useBanner,
  useCreateBanner,
  useUpdateBanner,
  useActivateBanner,
  useDeactivateBanner,
  useDuplicateBanner,
  type BannerPlacement,
  type BannerAudience,
  type LinkType,
  type CreateBannerDto,
  type UpdateBannerDto,
  PLACEMENT_LABELS,
  AUDIENCE_LABELS,
  LINK_TYPE_LABELS,
  validateDateRange,
  getCTAValidationError,
  getStatusLabel,
  getStatusColor,
  computeBannerStatus,
  formatDateTime,
} from './index'

export function BannerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new' || !id
  const bannerId = isNew ? 0 : parseInt(id!, 10)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: banner, isLoading } = useBanner(bannerId)

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()
  const activateMutation = useActivateBanner()
  const deactivateMutation = useDeactivateBanner()
  const duplicateMutation = useDuplicateBanner()

  // ── Form State ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [placement, setPlacement] = useState<BannerPlacement>('announcement_bar')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaLinkType, setCtaLinkType] = useState<LinkType>('none')
  const [ctaUrl, setCtaUrl] = useState('')
  const [ctaLinkRefId, setCtaLinkRefId] = useState<string>('')
  const [desktopMediaId, setDesktopMediaId] = useState<number | null>(null)
  const [desktopMediaUrl, setDesktopMediaUrl] = useState<string>('')
  const [mobileMediaId, setMobileMediaId] = useState<number | null>(null)
  const [mobileMediaUrl, setMobileMediaUrl] = useState<string>('')
  const [backgroundHex, setBackgroundHex] = useState('')
  const [textHex, setTextHex] = useState('')
  const [audience, setAudience] = useState<BannerAudience>('all')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [priority, setPriority] = useState<string>('0')
  const [isActive, setIsActive] = useState(true)
  const [isDismissible, setIsDismissible] = useState(true)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'desktop' | 'mobile' | 'poster'>(
    'desktop',
  )
  // The desktop slot takes film as well as a photograph, so the form has to
  // remember which it is holding — a <video> and an <img> are not interchangeable,
  // and an <img> pointed at an .mp4 draws the broken-image icon.
  const [desktopMediaType, setDesktopMediaType] = useState<'image' | 'video'>('image')
  const [desktopMediaBytes, setDesktopMediaBytes] = useState<number | null>(null)
  const [desktopAutoPoster, setDesktopAutoPoster] = useState<string>('')
  const [posterMediaId, setPosterMediaId] = useState<number | null>(null)
  const [posterMediaUrl, setPosterMediaUrl] = useState<string>('')

  // ── Load Banner Data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (banner) {
      setName(banner.name || '')
      setPlacement(banner.placement || 'announcement_bar')
      setTitle(banner.title || '')
      setSubtitle(banner.subtitle || '')
      setBody(banner.body || '')
      setCtaLabel(banner.cta_label || '')
      setCtaLinkType(banner.cta_link_type || 'none')
      setCtaUrl(banner.cta_url || '')
      setCtaLinkRefId(banner.cta_link_ref_id?.toString() || '')
      setDesktopMediaId(banner.desktop_media_id || null)
      setDesktopMediaUrl(banner.desktop_media?.url || '')
      setDesktopMediaType(banner.desktop_media?.media_type === 'video' ? 'video' : 'image')
      setDesktopMediaBytes(banner.desktop_media?.size_bytes ?? null)
      setDesktopAutoPoster(banner.desktop_media?.auto_poster_url || '')
      setPosterMediaId(banner.poster_media_id || null)
      setPosterMediaUrl(banner.poster_media?.url || '')
      setMobileMediaId(banner.mobile_media_id || null)
      setMobileMediaUrl(banner.mobile_media?.url || '')
      setBackgroundHex(banner.background_hex || '')
      setTextHex(banner.text_hex || '')
      setAudience(banner.audience || 'all')
      setStartsAt(banner.starts_at ? banner.starts_at.slice(0, 16) : '')
      setEndsAt(banner.ends_at ? banner.ends_at.slice(0, 16) : '')
      setPriority((banner.priority ?? 0).toString())
      setIsActive(banner.is_active ?? true)
      setIsDismissible(banner.is_dismissible ?? true)
    }
  }, [banner])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!name.trim()) errors.name = 'Name is required'
    if (!placement) errors.placement = 'Placement is required'

    // Date range validation
    const dateError = validateDateRange(startsAt || null, endsAt || null)
    if (dateError) errors.date_range = dateError

    // CTA validation
    const ctaError = getCTAValidationError(
      ctaLabel || null,
      ctaLinkType,
      ctaUrl || null,
      ctaLinkRefId ? Number(ctaLinkRefId) : null
    )
    if (ctaError) errors.cta = ctaError

    // Color validation
    if (backgroundHex && !/^#[0-9A-F]{6}$/i.test(backgroundHex)) {
      errors.background_hex = 'Invalid hex color format (use #RRGGBB)'
    }
    if (textHex && !/^#[0-9A-F]{6}$/i.test(textHex)) {
      errors.text_hex = 'Invalid hex color format (use #RRGGBB)'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateForm()) {
      setErrorMessage('Please fix the validation errors before saving')
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    const data: CreateBannerDto | UpdateBannerDto = {
      name,
      placement,
      title: title || undefined,
      subtitle: subtitle || undefined,
      body: body || undefined,
      cta_label: ctaLabel || undefined,
      cta_link_type: ctaLinkType,
      cta_link_ref_id: ctaLinkRefId ? Number(ctaLinkRefId) : undefined,
      cta_url: ctaUrl || undefined,
      // Explicitly null rather than undefined, for the same reason the poster
      // below is: an omitted key means "leave it alone", so clearing a media
      // slot and saving used to do nothing at all — the picture came back on
      // the next load and the only way out was to pick a different one.
      // `undefined` is still right on create, where there is nothing to clear.
      desktop_media_id: isNew ? desktopMediaId || undefined : desktopMediaId,
      mobile_media_id: isNew ? mobileMediaId || undefined : mobileMediaId,
      // Explicitly null rather than undefined: clearing a poster has to reach
      // the database, and an omitted key means "leave it alone".
      poster_media_id: desktopMediaType === 'video' ? posterMediaId : null,
      background_hex: backgroundHex || undefined,
      text_hex: textHex || undefined,
      audience,
      starts_at: startsAt || undefined,
      ends_at: endsAt || undefined,
      priority: Number(priority),
      is_active: isActive,
      is_dismissible: isDismissible,
    }

    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(data as CreateBannerDto)
        setSuccessMessage('Banner created successfully')
        // Navigate immediately without waiting
        navigate(`/content/banners/${created.id}`, { replace: true })
      } else {
        await updateMutation.mutateAsync({ id: bannerId, data })
        setSuccessMessage('Banner updated successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
      }
      setFieldErrors({})
      setErrorMessage(null)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save banner')
      if (err?.fieldErrors) {
        const errors = typeof err.fieldErrors === 'function' ? err.fieldErrors() : err.fieldErrors
        setFieldErrors(errors)
      }
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync(bannerId)
      setSuccessMessage('Banner activated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to activate banner')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleDeactivate = async () => {
    try {
      await deactivateMutation.mutateAsync(bannerId)
      setSuccessMessage('Banner deactivated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to deactivate banner')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleDuplicate = async () => {
    try {
      const duplicated = await duplicateMutation.mutateAsync(bannerId)
      setSuccessMessage('Banner duplicated successfully')
      setTimeout(() => navigate(`/content/banners/${duplicated.id}`), 1500)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to duplicate banner')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const openMediaPicker = (target: 'desktop' | 'mobile' | 'poster') => {
    setMediaPickerTarget(target)
    setMediaPickerOpen(true)
  }

  const handleMediaSelect = (selection: Media[]) => {
    if (selection.length === 0) return
    const media = selection[0]
    if (mediaPickerTarget === 'desktop') {
      setDesktopMediaId(media.id)
      setDesktopMediaUrl(media.url)
      setDesktopMediaType(media.media_type === 'video' ? 'video' : 'image')
      setDesktopMediaBytes(media.size_bytes ?? null)
      setDesktopAutoPoster(media.poster_url || '')
      // Swapping a video for a photograph leaves a poster with nothing to be a
      // poster for.
      if (media.media_type !== 'video') {
        setPosterMediaId(null)
        setPosterMediaUrl('')
      }
    } else if (mediaPickerTarget === 'poster') {
      setPosterMediaId(media.id)
      setPosterMediaUrl(media.url)
    } else {
      setMobileMediaId(media.id)
      setMobileMediaUrl(media.url)
    }
  }

  const removeDesktopMedia = () => {
    setDesktopMediaId(null)
    setDesktopMediaUrl('')
    setDesktopMediaType('image')
    setDesktopMediaBytes(null)
    setDesktopAutoPoster('')
    setPosterMediaId(null)
    setPosterMediaUrl('')
  }

  const removeMobileMedia = () => {
    setMobileMediaId(null)
    setMobileMediaUrl('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  const currentStatus = banner ? computeBannerStatus(banner) : null

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          borderBottom: `1px solid ${tokens.border}`,
          mx: -3,
          px: 3,
          py: 2,
          mb: 3,
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/content/banners')}>
              Back
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {isNew ? 'Create Banner' : banner?.name}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            {!isNew && banner && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={handleDuplicate}
                  disabled={duplicateMutation.isPending}
                >
                  Duplicate
                </Button>
                {banner.is_active ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<VisibilityOffIcon />}
                    onClick={handleDeactivate}
                    disabled={deactivateMutation.isPending}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={handleActivate}
                    disabled={activateMutation.isPending}
                  >
                    Activate
                  </Button>
                )}
              </>
            )}
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              sx={{ borderRadius: 2 }}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Main Form (8 columns) */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Basic Info */}
          <Card sx={{ p: 3, mb: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Basic Information
            </Typography>

            <Stack spacing={2}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!fieldErrors.name}
                helperText={fieldErrors.name || 'Internal reference name'}
                fullWidth
                size="small"
                required
                key={`name-${banner?.id || 'new'}`}
              />

              <FormControl fullWidth size="small" required error={!!fieldErrors.placement}>
                <InputLabel id="banner-placement-label">Placement</InputLabel>
                <Select
                  labelId="banner-placement-label"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as BannerPlacement)}
                  label="Placement"
                >
                  {Object.entries(PLACEMENT_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.placement && <FormHelperText>{fieldErrors.placement}</FormHelperText>}
              </FormControl>

              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                size="small"
                helperText="Main heading displayed to users"
              />

              <TextField
                label="Subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                fullWidth
                size="small"
                helperText="Secondary text"
              />
            </Stack>
          </Card>

          {/* Content */}
          <Card sx={{ p: 3, mb: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Content
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'text.secondary' }}>
                Body Text
              </Typography>
              <RichTextEditor
                content={body}
                onChange={setBody}
                placeholder="Enter banner body text (optional)..."
              />
            </Box>
          </Card>

          {/* CTA Configuration */}
          <Card sx={{ p: 3, mb: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Call-to-Action
            </Typography>

            {fieldErrors.cta && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {fieldErrors.cta}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label="CTA Label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                fullWidth
                size="small"
                placeholder="Shop Now"
                helperText="Button text"
              />

              <FormControl fullWidth size="small">
                <InputLabel id="banner-link-type-label">Link Type</InputLabel>
                <Select
                  labelId="banner-link-type-label"
                  value={ctaLinkType}
                  onChange={(e) => setCtaLinkType(e.target.value as LinkType)}
                  label="Link Type"
                >
                  {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {ctaLinkType === 'url' && (
                <TextField
                  label="URL"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="https://example.com"
                  helperText="Full URL including https://"
                />
              )}

              {/* Picked by name. It is stored as an id either way — the field
                  used to make someone find that id themselves, in another tab,
                  and a CTA pointing at the wrong product is not the sort of
                  mistake anyone reports. */}
              {ctaLinkType !== 'none' && ctaLinkType !== 'url' && isSearchableLinkType(ctaLinkType) && (
                <LinkTargetPicker
                  type={ctaLinkType}
                  value={ctaLinkRefId}
                  onChange={(id) => setCtaLinkRefId(id === null ? '' : String(id))}
                />
              )}

              {/* A kind the server cannot search yet keeps the old field rather
                  than losing the ability to link at all. */}
              {ctaLinkType !== 'none' && ctaLinkType !== 'url' && !isSearchableLinkType(ctaLinkType) && (
                <TextField
                  label="Reference ID"
                  value={ctaLinkRefId}
                  onChange={(e) => setCtaLinkRefId(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText={`ID of the ${ctaLinkType} to link to`}
                />
              )}
            </Stack>
          </Card>

          {/* Design & Media */}
          <Card sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Design & Media
            </Typography>

            <Stack spacing={3}>
              {/* Desktop Media */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Desktop Media
                </Typography>
                {desktopMediaId && desktopMediaUrl ? (
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: 300,
                      aspectRatio: '16 / 9',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: `2px solid ${tokens.border}`,
                      bgcolor: tokens.ivory,
                      '&:hover .media-actions': { opacity: 1 },
                    }}
                  >
                    {desktopMediaType === 'video' ? (
                      // Muted and looping, exactly as the site will play it, so
                      // what is approved here is what visitors get.
                      <Box
                        component="video"
                        src={desktopMediaUrl}
                        poster={posterMediaUrl || desktopAutoPoster || undefined}
                        controls
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Box
                        component="img"
                        src={desktopMediaUrl}
                        alt="Desktop banner"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <IconButton
                      className="media-actions"
                      size="small"
                      onClick={removeDesktopMedia}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        opacity: 0,
                        transition: 'opacity 120ms ease',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box
                    onClick={() => openMediaPicker('desktop')}
                    role="button"
                    aria-label="Select desktop media"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openMediaPicker('desktop')
                    }}
                    sx={{
                      border: `1.5px dashed ${tokens.border}`,
                      borderRadius: 2,
                      bgcolor: tokens.ivory,
                      py: 4,
                      px: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': { borderColor: tokens.taupe },
                    }}
                  >
                    <AddPhotoAlternateIcon sx={{ fontSize: 32, color: tokens.taupe }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Select from media library
                    </Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Image or video, shown on desktop displays
                </Typography>

                {/* A hero video is the first thing the page loads. Ten megabytes
                    of it is several seconds of blank banner on an Indian mobile
                    connection, and nobody finds that out until a customer says so. */}
                {desktopMediaType === 'video' && desktopMediaBytes !== null && desktopMediaBytes > 10 * 1024 * 1024 && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    This film is {(desktopMediaBytes / (1024 * 1024)).toFixed(1)} MB. Anything over
                    about 10 MB is slow to start on a phone — consider a shorter cut or a lower
                    bitrate before this goes live.
                  </Alert>
                )}
              </Box>

              {/* Poster — video only */}
              {desktopMediaType === 'video' && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Poster Image (Optional)
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: 300,
                      aspectRatio: '16 / 9',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: `2px solid ${tokens.border}`,
                      bgcolor: tokens.ivory,
                      '&:hover .media-actions': { opacity: 1 },
                    }}
                  >
                    {posterMediaUrl || desktopAutoPoster ? (
                      <Box
                        component="img"
                        src={posterMediaUrl || desktopAutoPoster}
                        alt="Banner poster"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                          No frame could be taken from this file
                        </Typography>
                      </Box>
                    )}
                    {posterMediaId && (
                      <IconButton
                        className="media-actions"
                        size="small"
                        aria-label="Remove poster image"
                        onClick={() => {
                          setPosterMediaId(null)
                          setPosterMediaUrl('')
                        }}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          opacity: 0,
                          transition: 'opacity 120ms ease',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    onClick={() => openMediaPicker('poster')}
                  >
                    {posterMediaId ? 'Change poster' : 'Choose a different frame'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {posterMediaId
                      ? 'Shown before the film plays, and on phones instead of it.'
                      : 'Taken from one second into the film. Shown before it plays, and on phones instead of it — choose another if this frame is unflattering.'}
                  </Typography>
                </Box>
              )}

              {/* Mobile Media */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Mobile Media (Optional)
                </Typography>
                {mobileMediaId && mobileMediaUrl ? (
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: 200,
                      aspectRatio: '9 / 16',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: `2px solid ${tokens.border}`,
                      bgcolor: tokens.ivory,
                      '&:hover .media-actions': { opacity: 1 },
                    }}
                  >
                    <Box
                      component="img"
                      src={mobileMediaUrl}
                      alt="Mobile banner"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <IconButton
                      className="media-actions"
                      size="small"
                      onClick={removeMobileMedia}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        opacity: 0,
                        transition: 'opacity 120ms ease',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box
                    onClick={() => openMediaPicker('mobile')}
                    role="button"
                    aria-label="Select mobile media"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openMediaPicker('mobile')
                    }}
                    sx={{
                      border: `1.5px dashed ${tokens.border}`,
                      borderRadius: 2,
                      bgcolor: tokens.ivory,
                      py: 4,
                      px: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': { borderColor: tokens.taupe },
                    }}
                  >
                    <AddPhotoAlternateIcon sx={{ fontSize: 32, color: tokens.taupe }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Select from media library
                    </Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Optional mobile-specific image
                </Typography>
              </Box>

              <Divider />

              {/* Colors */}
              <TextField
                label="Background Color"
                value={backgroundHex}
                onChange={(e) => setBackgroundHex(e.target.value)}
                error={!!fieldErrors.background_hex}
                helperText={fieldErrors.background_hex || 'Hex color (e.g., #FF5733)'}
                fullWidth
                size="small"
                placeholder="#FFFFFF"
              />

              <TextField
                label="Text Color"
                value={textHex}
                onChange={(e) => setTextHex(e.target.value)}
                error={!!fieldErrors.text_hex}
                helperText={fieldErrors.text_hex || 'Hex color (e.g., #000000)'}
                fullWidth
                size="small"
                placeholder="#000000"
              />
            </Stack>
          </Card>
        </Grid>

        {/* Right Column - Settings (4 columns) */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Status */}
          {!isNew && banner && (
            <Card sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Status
              </Typography>
              <Chip
                label={getStatusLabel(currentStatus!)}
                sx={{
                  bgcolor: getStatusColor(currentStatus!) + '20',
                  color: getStatusColor(currentStatus!),
                  fontWeight: 500,
                  mb: 2,
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Created: {formatDateTime(banner.created_at)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Updated: {formatDateTime(banner.updated_at)}
              </Typography>
              {banner.creator && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  By: {banner.creator.name}
                </Typography>
              )}
            </Card>
          )}

          {/* Settings */}
          <Card sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Settings
            </Typography>

            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="banner-audience-label">Audience</InputLabel>
                <Select
                  labelId="banner-audience-label"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as BannerAudience)}
                  label="Audience"
                >
                  {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Who should see this banner</FormHelperText>
              </FormControl>

              <TextField
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                fullWidth
                size="small"
                type="number"
                helperText="Higher priority shows first"
              />

              <FormControlLabel
                control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
                label="Active"
              />

              <FormControlLabel
                control={<Switch checked={isDismissible} onChange={(e) => setIsDismissible(e.target.checked)} />}
                label="Dismissible"
              />
            </Stack>
          </Card>

          {/* Schedule */}
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Schedule
            </Typography>

            {fieldErrors.date_range && (
              <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
                {fieldErrors.date_range}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label="Starts At"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Leave empty for immediate"
              />

              <TextField
                label="Ends At"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Leave empty for no expiry"
              />
            </Stack>
          </Card>

          {/* Stats */}
          {!isNew && banner && (
            <Card sx={{ p: 2, mt: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Performance
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Impressions
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {(banner.impression_count || 0).toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Clicks
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {(banner.click_count || 0).toLocaleString()}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    CTR
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {/* Through formatCTR rather than arithmetic inline: these
                        counters arrive from a DECIMAL/COUNT and have been a
                        string before now, and .toFixed on a string throws
                        during render — which unmounts the page, not the cell. */}
                    {formatCTR(
                      Number(banner.impression_count) > 0
                        ? (Number(banner.click_count || 0) / Number(banner.impression_count)) * 100
                        : null,
                    )}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Media Picker Dialog */}
      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple={false}
        maxSelection={1}
        title={
          mediaPickerTarget === 'desktop'
            ? 'Select desktop image or video'
            : mediaPickerTarget === 'poster'
              ? 'Select poster image'
              : 'Select mobile image'
        }
        confirmLabel="Select"
        // Only the desktop slot plays film, so only its picker starts with the
        // type filter open. Anywhere else, a video is not a valid answer.
        defaultMediaType={mediaPickerTarget === 'desktop' ? '' : 'image'}
      />

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={5000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setErrorMessage(null)}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
