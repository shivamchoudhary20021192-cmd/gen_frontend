import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { PageHeader } from '../../../components/PageHeader'
import { MediaPicker } from '../../media/MediaPicker'
import { tokens } from '../../../theme'
import { RichTextEditor } from '../pages/RichTextEditor'
import {
  useArticle,
  useArticleAction,
  useArticleCategories,
  useCreateArticle,
  useUpdateArticle,
  type ArticleInput,
} from './useArticles'
import { useBlogs } from './useBlogs'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

interface FormState {
  title: string
  blog_id: number | ''
  slug: string
  subtitle: string
  excerpt: string
  body_html: string
  category_id: number | ''
  cover_media_id: number | null
  cover_url: string | null
  author_name: string
  author_title: string
  medically_reviewed_by: string
  reviewed_at: string
  next_review_due: string
  is_featured: boolean
  is_indexable: boolean
}

const EMPTY: FormState = {
  title: '',
  blog_id: '',
  slug: '',
  subtitle: '',
  excerpt: '',
  body_html: '',
  category_id: '',
  cover_media_id: null,
  cover_url: null,
  author_name: '',
  author_title: '',
  medically_reviewed_by: '',
  reviewed_at: '',
  next_review_due: '',
  is_featured: false,
  is_indexable: true,
}

/** Blank strings mean "no value" to the API, not empty text. */
function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Write or edit one journal article.
 *
 * The medical review block is not an afterthought pane: skincare content makes
 * claims, and the review fields are what let someone answer "who checked this,
 * and when does it need checking again". Publishing is a separate button from
 * Save for the same reason — saving a draft and putting a claim in front of
 * customers are different decisions, and the API gates them differently.
 */
