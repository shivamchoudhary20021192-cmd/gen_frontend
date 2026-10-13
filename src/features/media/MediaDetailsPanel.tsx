import CheckIcon from '@mui/icons-material/Check'
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import type { Media } from '../../api/types'
import { formatBytes, formatRelative } from '../../lib/format'
import { formatDuration, objectPosition, thumbUrl } from '../../lib/mediaUrl'
import { tokens } from '../../theme'
import { useUpdateMedia } from './useMedia'

interface MediaDetailsPanelProps {
  media: Media | null
}

/**
 * The side panel of the picker. Editing alt text HERE, at the moment someone is
 * choosing the image, is the only reliable way it gets written — nobody returns
 * to a media library later to fix accessibility.
 */
export function MediaDetailsPanel({ media }: MediaDetailsPanelProps) {
  const update = useUpdateMedia()
  const [altText, setAltText] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAltText(media?.alt_text ?? '')
    setSaved(false)
  }, [media?.id, media?.alt_text])

  if (!media) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">Select a file to see its details.</Typography>
      </Box>
    )
  }

  const dirty = altText.trim() !== (media.alt_text ?? '')

  const save = () => {
    update.mutate(
      { id: media.id, patch: { alt_text: altText.trim() || null } },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      },
    )
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box
        sx={{
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: media.dominant_color ?? tokens.ivory,
          aspectRatio: '1 / 1',
        }}
      >
        {/* A video is played here rather than shown as a frozen frame: the
            reason to open a video in the library is to watch it and decide
            whether it is the take you want. The poster holds the space until
            the first byte arrives. */}
        {media.media_type === 'video' ? (
          <Box
            component="video"
            src={media.url}
            poster={media.poster_url ?? undefined}
            controls
            playsInline
            preload="metadata"
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          media.media_type === 'image' && (
            <Box
              component="img"
              src={thumbUrl(media, 'md')}
              alt={media.alt_text ?? ''}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: objectPosition(media.focal_point),
                display: 'block',
              }}
            />
          )
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" noWrap title={media.original_filename}>
          {media.original_filename}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {media.width && media.height ? `${media.width} × ${media.height} · ` : ''}
          {media.media_type === 'video' && formatDuration(media.duration_ms)
            ? `${formatDuration(media.duration_ms)} · `
            : ''}
          {formatBytes(media.size_bytes)} · {formatRelative(media.created_at)}
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={1}>
        <TextField
          label="Alt text"
          placeholder={
            media.media_type === 'video'
              ? 'Model applying the serum, filmed in daylight'
              : 'Amber glass serum bottle on a linen background'
          }
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 255 } }}
          helperText={
            media.media_type === 'video'
              ? 'Describe what happens in the film, for screen readers and SEO.'
              : 'Describe what the image shows, for screen readers and SEO.'
          }
        />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="contained"
            onClick={save}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? 'Saving…' : 'Save alt text'}
          </Button>
          {saved && (
            <Typography
              variant="caption"
              color="success.main"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
            >
              <CheckIcon sx={{ fontSize: 14 }} /> Saved
            </Typography>
          )}
        </Box>
        {update.isError && <Alert severity="error">Could not save alt text.</Alert>}
      </Stack>

      <Divider />

      <Stack spacing={0.5}>
        <DetailRow label="Type" value={media.mime_type} />
        <DetailRow label="Status" value={media.status} />
        <DetailRow label="Used in" value={`${media.usage_count} place(s)`} />
        <DetailRow label="Renditions" value={String(media.variants?.length ?? 0)} />
        <DetailRow label="Storage" value={media.disk} />
      </Stack>
    </Stack>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 500, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  )
}
