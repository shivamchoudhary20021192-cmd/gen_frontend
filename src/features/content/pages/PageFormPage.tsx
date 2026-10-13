import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { RichTextEditor } from './RichTextEditor'
import {
  useArchivePage,
  useCreatePage,
  useDuplicatePage,
  useMarkPageAsReviewed,
  usePage,
  usePublishPage,
  useRestorePage,
  useUnpublishPage,
  useUpdatePage,
} from './usePages'
import type { CreatePageDto, PageStatus, PageType, UpdatePageDto } from './types'
import {
  canPublish,
  formatDate,
  formatDateTime,
  generateSlug,
  getAvailableActions,
  getPageStatusColor,
  getPageStatusLabel,
  validateSlug,
} from './utils'
import { tokens } from '../../../theme'

interface FormState {
  title: string
  subtitle: string
  slug: string
  page_type: PageType
  template: string
  locale: string
  body_html: string
  status: PageStatus
  meta_title: string
  meta_description: string
  is_indexable: boolean
  show_in_sitemap: boolean
  requires_legal_review: boolean
}

const EMPTY: FormState = {
  title: '',
  subtitle: '',
  slug: '',
  page_type: 'standard',
  template: 'default',
  locale: 'en-IN',
  body_html: '',
  status: 'draft',
  meta_title: '',
  meta_description: '',
  is_indexable: true,
  show_in_sitemap: true,
  requires_legal_review: false,
}

