import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { PageHeader } from '../../../components/PageHeader'
import { formatRelative } from '../../../lib/format'
import { tokens } from '../../../theme'
import { useBlogs, useCreateBlog, useDeleteBlog, useUpdateBlog, type Blog } from './useBlogs'

/**
 * Blogs — the publications articles are filed under.
 *
 * A shop starts with one ("Journal") and most never add a second, so this is a
 * short, quiet screen: a table, an inline rename, and one field to add another.
 * There is no form page behind it because a blog is a title and a handle, and
 * making someone navigate to a second screen to type one word is worse than
 * typing it here.
 *
 * Deleting is the only dangerous thing on the screen. `cms_articles.blog_id`
 * cascades, so a careless delete would take everything written in the blog with
 * it. The API refuses that — a blog with articles needs somewhere to move them,
 * and the last blog cannot go at all — and this surfaces both rules before the
 * button is pressed rather than after.
 */

/** What each blog does with comments, as Shopify offers it. */
const COMMENTS: Record<Blog['comments_policy'], string> = {
  disabled: 'Comments off',
  moderated: 'Held for approval',
  published: 'Published at once',
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function BlogsListPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useBlogs()
  const create = useCreateBlog()
  const update = useUpdateBlog()
  const remove = useDeleteBlog()

  const [banner, setBanner] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState<Blog | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleting, setDeleting] = useState<Blog | null>(null)
  const [reassignTo, setReassignTo] = useState<number | ''>('')

  const blogs = data?.blogs ?? []
  const busy = create.isPending || update.isPending || remove.isPending
  const onlyOne = blogs.length <= 1

  const addBlog = async () => {
    setBanner(null)
    if (newTitle.trim().length < 2) {
      setBanner('Give the blog a title.')
      return
    }
    try {
      await create.mutateAsync({ title: newTitle.trim() })
      setNewTitle('')
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  const saveRename = async () => {
    if (!editing) return
    setBanner(null)
    try {
      await update.mutateAsync({ id: editing.id, input: { title: editTitle.trim() } })
      setEditing(null)
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBanner(null)
    try {
      await remove.mutateAsync({
        id: deleting.id,
        reassignTo: reassignTo === '' ? undefined : reassignTo,
      })
      setDeleting(null)
      setReassignTo('')
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  /** Where a doomed blog's articles could go — anywhere but itself. */
  const destinations = blogs.filter((blog) => blog.id !== deleting?.id)

  return (
    <Box>
      <PageHeader
        title="Blogs"
        subtitle="Every article belongs to one blog, and each blog has its own page on the site."
        actions={
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/content/articles/new')}
          >
            Write an article
          </Button>
        }
      />

      {(banner || error) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={banner ? () => setBanner(null) : undefined}>
          {banner ?? errorText(error)}
        </Alert>
      )}

      {deleting && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Delete “{deleting.title}”?
          </Typography>
          {deleting.article_count > 0 ? (
            <>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                It holds {deleting.article_count}{' '}
                {deleting.article_count === 1 ? 'article' : 'articles'}. Choose where they should go
                — nothing is deleted with the blog.
              </Typography>
              <TextField
                select
                size="small"
                label="Move articles to"
                placeholder="Choose a blog"
                value={reassignTo}
                onChange={(event) => setReassignTo(Number(event.target.value))}
                sx={{ mb: 1.5, minWidth: 240, bgcolor: 'background.paper' }}
              >
                {destinations.map((blog) => (
                  <MenuItem key={blog.id} value={blog.id}>
                    {blog.title}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              It has no articles in it.
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={confirmDelete}
              disabled={busy || (deleting.article_count > 0 && reassignTo === '')}
            >
              {deleting.article_count > 0 ? 'Move and delete' : 'Delete'}
            </Button>
          </Stack>
        </Alert>
      )}

      <Card variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Handle</TableCell>
                <TableCell align="right">Articles</TableCell>
                <TableCell align="right">Published</TableCell>
                <TableCell>Last published</TableCell>
                <TableCell>Comments</TableCell>
                <TableCell align="right" sx={{ width: 110 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && blogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      No blogs yet. Add one below and articles can be filed into it.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {blogs.map((blog) => (
                <TableRow key={blog.id} hover data-blog-id={blog.id}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {editing?.id === blog.id ? (
                      <TextField
                        size="small"
                        autoFocus
                        label="Title"
                        placeholder="Journal"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void saveRename()
                          if (event.key === 'Escape') setEditing(null)
                        }}
                        sx={{ minWidth: 220 }}
                      />
                    ) : (
                      blog.title
                    )}
                  </TableCell>

                  <TableCell sx={{ color: tokens.subdued }}>/blog/{blog.slug}</TableCell>

                  <TableCell align="right">
                    {/* The count is the way into the articles it holds, which is
                        what someone looking at this screen usually wants next. */}
                    {blog.article_count > 0 ? (
                      <MuiLink
                        component="button"
                        type="button"
                        underline="always"
                        sx={{ color: tokens.info, fontSize: 'inherit', cursor: 'pointer' }}
                        onClick={() => navigate(`/content/articles?blog_id=${blog.id}`)}
                      >
                        {blog.article_count}
                      </MuiLink>
                    ) : (
                      <Typography variant="body2" sx={{ color: tokens.subdued }}>
                        0
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">{blog.published_count}</TableCell>

                  <TableCell sx={{ color: tokens.subdued }}>
                    {formatRelative(blog.last_published_at)}
                  </TableCell>

                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={blog.comments_policy ?? 'disabled'}
                      disabled={update.isPending}
                      onChange={(event) => {
                        const policy = event.target.value as Blog['comments_policy']
                        update.mutate(
                          { id: blog.id, input: { title: blog.title, comments_policy: policy } },
                          { onError: (caught) => setBanner(errorText(caught)) },
                        )
                      }}
                      slotProps={{ htmlInput: { 'aria-label': `Comments on ${blog.title}` } }}
                      sx={{ minWidth: 190 }}
                    >
                      {Object.entries(COMMENTS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>

                  <TableCell align="right">
                    {editing?.id === blog.id ? (
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button size="small" variant="contained" onClick={saveRename} disabled={busy}>
                          Save
                        </Button>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <IconButton
                          size="small"
                          aria-label={`Rename ${blog.title}`}
                          onClick={() => {
                            setEditing(blog)
                            setEditTitle(blog.title)
                            setDeleting(null)
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Delete ${blog.title}`}
                          disabled={onlyOne}
                          onClick={() => {
                            setDeleting(blog)
                            setReassignTo('')
                            setEditing(null)
                            setBanner(null)
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {onlyOne && !isLoading && blogs.length === 1 && (
        <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 1.5 }}>
          Articles have to belong to a blog, so the last one cannot be deleted.
        </Typography>
      )}

      <Card variant="outlined" sx={{ mt: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Add a blog
        </Typography>
        {/* Bottom-aligned, not top-aligned. This theme puts the label above the
            field as a sibling rather than floating it inside, so a row aligned
            to the top lines the button up with the word "Title" instead of with
            the box. Their bottom edges are the thing that should agree. */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { xs: 'stretch', sm: 'flex-end' } }}
        >
          <TextField
            size="small"
            label="Title"
            placeholder="News"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addBlog()
            }}
            sx={{ minWidth: 280 }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={addBlog} disabled={busy}>
            Add
          </Button>
        </Stack>
        <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 1 }}>
          The handle is made from the title, and becomes the blog's address on the site.
        </Typography>
      </Card>
    </Box>
  )
}
