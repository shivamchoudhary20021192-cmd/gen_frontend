import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  alpha,
} from '@mui/material'
import { useCallback, useRef, useState } from 'react'
import { ApiError, uploadMedia } from '../../api/client'
import type { Media } from '../../api/types'
import { formatBytes } from '../../lib/format'
import { tokens } from '../../theme'

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,application/pdf'
const MAX_BYTES = 25 * 1024 * 1024
const MAX_FILES = 20

interface QueuedFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  percent: number
  error?: string
}

interface MediaUploadZoneProps {
  folderId?: number
  onUploaded(media: Media[]): void
  compact?: boolean
}

export function MediaUploadZone({ folderId, onUploaded, compact = false }: MediaUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)

  const startUpload = useCallback(
    async (files: File[]) => {
      setFatal(null)

      // Reject client-side for the obvious cases so the user is not made to
      // wait for 40MB to travel before being told it was too big.
      const rejected: QueuedFile[] = []
      const accepted: File[] = []
      for (const file of files.slice(0, MAX_FILES)) {
        if (file.size > MAX_BYTES) {
          rejected.push({
            file,
            status: 'error',
            percent: 0,
            error: `Exceeds the ${formatBytes(MAX_BYTES)} limit`,
          })
        } else {
          accepted.push(file)
        }
      }

      if (files.length > MAX_FILES) {
        setFatal(`Only the first ${MAX_FILES} files were queued.`)
      }

      setQueue([
        ...accepted.map<QueuedFile>((file) => ({ file, status: 'uploading', percent: 0 })),
        ...rejected,
      ])

      if (accepted.length === 0) return

      setBusy(true)
      try {
        const result = await uploadMedia(accepted, {
          folderId,
          onProgress: ({ percent }) => {
            // One multipart request carries the whole batch, so progress is
            // shared. Showing each row at the batch percentage is honest;
            // faking per-file progress would not be.
            setQueue((current) =>
              current.map((item) => (item.status === 'uploading' ? { ...item, percent } : item)),
            )
          },
        })
        setQueue((current) =>
          current.map((item) =>
            item.status === 'uploading' ? { ...item, status: 'done', percent: 100 } : item,
          ),
        )
        onUploaded(result.media)
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Upload failed'
        setFatal(message)
        setQueue((current) =>
          current.map((item) =>
            item.status === 'uploading' ? { ...item, status: 'error', error: message } : item,
          ),
        )
      } finally {
        setBusy(false)
      }
    },
    [folderId, onUploaded],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragging(false)
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) void startUpload(files)
    },
    [startUpload],
  )

  return (
    <Stack spacing={2}>
      <Box
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        sx={{
          border: '1.5px dashed',
          borderColor: dragging ? tokens.ink : tokens.border,
          bgcolor: dragging ? alpha(tokens.sand, 0.35) : tokens.ivory,
          borderRadius: 2,
          px: 3,
          py: compact ? 3 : 6,
          textAlign: 'center',
          cursor: busy ? 'progress' : 'pointer',
          transition: 'border-color 120ms ease, background-color 120ms ease',
          '&:hover': { borderColor: tokens.taupe },
        }}
      >
        <CloudUploadIcon sx={{ fontSize: compact ? 28 : 40, color: tokens.taupe, mb: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {dragging ? 'Drop to upload' : 'Drag images here, or click to browse'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          JPEG, PNG, WebP, AVIF, MP4 or PDF · up to {formatBytes(MAX_BYTES)} each · {MAX_FILES} at a time
        </Typography>
        <Button variant="outlined" size="small" sx={{ mt: 2 }} disabled={busy}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={ACCEPTED}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length > 0) void startUpload(files)
            // Reset so re-selecting the same file fires change again.
            event.target.value = ''
          }}
        />
      </Box>

      {fatal && <Alert severity="error">{fatal}</Alert>}

      {queue.length > 0 && (
        <List dense disablePadding>
          {queue.map((item, index) => (
            <ListItem key={`${item.file.name}-${index}`} disableGutters sx={{ alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                {item.status === 'done' && <TaskAltIcon fontSize="small" color="success" />}
                {item.status === 'error' && <ErrorOutlineIcon fontSize="small" color="error" />}
                {item.status === 'uploading' && <CloudUploadIcon fontSize="small" color="disabled" />}
              </ListItemIcon>
              <ListItemText
                primary={item.file.name}
                secondary={
                  item.status === 'error' ? (
                    <Typography variant="caption" color="error">
                      {item.error}
                    </Typography>
                  ) : item.status === 'done' ? (
                    <Typography variant="caption" color="text.secondary">
                      Uploaded · {formatBytes(item.file.size)} · generating sizes…
                    </Typography>
                  ) : (
                    <Box sx={{ mt: 0.5 }}>
                      <LinearProgress variant="determinate" value={item.percent} />
                    </Box>
                  )
                }
                slotProps={{
                  primary: { variant: 'body2', noWrap: true },
                  // secondary renders a <p> by default, and the progress bar is
                  // a <div> — invalid nesting that React logs as an error.
                  secondary: { component: 'div' },
                }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  )
}