export function PageFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const pageId = isNew ? undefined : Number(id)

  const navigate = useNavigate()
  const { can } = useAuth()
  const query = usePage(pageId)
  const create = useCreatePage()
  const update = useUpdatePage(pageId ?? 0)
  const publish = usePublishPage(pageId ?? 0)
  const unpublish = useUnpublishPage(pageId ?? 0)
  const archive = useArchivePage(pageId ?? 0)
  const restore = useRestorePage(pageId ?? 0)
  const markReviewed = useMarkPageAsReviewed(pageId ?? 0)
  const duplicate = useDuplicatePage()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ severity: 'error' | 'warning' | 'info'; title: string; body: string } | null>(
    null,
  )
  const [toast, setToast] = useState<string | null>(null)

  const page = query.data

  // Load existing page data
  /**
   * Fills the form from the loaded page.
   *
   * The pages API answers in camelCase (`bodyHtml`, `pageType`, `isIndexable`)
   * while this form is written in snake_case, and it even returns both
   * spellings for a few fields. Reading only the snake_case name meant the body,
   * the page type and all three switches silently stayed at their defaults —
   * the screen looked like it had loaded because title, subtitle and slug
   * happen to be spelled the same either way.
   *
   * `either` takes whichever spelling is present rather than picking a side,
   * because the response genuinely carries a mixture.
   */
  useEffect(() => {
    if (!page) return

    const row = page as unknown as Record<string, unknown>
    const either = <T,>(camel: string, snake: string, fallback: T): T =>
      (row[camel] ?? row[snake] ?? fallback) as T

    setForm({
      title: page.title,
      subtitle: page.subtitle ?? '',
      slug: page.slug,
      page_type: either('pageType', 'page_type', 'standard'),
      template: page.template,
      locale: page.locale,
      body_html: either('bodyHtml', 'body_html', ''),
      status: page.status,
      // SEO is not stored on the page row — it lives in `seo_meta`, which
      // nothing writes yet. These stay empty until that is built.
      meta_title: either('metaTitle', 'meta_title', ''),
      meta_description: either('metaDescription', 'meta_description', ''),
      is_indexable: either('isIndexable', 'is_indexable', true),
      show_in_sitemap: either('showInSitemap', 'show_in_sitemap', true),
      requires_legal_review: either('requiresLegalReview', 'requires_legal_review', false),
    })
    setSlugTouched(true)
  }, [page])

  // Auto-generate slug from title if not touched
  useEffect(() => {
    if (!slugTouched && form.title) {
      setForm((current) => ({ ...current, slug: generateSlug(form.title) }))
    }
  }, [form.title, slugTouched])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'slug') setSlugTouched(true)
  }

  const payload = useMemo<CreatePageDto | UpdatePageDto>(() => {
    const base = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      slug: form.slug.trim(),
      page_type: form.page_type,
      template: form.template,
      locale: form.locale,
      body_html: form.body_html.trim() || undefined,
      meta_title: form.meta_title.trim() || undefined,
      meta_description: form.meta_description.trim() || undefined,
      is_indexable: form.is_indexable,
      show_in_sitemap: form.show_in_sitemap,
      requires_legal_review: form.requires_legal_review,
    }
    if (isNew) {
      return { ...base, status: form.status } as CreatePageDto
    }
    return base as UpdatePageDto
  }, [form, isNew])

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

    // Validate slug
    if (!validateSlug(form.slug.trim())) {
      setFieldErrors({ slug: 'Slug must be lowercase alphanumeric with hyphens only' })
      setBanner({
        severity: 'warning',
        title: 'Invalid slug',
        body: 'Please use only lowercase letters, numbers, and hyphens',
      })
      return
    }

    if (isNew) {
      create.mutate(payload as CreatePageDto, {
        onSuccess: (data) => {
          setToast('Page created successfully.')
          navigate(`/content/pages/${data.id}`, { replace: true })
        },
        onError: (error) => handleApiError(error, 'Could not create the page'),
      })
    } else {
      update.mutate(payload as UpdatePageDto, {
        onSuccess: () => setToast('Changes saved successfully.'),
        onError: (error) => handleApiError(error, 'Could not save changes'),
      })
    }
  }

  const handlePublish = () => {
    if (!page) return
    const check = canPublish(page)
    if (!check.allowed) {
      setBanner({ severity: 'warning', title: 'Cannot publish', body: check.reason! })
      return
    }

    publish.mutate(undefined, {
      onSuccess: () => setToast('Page published successfully.'),
      onError: (error) => handleApiError(error, 'Could not publish page'),
    })
  }

  const handleUnpublish = () => {
    unpublish.mutate(undefined, {
      onSuccess: () => setToast('Page unpublished.'),
      onError: (error) => handleApiError(error, 'Could not unpublish page'),
    })
  }

  const handleArchive = () => {
    archive.mutate(undefined, {
      onSuccess: () => setToast('Page archived.'),
      onError: (error) => handleApiError(error, 'Could not archive page'),
    })
  }

  const handleRestore = () => {
    restore.mutate(undefined, {
      onSuccess: () => setToast('Page restored.'),
      onError: (error) => handleApiError(error, 'Could not restore page'),
    })
  }

  const handleMarkReviewed = () => {
    markReviewed.mutate(undefined, {
      onSuccess: () => setToast('Marked as reviewed.'),
      onError: (error) => handleApiError(error, 'Could not mark as reviewed'),
    })
  }

  const handleDuplicate = () => {
    if (!pageId) return
    duplicate.mutate(pageId, {
      onSuccess: (data) => {
        navigate(`/content/pages/${data.id}`)
        setToast('Page duplicated successfully.')
      },
      onError: (error) => handleApiError(error, 'Could not duplicate page'),
    })
  }

  if (!isNew && query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  if (!isNew && query.isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Could not load this page.</Alert>
      </Box>
    )
  }

  const saving = create.isPending || update.isPending
  const actionsPending =
    publish.isPending ||
    unpublish.isPending ||
    archive.isPending ||
    restore.isPending ||
    markReviewed.isPending ||
    duplicate.isPending
  const readOnly = !can(isNew ? 'content.pages.create' : 'content.pages.edit')

  const availableActions = page ? getAvailableActions(page.status) : []

  return (
    <Box sx={{ bgcolor: tokens.surface, minHeight: '100vh' }}>
      {/* Shopify-style top bar */}
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          borderBottom: `1px solid ${tokens.border}`,
          px: 3,
          py: 2,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Stack direction="row"  spacing={2} sx={{ alignItems: 'center' }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/content/pages')}
            sx={{ color: tokens.ink }}
          >
            Pages
          </Button>
          <Typography variant="h5" sx={{ flex: 1, fontWeight: 600 }}>
            {isNew ? 'Create page' : page?.title ?? 'Edit page'}
          </Typography>
          {!isNew && page && (
            <Chip
              label={getPageStatusLabel(page.status)}
              size="small"
              sx={{
                bgcolor: getPageStatusColor(page.status),
                color: '#FFFFFF',
                fontWeight: 500,
              }}
            />
          )}
          {!isNew && page && availableActions.length > 0 && (
            <>
              {availableActions.map((action) => (
                <Button
                  key={action.action}
                  size="small"
                  variant="outlined"
                  disabled={actionsPending}
                  onClick={() => {
                    if (action.action === 'publish') handlePublish()
                    else if (action.action === 'unpublish') handleUnpublish()
                    else if (action.action === 'archive') handleArchive()
                    else if (action.action === 'restore') handleRestore()
                    else if (action.action === 'review') handleMarkReviewed()
                  }}
                  color={action.action === 'archive' ? 'error' : 'primary'}
                >
                  {action.label}
                </Button>
              ))}
              <Button size="small" variant="outlined" disabled={actionsPending} onClick={handleDuplicate}>
                Duplicate
              </Button>
            </>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={save}
            disabled={saving || readOnly}
          >
            {isNew ? 'Create' : 'Save'}
          </Button>
        </Stack>
      </Box>

      {/* Content area */}
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        {banner && (
          <Alert severity={banner.severity} onClose={() => setBanner(null)} sx={{ mb: 3 }}>
            <AlertTitle>{banner.title}</AlertTitle>
            {banner.body}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              {/* Basic Info Card */}
              <Card sx={{ borderRadius: 2 }}>
                <CardHeader
                  title="Basic information"
                  sx={{
                    '& .MuiCardHeader-title': {
                      fontSize: '16px',
                      fontWeight: 600,
                    },
                  }}
                />
                <Divider />
                <CardContent>
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Title <span style={{ color: tokens.critical }}>*</span>
                      </Typography>
                      <TextField
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        error={Boolean(fieldErrors.title)}
                        helperText={fieldErrors.title}
                        disabled={readOnly}
                        placeholder="e.g., About Us"
                        fullWidth
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Subtitle
                      </Typography>
                      <TextField
                        value={form.subtitle}
                        onChange={(e) => set('subtitle', e.target.value)}
                        error={Boolean(fieldErrors.subtitle)}
                        helperText={fieldErrors.subtitle || 'Optional descriptive text'}
                        disabled={readOnly}
                        placeholder="Optional subtitle"
                        fullWidth
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Slug <span style={{ color: tokens.critical }}>*</span>
                      </Typography>
                      <TextField
                        value={form.slug}
                        onChange={(e) => set('slug', e.target.value.toLowerCase())}
                        error={Boolean(fieldErrors.slug)}
                        helperText={fieldErrors.slug || 'URL-friendly identifier (auto-generated from title)'}
                        disabled={readOnly}
                        placeholder="about-us"
                        fullWidth
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Page type
                      </Typography>
                      <TextField
                        select
                        value={form.page_type}
                        onChange={(e) => set('page_type', e.target.value as PageType)}
                        disabled={readOnly}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="home">Home</MenuItem>
                        <MenuItem value="standard">Standard</MenuItem>
                        <MenuItem value="landing">Landing Page</MenuItem>
                        <MenuItem value="policy">Policy</MenuItem>
                        <MenuItem value="about">About</MenuItem>
                        <MenuItem value="support">Support</MenuItem>
                        <MenuItem value="custom">Custom</MenuItem>
                      </TextField>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Content Card with Rich Text Editor */}
              <Card sx={{ borderRadius: 2 }}>
                <CardHeader
                  title="Content"
                  sx={{
                    '& .MuiCardHeader-title': {
                      fontSize: '16px',
                      fontWeight: 600,
                    },
                  }}
                />
                <Divider />
                <CardContent>
                  <RichTextEditor
                    content={form.body_html}
                    onChange={(html) => set('body_html', html)}
                    placeholder="Write your page content here..."
                    disabled={readOnly}
                    error={Boolean(fieldErrors.body_html)}
                    helperText={fieldErrors.body_html}
                  />
                </CardContent>
              </Card>

              {/* SEO Card */}
              <Card sx={{ borderRadius: 2 }}>
                <CardHeader
                  title="Search engine optimization"
                  sx={{
                    '& .MuiCardHeader-title': {
                      fontSize: '16px',
                      fontWeight: 600,
                    },
                  }}
                />
                <Divider />
                <CardContent>
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Meta title
                      </Typography>
                      <TextField
                        value={form.meta_title}
                        onChange={(e) => set('meta_title', e.target.value)}
                        error={Boolean(fieldErrors.meta_title)}
                        helperText={fieldErrors.meta_title || 'Recommended: 50-60 characters'}
                        disabled={readOnly}
                        placeholder="Page title for search engines"
                        fullWidth
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Meta description
                      </Typography>
                      <TextField
                        value={form.meta_description}
                        onChange={(e) => set('meta_description', e.target.value)}
                        error={Boolean(fieldErrors.meta_description)}
                        helperText={fieldErrors.meta_description || 'Recommended: 150-160 characters'}
                        disabled={readOnly}
                        placeholder="Brief description for search results"
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                      />
                    </Box>
                    <Stack spacing={1}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={form.is_indexable}
                            onChange={(e) => set('is_indexable', e.target.checked)}
                            disabled={readOnly}
                          />
                        }
                        label="Allow search engines to index this page"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={form.show_in_sitemap}
                            onChange={(e) => set('show_in_sitemap', e.target.checked)}
                            disabled={readOnly}
                          />
                        }
                        label="Include in sitemap"
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              {/* Status Card */}
              {!isNew && page && (
                <Card sx={{ borderRadius: 2 }}>
                  <CardHeader
                    title="Status"
                    sx={{
                      '& .MuiCardHeader-title': {
                        fontSize: '16px',
                        fontWeight: 600,
                      },
                    }}
                  />
                  <Divider />
                  <CardContent>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Current status
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getPageStatusLabel(page.status)}
                        </Typography>
                      </Box>
                      {page.published_at && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Published
                          </Typography>
                          <Typography variant="body2">{formatDateTime(page.published_at)}</Typography>
                        </Box>
                      )}
                      {page.scheduled_at && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Scheduled for
                          </Typography>
                          <Typography variant="body2">{formatDateTime(page.scheduled_at)}</Typography>
                        </Box>
                      )}
                      <Divider />
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Author
                        </Typography>
                        {/*
                          `author` is null on any page this admin did not create
                          — a migration-seeded policy page, or an import. Reading
                          `.name` straight off it threw during render, which
                          unmounts the tree: the whole edit screen went white,
                          not just this line.
                        */}
                        <Typography variant="body2">
                          {page.author?.name ?? 'Not recorded'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Created
                        </Typography>
                        <Typography variant="body2">{formatDate(page.created_at)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Last updated
                        </Typography>
                        <Typography variant="body2">{formatDateTime(page.updated_at)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Settings Card */}
              <Card sx={{ borderRadius: 2 }}>
                <CardHeader
                  title="Settings"
                  sx={{
                    '& .MuiCardHeader-title': {
                      fontSize: '16px',
                      fontWeight: 600,
                    },
                  }}
                />
                <Divider />
                <CardContent>
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Template
                      </Typography>
                      <TextField
                        select
                        value={form.template}
                        onChange={(e) => set('template', e.target.value)}
                        disabled={readOnly}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="default">Default</MenuItem>
                        <MenuItem value="full-width">Full Width</MenuItem>
                        <MenuItem value="sidebar">With Sidebar</MenuItem>
                      </TextField>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                        Locale
                      </Typography>
                      <TextField
                        select
                        value={form.locale}
                        onChange={(e) => set('locale', e.target.value)}
                        disabled={readOnly}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="en-IN">English (India)</MenuItem>
                        <MenuItem value="hi-IN">Hindi (India)</MenuItem>
                      </TextField>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.requires_legal_review}
                          onChange={(e) => set('requires_legal_review', e.target.checked)}
                          disabled={readOnly}
                        />
                      }
                      label="Requires legal review before publishing"
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Sections Preview */}
              {!isNew && page && page.sections.length > 0 && (
                <Card sx={{ borderRadius: 2 }}>
                  <CardHeader
                    title="Sections"
                    subheader={`${page.sections.length} section(s)`}
                    sx={{
                      '& .MuiCardHeader-title': {
                        fontSize: '16px',
                        fontWeight: 600,
                      },
                    }}
                  />
                  <Divider />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Section management coming soon
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