export function ArticleFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const articleId = isNew ? undefined : Number(id)

  const [form, setForm] = useState<FormState>(EMPTY)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const query = useArticle(articleId)
  const categories = useArticleCategories()
  const blogs = useBlogs()
  const create = useCreateArticle()
  const update = useUpdateArticle(articleId ?? 0)
  const action = useArticleAction(articleId ?? 0)

  const article = query.data?.article

  useEffect(() => {
    if (!article) return
    setForm({
      title: article.title,
      blog_id: article.blog?.id ?? article.blog_id ?? '',
      slug: article.slug,
      subtitle: article.subtitle ?? '',
      excerpt: article.excerpt ?? '',
      body_html: article.body_html ?? '',
      category_id: article.category_id ?? '',
      cover_media_id: article.cover_media_id,
      cover_url: article.cover,
      author_name: article.author.name ?? '',
      author_title: article.author.title ?? '',
      medically_reviewed_by: article.medically_reviewed_by ?? '',
      reviewed_at: article.reviewed_at ?? '',
      next_review_due: article.next_review_due ?? '',
      is_featured: article.is_featured,
      is_indexable: article.is_indexable,
    })
  }, [article])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const payload = (): ArticleInput => ({
    title: form.title.trim(),
    // Left off when unset so a new article takes the default blog rather than
    // being sent a blank.
    ...(form.blog_id === '' ? {} : { blog_id: form.blog_id }),
    // Left off entirely when blank so the API derives it from the title rather
    // than being handed an empty string to slugify.
    ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
    subtitle: nullable(form.subtitle),
    excerpt: nullable(form.excerpt),
    body_html: form.body_html,
    category_id: form.category_id === '' ? null : form.category_id,
    cover_media_id: form.cover_media_id,
    author_name: nullable(form.author_name),
    author_title: nullable(form.author_title),
    medically_reviewed_by: nullable(form.medically_reviewed_by),
    reviewed_at: nullable(form.reviewed_at),
    next_review_due: nullable(form.next_review_due),
    is_featured: form.is_featured,
    is_indexable: form.is_indexable,
  })

  const save = async () => {
    setBanner(null)
    if (form.title.trim().length < 2) {
      setBanner('Give the article a title before saving.')
      return
    }
    try {
      if (isNew) {
        const created = await create.mutateAsync(payload())
        setToast('Article created.')
        // Straight into the saved record rather than back to the list: writing
        // is a long sitting, and being thrown out of it after the first save is
        // how a draft gets abandoned.
        navigate(`/content/articles/${created.article.id}`, { replace: true })
        return
      }
      await update.mutateAsync(payload())
      setToast('Saved.')
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  const runAction = async (name: 'publish' | 'unpublish' | 'archive') => {
    setBanner(null)
    try {
      await action.mutateAsync(name)
      setToast(
        name === 'publish'
          ? 'Published — it is live on the journal now.'
          : name === 'unpublish'
            ? 'Taken down. It is a draft again.'
            : 'Archived.',
      )
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  const busy = create.isPending || update.isPending || action.isPending

  const reviewOverdue = useMemo(() => {
    if (!form.next_review_due) return false
    return new Date(form.next_review_due) <= new Date()
  }, [form.next_review_due])

  if (!isNew && query.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title={isNew ? 'New article' : (article?.title ?? 'Article')}
        subtitle={
          article
            ? `${article.status === 'published' ? 'Live on the journal' : 'Not published'}${
                article.read_time_minutes ? ` · ${article.read_time_minutes} min read` : ''
              }`
            : 'A journal entry — routines, ingredients, what to expect.'
        }
        back={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/content/articles')}>
            Journal
          </Button>
        }
        actions={
          <Stack direction="row" spacing={1}>
            {article?.status === 'published' && (
              <Button
                size="small"
                startIcon={<OpenInNewIcon />}
                href={`/blog/${article.blog?.slug ?? 'journal'}/${article.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View
              </Button>
            )}
            {!isNew && article?.status === 'published' && (
              <Button variant="outlined" onClick={() => runAction('unpublish')} disabled={busy}>
                Unpublish
              </Button>
            )}
            {!isNew && article?.status !== 'published' && (
              <Button variant="outlined" onClick={() => runAction('publish')} disabled={busy}>
                Publish
              </Button>
            )}
            <Button variant="contained" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        }
      />

      {banner && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {reviewOverdue && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The next review date has passed. Have this re-read before leaving it published.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Title"
                    placeholder="How to layer a morning routine"
                    value={form.title}
                    onChange={(event) => set('title', event.target.value)}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Subtitle"
                    placeholder="Thinnest to thickest, and sunscreen last"
                    value={form.subtitle}
                    onChange={(event) => set('subtitle', event.target.value)}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Excerpt"
                    placeholder="One or two sentences — this is what appears in the journal list and in search results."
                    helperText={`${form.excerpt.length}/500 · required before publishing`}
                    value={form.excerpt}
                    onChange={(event) => set('excerpt', event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Body
                </Typography>
                <RichTextEditor
                  content={form.body_html}
                  onChange={(html) => set('body_html', html)}
                  placeholder="Write the article…"
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Organisation
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Blog"
                    value={form.blog_id}
                    onChange={(event) =>
                      set('blog_id', event.target.value === '' ? '' : Number(event.target.value))
                    }
                    helperText={
                      (blogs.data?.blogs.length ?? 0) > 1
                        ? 'Which publication this article belongs to'
                        : 'Add another blog from the Journal list to file articles separately'
                    }
                  >
                    {(blogs.data?.blogs ?? []).map((blog) => (
                      <MenuItem key={blog.id} value={blog.id}>
                        {blog.title}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Category"
                    value={form.category_id}
                    onChange={(event) =>
                      set('category_id', event.target.value === '' ? '' : Number(event.target.value))
                    }
                  >
                    <MenuItem value="">No category</MenuItem>
                    {(categories.data?.categories ?? []).map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    fullWidth
                    size="small"
                    label="Handle"
                    placeholder="Left blank, it is made from the title"
                    helperText={
                      form.slug
                        ? `/blog/${blogs.data?.blogs.find((b) => b.id === form.blog_id)?.slug ?? 'journal'}/${form.slug}`
                        : 'Generated from the title'
                    }
                    value={form.slug}
                    onChange={(event) => set('slug', event.target.value)}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_featured}
                        onChange={(event) => set('is_featured', event.target.checked)}
                      />
                    }
                    label="Feature at the top of the journal"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_indexable}
                        onChange={(event) => set('is_indexable', event.target.checked)}
                      />
                    }
                    label="Let search engines index it"
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Cover image
                </Typography>
                {form.cover_url ? (
                  <Stack spacing={1}>
                    <Box
                      component="img"
                      src={form.cover_url}
                      alt=""
                      sx={{ width: '100%', borderRadius: 1, border: `1px solid ${tokens.border}` }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setPickerOpen(true)}>
                        Replace
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          set('cover_media_id', null)
                          set('cover_url', null)
                        }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ImageOutlinedIcon />}
                    onClick={() => setPickerOpen(true)}
                  >
                    Add an image
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Byline and review
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mb: 1.5 }}>
                  An article that makes a skincare claim should say who checked it and when it is due
                  to be checked again. Both appear on the published page.
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Author"
                    placeholder="Dr Anjali Rao"
                    value={form.author_name}
                    onChange={(event) => set('author_name', event.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Author's title"
                    placeholder="Consultant dermatologist"
                    value={form.author_title}
                    onChange={(event) => set('author_title', event.target.value)}
                  />
                  <Divider />
                  <TextField
                    fullWidth
                    size="small"
                    label="Medically reviewed by"
                    placeholder="Dr Anjali Rao, MD (Dermatology)"
                    value={form.medically_reviewed_by}
                    onChange={(event) => set('medically_reviewed_by', event.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Reviewed on"
                    value={form.reviewed_at}
                    onChange={(event) => set('reviewed_at', event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Review again by"
                    helperText="Shows in the list as overdue once this passes"
                    value={form.next_review_due}
                    onChange={(event) => set('next_review_due', event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
              </CardContent>
            </Card>

            {!isNew && article && (
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip size="small" label={article.status} />
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      {article.view_count} views
                    </Typography>
                  </Stack>
                  {article.status !== 'archived' && (
                    <Button
                      size="small"
                      color="error"
                      sx={{ mt: 1.5 }}
                      onClick={() => runAction('archive')}
                      disabled={busy}
                    >
                      Archive
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple={false}
        title="Choose a cover image"
        onSelect={(media) => {
          const picked = media[0]
          if (picked) {
            set('cover_media_id', picked.id)
            set('cover_url', picked.url ?? null)
          }
          setPickerOpen(false)
        }}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
      />
    </Box>
  )
}
