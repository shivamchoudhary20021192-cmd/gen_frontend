import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import SearchIcon from '@mui/icons-material/Search'
import UploadIcon from '@mui/icons-material/Upload'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import type { Media } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import { MediaDetailsPanel } from './MediaDetailsPanel'
import { MediaThumb } from './MediaThumb'
import { MediaUploadZone } from './MediaUploadZone'
import { useCreateFolder, useDeleteMedia, useMediaFolders, useMediaList } from './useMedia'

const PAGE_SIZE = 36

export function MediaLibraryPage() {
  const { can } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [folderId, setFolderId] = useState<number | ''>('')
  const [mediaType, setMediaType] = useState('')
  const [page, setPage] = useState(1)
  const [focused, setFocused] = useState<Media | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: search || undefined,
      folder_id: folderId === '' ? undefined : folderId,
      media_type: mediaType || undefined,
      sort: 'created_at:desc',
    }),
    [page, search, folderId, mediaType],
  )

  const list = useMediaList(params)
  const folders = useMediaFolders()
  const createFolder = useCreateFolder()
  const remove = useDeleteMedia()

  const rows = list.data?.media ?? []
  const pagination = list.data?.pagination

  const handleDelete = () => {
    if (!focused) return
    setError(null)
    remove.mutate(focused.id, {
      onSuccess: () => setFocused(null),
      onError: (caught) => {
        // The API refuses to delete anything still attached to a product.
        setError(caught instanceof ApiError ? caught.message : 'Could not delete this file.')
      },
    })
  }

  return (
    <Box>
      <PageHeader
        title="Media"
        subtitle={pagination ? `${pagination.total} files` : undefined}
        actions={
          <>
            {can('media.upload') && (
              <Button variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={() => setFolderOpen(true)}>
                New folder
              </Button>
            )}
            {can('media.upload') && (
              <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>
                Upload
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ display: 'flex', minHeight: 480 }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2 }}>
            <TextField
            label="Search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search filename or alt text"
              sx={{ flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              label="Folder"
              value={folderId}
              onChange={(event) => {
                setFolderId(event.target.value === '' ? '' : Number(event.target.value))
                setPage(1)
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All folders</MenuItem>
              {(folders.data?.folders ?? []).map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {'— '.repeat(folder.depth)}
                  {folder.name} ({folder.media_count})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Type"
              value={mediaType}
              onChange={(event) => {
                setMediaType(event.target.value)
                setPage(1)
              }}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All types</MenuItem>
              <MenuItem value="image">Images</MenuItem>
              <MenuItem value="video">Video</MenuItem>
              <MenuItem value="document">Documents</MenuItem>
            </TextField>
          </Stack>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 2 }}>
            {list.isLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
                <CircularProgress size={26} />
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {search ? `Nothing matches “${search}”.` : 'The library is empty.'}
                </Typography>
                {can('media.upload') && (
                  <Button variant="outlined" onClick={() => setUploadOpen(true)}>
                    Upload files
                  </Button>
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 1.25,
                }}
              >
                {rows.map((media) => (
                  <MediaThumb
                    key={media.id}
                    media={media}
                    selectable={false}
                    focused={focused?.id === media.id}
                    onFocus={setFocused}
                  />
                ))}
              </Box>
            )}
          </Box>

          {pagination && pagination.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderTop: `1px solid ${tokens.border}` }}>
              <Pagination
                size="small"
                count={pagination.pages}
                page={pagination.page}
                onChange={(_, value) => setPage(value)}
              />
            </Box>
          )}
        </Box>

        <Box
          sx={{
            width: 300,
            flexShrink: 0,
            borderLeft: `1px solid ${tokens.border}`,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <MediaDetailsPanel media={focused} />
          </Box>
          {focused && can('media.delete') && (
            <Box sx={{ p: 2, borderTop: `1px solid ${tokens.border}` }}>
              <Button
                fullWidth
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleDelete}
                disabled={remove.isPending || focused.usage_count > 0}
              >
                {focused.usage_count > 0 ? `In use (${focused.usage_count})` : 'Delete file'}
              </Button>
            </Box>
          )}
        </Box>
      </Card>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upload files</DialogTitle>
        <DialogContent>
          <MediaUploadZone
            folderId={folderId === '' ? undefined : folderId}
            onUploaded={() => void list.refetch()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={folderOpen} onClose={() => setFolderOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Folder name"
            placeholder="Campaign — spring"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!folderName.trim() || createFolder.isPending}
            onClick={() =>
              createFolder.mutate(
                { name: folderName.trim(), parent_id: folderId === '' ? null : folderId },
                {
                  onSuccess: () => {
                    setFolderName('')
                    setFolderOpen(false)
                  },
                },
              )
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
