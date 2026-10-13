import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { ApiError } from '../../../api/client'
import { tokens } from '../../../theme'
import {
  useBlogs,
  useCreateBlog,
  useDeleteBlog,
  useUpdateBlog,
  type Blog,
} from './useBlogs'

/**
 * Create, rename and delete blogs.
 *
 * A dialog on the Journal rather than its own screen, the way Shopify does it:
 * a shop sets these up once and then writes articles for years. Burying it in a
 * dialog keeps the sidebar from growing a row that is opened twice a year.
 *
 * Deleting is the only dangerous thing here, and the API is strict about it —
 * a blog holding articles needs somewhere to move them, and the last blog
 * cannot go at all. This surfaces both rather than letting the person find out
 * from an error.
 */

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function ManageBlogsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useBlogs()
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Blogs</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: tokens.subdued, mb: 2 }}>
          Every article belongs to one blog, and each blog has its own page on the site.
        </Typography>

        {banner && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
            {banner}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        )}

        <Stack spacing={1.5}>
          {blogs.map((blog) => (
            <Box
              key={blog.id}
              data-blog-id={blog.id}
              sx={{
                border: `1px solid ${tokens.border}`,
                borderRadius: 1,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {editing?.id === blog.id ? (
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    label="Title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void saveRename()
                      if (event.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {blog.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      /blog/{blog.slug} · {blog.article_count}{' '}
                      {blog.article_count === 1 ? 'article' : 'articles'}
                      {blog.published_count !== blog.article_count &&
                        ` (${blog.published_count} published)`}
                    </Typography>
                  </>
                )}
              </Box>

              {editing?.id === blog.id ? (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button size="small" variant="contained" onClick={saveRename} disabled={busy}>
                    Save
                  </Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    aria-label={`Rename ${blog.title}`}
                    onClick={() => {
                      setEditing(blog)
                      setEditTitle(blog.title)
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${blog.title}`}
                    disabled={blogs.length <= 1}
                    onClick={() => {
                      setDeleting(blog)
                      setReassignTo('')
                      setBanner(null)
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            </Box>
          ))}
        </Stack>

        {blogs.length === 1 && (
          <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 1.5 }}>
            Articles have to belong to a blog, so the last one cannot be deleted.
          </Typography>
        )}

        {deleting && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Delete “{deleting.title}”?
            </Typography>
            {deleting.article_count > 0 ? (
              <>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  It holds {deleting.article_count}{' '}
                  {deleting.article_count === 1 ? 'article' : 'articles'}. Choose where they should
                  go — nothing is deleted with the blog.
                </Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Move articles to"
                  value={reassignTo}
                  onChange={(event) => setReassignTo(Number(event.target.value))}
                  sx={{ mb: 1.5, bgcolor: 'background.paper' }}
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

        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${tokens.border}` }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Add a blog
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="News"
              label="Title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addBlog()
              }}
            />
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addBlog} disabled={busy}>
              Add
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 0.75 }}>
            The handle is made from the title, and becomes the blog's address on the site.
          </Typography>
        </Box>

        {create.isSuccess && !banner && (
          <Chip size="small" label="Blog added" sx={{ mt: 1.5, bgcolor: '#E3F3E6', color: '#1B5E20' }} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}
