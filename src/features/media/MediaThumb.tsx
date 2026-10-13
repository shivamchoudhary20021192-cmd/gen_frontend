import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DescriptionIcon from '@mui/icons-material/Description'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import VideocamIcon from '@mui/icons-material/Videocam'
import { Box, CircularProgress, Typography, alpha } from '@mui/material'
import type { Media } from '../../api/types'
import { formatDuration, hasPicture, objectPosition, thumbUrl } from '../../lib/mediaUrl'
import { tokens } from '../../theme'

interface MediaThumbProps {
  media: Media
  selected?: boolean
  selectable?: boolean
  focused?: boolean
  onToggle?(media: Media): void
  onFocus?(media: Media): void
}

/**
 * A single library tile. Shopify's picker keeps the checkbox hidden until the
 * tile is hovered or selected — visible checkboxes on every tile make a wall of
 * product shots read as a form rather than a gallery.
 */
export function MediaThumb({
  media,
  selected = false,
  selectable = true,
  focused = false,
  onToggle,
  onFocus,
}: MediaThumbProps) {
  // A video has a still too — the frame taken out of it on upload — so the
  // question the tile asks is "is there a picture", not "is it an image".
  // Falling back to the icon only when there genuinely is nothing to show.
  const isVideo = media.media_type === 'video'
  const isImage = hasPicture(media)
  const processing = media.status === 'processing' || media.status === 'uploading'
  const failed = media.status === 'failed'

  return (
    <Box
      onClick={() => {
        onFocus?.(media)
        if (selectable) onToggle?.(media)
      }}
      role={selectable ? 'checkbox' : 'button'}
      aria-checked={selectable ? selected : undefined}
      aria-label={media.alt_text ?? media.original_filename}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onFocus?.(media)
          if (selectable) onToggle?.(media)
        }
      }}
      sx={{
        position: 'relative',
        aspectRatio: '1 / 1',
        borderRadius: 1.5,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: media.dominant_color ?? tokens.ivory,
        outline: '2px solid',
        outlineOffset: focused && !selected ? '1px' : 0,
        outlineColor: selected ? tokens.ink : focused ? tokens.taupe : 'transparent',
        transition: 'outline-color 120ms ease, transform 120ms ease',
        '&:hover': { transform: 'translateY(-1px)' },
        '&:hover .media-check, &:focus-visible .media-check': { opacity: 1 },
        '&:focus-visible': { outlineColor: tokens.ink },
      }}
    >
      {isImage ? (
        <Box
          component="img"
          src={thumbUrl(media, 'sm')}
          alt={media.alt_text ?? ''}
          loading="lazy"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: objectPosition(media.focal_point),
            display: 'block',
            // The LQIP holds the tile's colour until the real file paints,
            // so a scrolling grid does not flash white.
            backgroundImage: media.placeholder ? `url(${media.placeholder})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', color: tokens.taupe }}>
          {isVideo ? <VideocamIcon fontSize="large" /> : <DescriptionIcon fontSize="large" />}
        </Box>
      )}

      {/* A still from a film still looks like a photograph. The badge is what
          says it moves, and the duration is what says how long for. */}
      {isVideo && isImage && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              borderRadius: '50%',
              bgcolor: alpha('#000000', 0.55),
              color: '#FFFFFF',
            }}
          >
            <PlayArrowIcon fontSize="small" />
          </Box>
        </Box>
      )}

      {isVideo && formatDuration(media.duration_ms) && (
        <Box
          sx={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            px: 0.75,
            py: 0.125,
            borderRadius: 1,
            bgcolor: alpha('#000000', 0.65),
            color: '#FFFFFF',
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}
        >
          {formatDuration(media.duration_ms)}
        </Box>
      )}

      {selectable && (
        <Box
          className="media-check"
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            opacity: selected ? 1 : 0,
            transition: 'opacity 120ms ease',
            color: selected ? tokens.ink : tokens.white,
            bgcolor: selected ? tokens.white : alpha(tokens.ink, 0.35),
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
          }}
        >
          {selected ? (
            <CheckCircleIcon sx={{ fontSize: 22 }} />
          ) : (
            <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />
          )}
        </Box>
      )}

      {processing && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(tokens.ink, 0.35),
            color: tokens.white,
          }}
        >
          <CircularProgress size={22} color="inherit" />
        </Box>
      )}

      {failed && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            gap: 0.5,
            bgcolor: alpha(tokens.danger, 0.85),
            color: tokens.white,
          }}
        >
          <ErrorOutlineIcon />
          <Typography variant="caption">Processing failed</Typography>
        </Box>
      )}

      {/* Missing alt text is an accessibility defect the BRD makes a launch
          gate, so it is surfaced on the tile rather than buried in a panel. */}
      {isImage && !media.alt_text && !processing && !failed && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            insetInline: 0,
            px: 0.75,
            py: 0.25,
            bgcolor: alpha(tokens.warning, 0.9),
            color: tokens.white,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600 }}>
            No alt text
          </Typography>
        </Box>
      )}
    </Box>
  )
}
