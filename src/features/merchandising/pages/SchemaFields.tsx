import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { Close as ClearIcon, Image as ImageIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { tokens } from '../../../theme'
import { MediaPicker } from '../../media/MediaPicker'
import { LinkTargetPicker, isSearchableLinkType } from '../../../components/LinkTargetPicker'
import type { Field } from './usePageBuilder'

/**
 * One input per field kind, chosen by the schema rather than written by hand.
 *
 * This is what makes the builder extensible: a new section kind in the backend
 * arrives here as a list of `{ key, label, kind }` and is editable immediately.
 * The alternative — a bespoke form per section — is fifteen forms that drift,
 * and a sixteenth section nobody adds because the form is a day's work.
 *
 * Every input reports through one `onChange(value)`. Saving is the caller's
 * problem, because the caller is the only thing that knows whether this field
 * belongs to a section or to a block.
 */

const ICON_NAMES = ['leaf', 'flask', 'shield', 'truck', 'star', 'check']

/** The shelves, for a `shelf` field. Small list, cached. */
function useShelfOptions() {
  return useQuery({
    queryKey: ['shelves', 'options'],
    queryFn: () => api.get<{ shelves: { id: number; title: string; placement: string }[] }>('/merchandising/shelves'),
    staleTime: 5 * 60 * 1000,
  })
}

/** A preview of the chosen media, with a way to change or clear it. */
function MediaField({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (value: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const id = typeof value === 'number' ? value : null

  const preview = useQuery({
    queryKey: ['media', id],
    queryFn: () => api.get<{ media: { id: number; url: string; media_type: string; original_filename: string } }>(
      `/media/${id}`,
    ),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: tokens.subdued }}>
        {field.label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box
          onClick={() => setOpen(true)}
          role="button"
          tabIndex={0}
          aria-label={`Choose ${field.label}`}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setOpen(true)
          }}
          sx={{
            width: 72,
            height: 72,
            flexShrink: 0,
            borderRadius: 1,
            border: `1px dashed ${tokens.border}`,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            cursor: 'pointer',
            bgcolor: tokens.hover,
          }}
        >
          {preview.data?.media?.url ? (
            preview.data.media.media_type === 'video' ? (
              <video src={preview.data.media.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img
                src={preview.data.media.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
          ) : (
            <ImageIcon sx={{ color: tokens.faint }} />
          )}
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
            {id ? 'Change' : 'Choose'}
          </Button>
          {id && (
            <Button size="small" color="inherit" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </Stack>
      </Stack>
      {field.help && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: tokens.faint }}>
          {field.help}
        </Typography>
      )}

      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(selection) => {
          if (selection[0]) onChange(selection[0].id)
          setOpen(false)
        }}
        multiple={false}
        title={field.label}
        defaultMediaType={field.accepts === 'any' ? '' : field.accepts === 'video' ? 'video' : 'image'}
      />
    </Box>
  )
}

/** A link is a type plus a target, in the vocabulary the rest of the CMS uses. */
function LinkField({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (value: { type: string; ref_id: number | null; url: string | null }) => void
}) {
  const link = (value ?? { type: 'none', ref_id: null, url: null }) as {
    type: string
    ref_id: number | null
    url: string | null
  }

  return (
    <Stack spacing={1}>
      <FormControl size="small" fullWidth>
        <InputLabel id={`link-${field.key}`}>{field.label}</InputLabel>
        <Select
          labelId={`link-${field.key}`}
          label={field.label}
          value={link.type || 'none'}
          onChange={(event) => onChange({ type: event.target.value, ref_id: null, url: null })}
        >
          <MenuItem value="none">Nowhere</MenuItem>
          <MenuItem value="url">A web address</MenuItem>
          <MenuItem value="product">A product</MenuItem>
          <MenuItem value="collection">A collection</MenuItem>
          <MenuItem value="category">A category</MenuItem>
          <MenuItem value="page">A page</MenuItem>
        </Select>
      </FormControl>

      {link.type === 'url' && (
        <TextField
          size="small"
          fullWidth
          label="Web address"
          placeholder="/shop?sort=newest"
          value={link.url ?? ''}
          onChange={(event) => onChange({ ...link, url: event.target.value })}
        />
      )}
      {isSearchableLinkType(link.type) && (
        <LinkTargetPicker
          type={link.type as 'product'}
          value={link.ref_id}
          onChange={(id) => onChange({ ...link, ref_id: id })}
          label="Which one"
        />
      )}
    </Stack>
  )
}

export function SchemaField({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (value: unknown) => void
}) {
  const shelves = useShelfOptions()

  switch (field.kind) {
    case 'media':
      return <MediaField field={field} value={value} onChange={onChange} />

    case 'link':
      return <LinkField field={field} value={value} onChange={onChange} />

    case 'product':
    case 'collection':
      return (
        <LinkTargetPicker
          type={field.kind}
          value={(value as number | null) ?? null}
          onChange={(id) => onChange(id)}
          label={field.label}
          helperText={field.help}
        />
      )

    case 'shelf':
      return (
        <FormControl size="small" fullWidth>
          <InputLabel id={`shelf-${field.key}`}>{field.label}</InputLabel>
          <Select
            labelId={`shelf-${field.key}`}
            label={field.label}
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
            data-field={field.key}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {(shelves.data?.shelves ?? []).map((shelf) => (
              <MenuItem key={shelf.id} value={String(shelf.id)}>
                {shelf.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )

    case 'select':
      return (
        <FormControl size="small" fullWidth>
          <InputLabel id={`select-${field.key}`}>{field.label}</InputLabel>
          <Select
            labelId={`select-${field.key}`}
            label={field.label}
            value={(value as string) ?? (field.default as string) ?? ''}
            onChange={(event) => onChange(event.target.value)}
            data-field={field.key}
          >
            {(field.options ?? []).map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )

    case 'icon':
      return (
        <FormControl size="small" fullWidth>
          <InputLabel id={`icon-${field.key}`}>{field.label}</InputLabel>
          <Select
            labelId={`icon-${field.key}`}
            label={field.label}
            value={(value as string) ?? ''}
            onChange={(event) => onChange(event.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {ICON_NAMES.map((name) => (
              <MenuItem key={name} value={name} sx={{ textTransform: 'capitalize' }}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )

    case 'toggle':
      return (
        <FormControlLabel
          control={
            <Switch
              checked={value === undefined ? Boolean(field.default) : Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              data-field={field.key}
            />
          }
          label={field.label}
        />
      )

    case 'number':
      // A slider when the range is small and visual — "products across" is a
      // choice between three answers, and a number box invites someone to type
      // seventeen and wonder why the row looks wrong.
      return (
        <Box>
          <Typography variant="caption" sx={{ color: tokens.subdued }}>
            {field.label}: {String(value ?? field.default ?? field.min ?? 0)}
          </Typography>
          <Slider
            size="small"
            min={field.min ?? 0}
            max={field.max ?? 10}
            value={Number(value ?? field.default ?? field.min ?? 0)}
            onChange={(_event, next) => onChange(Number(next))}
            valueLabelDisplay="auto"
            aria-label={field.label}
            data-field={field.key}
          />
          {field.help && (
            <Typography variant="caption" sx={{ display: 'block', color: tokens.faint }}>
              {field.help}
            </Typography>
          )}
        </Box>
      )

    case 'color':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            label={field.label}
            placeholder="#F6EFE6"
            value={(value as string) ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            type="color"
            aria-label={`${field.label} swatch`}
            value={((value as string) ?? '#ffffff').slice(0, 7)}
            onChange={(event) => onChange(event.target.value)}
            style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          {Boolean(value) && (
            <IconButton size="small" aria-label={`Clear ${field.label}`} onClick={() => onChange(null)}>
              <ClearIcon fontSize="inherit" />
            </IconButton>
          )}
        </Stack>
      )

    case 'richtext':
    case 'textarea':
      return (
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={field.kind === 'richtext' ? 5 : 2}
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.kind === 'richtext' ? field.help ?? 'Basic HTML is allowed — <p>, <strong>, <em>, <a>.' : field.help}
          value={(value as string) ?? ''}
          onChange={(event) => onChange(event.target.value)}
          // On the control rather than the wrapper: a `data-` hook on a MUI
          // root div is a hook onto something nothing can type into.
          slotProps={{ htmlInput: { 'data-field': field.key } }}
        />
      )

    default:
      return (
        <TextField
          size="small"
          fullWidth
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.help}
          value={(value as string) ?? ''}
          onChange={(event) => onChange(event.target.value)}
          slotProps={{ htmlInput: { 'data-field': field.key } }}
        />
      )
  }
}

/**
 * Saves a field a moment after typing stops.
 *
 * A request per keystroke is a request per keystroke; a Save button on a screen
 * with a live preview is a button nobody presses before wondering why the
 * preview is wrong. Six hundred milliseconds is long enough to swallow a word
 * and short enough that the preview feels like it is following along.
 */
export function useDebouncedSave<T>(save: (value: T) => void, delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(save)
  latest.current = save

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (value: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => latest.current(value), delay)
  }
}
