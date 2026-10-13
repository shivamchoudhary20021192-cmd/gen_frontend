import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { tokens } from '../../../theme'
import type { Hotspot, HotspotInput } from './useSections'

/**
 * Pin a label to a point on a photograph.
 *
 * "Cap — 50% PCR" on a packaging diagram and "highlight milk — apply to bare
 * skin" on a model shot are the same thing: a dot on a picture with words
 * attached. One editor serves both.
 *
 * **Coordinates are percentages, never pixels.** The photograph is rendered at
 * whatever width the screen allows — a wide desktop, a phone, this editor at
 * 640px — and a label measured in pixels slides off the cap on every size but
 * the one it was placed at.
 */

interface Draft extends HotspotInput {
  /** Local only, so React can key rows that have never been saved. */
  key: string
}

function toDraft(hotspot: Hotspot): Draft {
  return {
    key: `saved-${hotspot.id}`,
    x_pct: hotspot.x,
    y_pct: hotspot.y,
    label: hotspot.label,
    body: hotspot.body ?? '',
    product_id: null,
    line_direction: hotspot.line_direction,
  }
}

export function HotspotEditor({
  open,
  image,
  hotspots,
  onClose,
  onSave,
  saving = false,
}: {
  open: boolean
  /** The photograph the pins sit on. */
  image: string | null
  hotspots: Hotspot[]
  onClose: () => void
  onSave: (hotspots: HotspotInput[]) => void
  saving?: boolean
}) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragging = useRef<number | null>(null)

  // Seeded per opening, not per mount: the dialog stays mounted between
  // openings and would otherwise show the last block's pins.
  useEffect(() => {
    if (!open) return
    setDrafts(hotspots.map(toDraft))
    setSelected(hotspots.length > 0 ? 0 : null)
  }, [open, hotspots])

  /** Where a pointer event landed, as a percentage of the rendered image. */
  const percentageAt = (event: { clientX: number; clientY: number }) => {
    const element = imageRef.current
    if (!element) return null
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
    }
  }

  const addAt = (event: React.MouseEvent) => {
    // A click that ends a drag is not a request for another pin.
    if (dragging.current !== null) return
    const point = percentageAt(event)
    if (!point) return
    setDrafts((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${current.length}`,
        x_pct: Number(point.x.toFixed(2)),
        y_pct: Number(point.y.toFixed(2)),
        label: '',
        body: '',
        product_id: null,
        line_direction: point.x > 50 ? 'left' : 'right',
      },
    ])
    setSelected(drafts.length)
  }

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)))

  const remove = (index: number) => {
    setDrafts((current) => current.filter((_, i) => i !== index))
    setSelected(null)
  }

  // Dragging is handled on the container rather than the pin so the pointer can
  // leave the dot without the drag stopping, which is what happens whenever
  // someone moves faster than React re-renders.
  const onPointerMove = (event: React.PointerEvent) => {
    if (dragging.current === null) return
    const point = percentageAt(event)
    if (!point) return
    update(dragging.current, {
      x_pct: Number(point.x.toFixed(2)),
      y_pct: Number(point.y.toFixed(2)),
    })
  }

  const stopDragging = () => {
    if (dragging.current === null) return
    // Cleared after the click event that follows a drag, so releasing a pin
    // does not also drop a new one where it landed.
    const wasDragging = dragging.current
    dragging.current = null
    setSelected(wasDragging)
  }

  const save = () => {
    onSave(
      drafts
        // A pin with no words is a dot nobody can read. Dropped rather than
        // saved, so a mis-click does not become content.
        .filter((draft) => draft.label.trim().length > 0)
        .map((draft) => ({
          x_pct: draft.x_pct,
          y_pct: draft.y_pct,
          label: draft.label.trim(),
          body: draft.body?.trim() || null,
          product_id: draft.product_id ?? null,
          line_direction: draft.line_direction,
        })),
    )
  }

  const unlabelled = drafts.filter((draft) => draft.label.trim().length === 0).length

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Pin the labels</DialogTitle>
      <DialogContent>
        {!image && (
          <Alert severity="warning">
            This block has no picture yet. Add one first — a label needs something to be pinned to.
          </Alert>
        )}

        {image && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box
              sx={{ position: 'relative', flex: 1, minWidth: 0, userSelect: 'none' }}
              onPointerMove={onPointerMove}
              onPointerUp={stopDragging}
              onPointerLeave={stopDragging}
            >
              <Box
                component="img"
                ref={imageRef}
                src={image}
                alt=""
                draggable={false}
                onClick={addAt}
                data-hotspot-canvas
                sx={{
                  width: '100%',
                  display: 'block',
                  borderRadius: 1.5,
                  cursor: 'crosshair',
                  border: `1px solid ${tokens.border}`,
                }}
              />

              {drafts.map((draft, index) => (
                <Box
                  key={draft.key}
                  data-hotspot-pin={index}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    dragging.current = index
                    setSelected(index)
                  }}
                  onClick={(event) => event.stopPropagation()}
                  sx={{
                    position: 'absolute',
                    left: `${draft.x_pct}%`,
                    top: `${draft.y_pct}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    bgcolor: index === selected ? tokens.ink : alpha(tokens.ink, 0.62),
                    border: '2px solid #FFFFFF',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    cursor: 'grab',
                    touchAction: 'none',
                  }}
                >
                  {index + 1}
                </Box>
              ))}
            </Box>

            <Box sx={{ width: { xs: '100%', md: 340 } }}>
              <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mb: 1 }}>
                Click the photograph to drop a pin. Drag a pin to move it.
              </Typography>

              {drafts.length === 0 && (
                <Alert severity="info">No pins yet. Click where the label should point.</Alert>
              )}

              <Stack spacing={1.5}>
                {drafts.map((draft, index) => (
                  <Box
                    key={draft.key}
                    data-hotspot-row={index}
                    onClick={() => setSelected(index)}
                    sx={{
                      border: `1px solid ${index === selected ? tokens.ink : tokens.border}`,
                      borderRadius: 1.5,
                      p: 1.5,
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {index + 1}
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Cap"
                        label="Label"
                        value={draft.label}
                        onChange={(event) => update(index, { label: event.target.value })}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Remove pin ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="50% PCR"
                      label="Note"
                      value={draft.body ?? ''}
                      onChange={(event) => update(index, { body: event.target.value })}
                      sx={{ mb: 1 }}
                    />
                    <TextField
                      select
                      size="small"
                      fullWidth
                      label="Line points"
                      value={draft.line_direction ?? 'right'}
                      onChange={(event) =>
                        update(index, { line_direction: event.target.value as Draft['line_direction'] })
                      }
                    >
                      <MenuItem value="left">Left</MenuItem>
                      <MenuItem value="right">Right</MenuItem>
                      <MenuItem value="up">Up</MenuItem>
                      <MenuItem value="down">Down</MenuItem>
                    </TextField>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {unlabelled > 0 && (
          <Typography variant="caption" sx={{ color: tokens.subdued, mr: 'auto', pl: 2 }}>
            {unlabelled} pin{unlabelled === 1 ? '' : 's'} with no label will be dropped.
          </Typography>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !image}>
          Save pins
        </Button>
      </DialogActions>
    </Dialog>
  )
}
