import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material'
import { useState } from 'react'
import type { Media } from '../../api/types'
import { MediaPicker } from '../media/MediaPicker'
import { tokens } from '../../theme'

export interface SelectedImage {
  media_id: number
  url: string
  alt: string | null
  is_primary: boolean
}

interface ProductMediaCardProps {
  images: SelectedImage[]
  onChange(images: SelectedImage[]): void
  max?: number
}

/**
 * The product-form media card, mirroring Shopify's: a grid of thumbnails you
 * reorder by dragging, where the first one is the featured image and everything
 * flows from a single "Add images" button that opens the library dialog.
 *
 * Reorder uses native HTML5 drag events rather than a drag library — for a
 * handful of thumbnails it is enough, and it keeps the dependency list to what
 * the project actually agreed to install.
 */
export function ProductMediaCard({ images, onChange, max = 20 }: ProductMediaCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const handleSelect = (selection: Media[]) => {
    const existing = new Map(images.map((image) => [image.media_id, image]))
    for (const media of selection) {
      if (existing.has(media.id)) continue
      if (existing.size >= max) break
      existing.set(media.id, {
        media_id: media.id,
        url: media.url,
        alt: media.alt_text,
        is_primary: false,
      })
    }
    onChange(normalise(Array.from(existing.values())))
  }

  const remove = (mediaId: number) => {
    onChange(normalise(images.filter((image) => image.media_id !== mediaId)))
  }

  const setPrimary = (mediaId: number) => {
    // Featured is position 0, the way Shopify treats it — one concept, not two
    // that can disagree.
    const target = images.find((image) => image.media_id === mediaId)
    if (!target) return
    onChange(normalise([target, ...images.filter((image) => image.media_id !== mediaId)]))
  }

  const drop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const next = images.slice()
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    onChange(normalise(next))
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <Card>
      <CardHeader
        title="Media"
        subheader={
          images.length === 0
            ? 'The first image becomes the featured image.'
            : `${images.length} of ${max} · drag to reorder`
        }
        slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
        action={
          <Button
            size="small"
            startIcon={<AddPhotoAlternateIcon />}
            onClick={() => setPickerOpen(true)}
            disabled={images.length >= max}
          >
            Add images
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {images.length === 0 ? (
          <Box
            onClick={() => setPickerOpen(true)}
            role="button"
            aria-label="Browse the media library"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setPickerOpen(true)
            }}
            sx={{
              border: `1.5px dashed ${tokens.border}`,
              borderRadius: 2,
              bgcolor: tokens.ivory,
              py: 5,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { borderColor: tokens.taupe },
            }}
          >
            <AddPhotoAlternateIcon sx={{ fontSize: 32, color: tokens.taupe }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Add images from your library, or upload new ones
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
              gap: 1.25,
            }}
          >
            {images.map((image, index) => (
              <Box
                key={image.media_id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOverIndex(index)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  drop(index)
                }}
                sx={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  border: '2px solid',
                  borderColor:
                    overIndex === index && dragIndex !== index
                      ? tokens.ink
                      : index === 0
                        ? tokens.taupe
                        : 'transparent',
                  opacity: dragIndex === index ? 0.4 : 1,
                  cursor: 'grab',
                  bgcolor: tokens.ivory,
                  '&:hover .image-actions': { opacity: 1 },
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.alt ?? ''}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />

                {index === 0 && (
                  <Chip
                    size="small"
                    label="Featured"
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      height: 20,
                      fontSize: 10,
                      bgcolor: alpha(tokens.ink, 0.82),
                      color: tokens.white,
                    }}
                  />
                )}

                <Box
                  className="image-actions"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 0.25,
                    opacity: 0,
                    transition: 'opacity 120ms ease',
                  }}
                >
                  {index !== 0 && (
                    <Tooltip title="Make featured">
                      <IconButton
                        size="small"
                        onClick={() => setPrimary(image.media_id)}
                        sx={actionButtonSx}
                      >
                        <StarBorderIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {index === 0 && (
                    <IconButton size="small" disabled sx={actionButtonSx}>
                      <StarIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                  <Tooltip title="Remove">
                    <IconButton
                      size="small"
                      onClick={() => remove(image.media_id)}
                      sx={actionButtonSx}
                    >
                      <CloseIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <DragIndicatorIcon
                  className="image-actions"
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    fontSize: 16,
                    color: tokens.white,
                    opacity: 0,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))',
                    transition: 'opacity 120ms ease',
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        multiple
        maxSelection={max}
        initialSelectedIds={images.map((image) => image.media_id)}
        title="Add product images"
        confirmLabel="Add"
      />
    </Card>
  )
}

const actionButtonSx = {
  bgcolor: alpha(tokens.ink, 0.7),
  color: tokens.white,
  width: 22,
  height: 22,
  '&:hover': { bgcolor: alpha(tokens.ink, 0.9) },
  '&.Mui-disabled': { bgcolor: alpha(tokens.ink, 0.7), color: tokens.white },
} as const

/** Position is implicit in array order; primary is always index 0. */
function normalise(images: SelectedImage[]): SelectedImage[] {
  return images.map((image, index) => ({ ...image, is_primary: index === 0 }))
}
