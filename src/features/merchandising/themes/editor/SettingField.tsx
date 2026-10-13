import { useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import { MediaPicker } from '../../../media/MediaPicker'
import { useMediaItem } from '../../../media/useMedia'
import { thumbUrl } from '../../../../lib/mediaUrl'
import type { SettingDefinition, SettingValue } from '../themeTypes'
import { FONT_FAMILIES } from '../../../../lib/googleFonts'
import { ResourceListPicker, ResourcePicker } from './ResourcePicker'

/**
 * One input per Shopify setting type, chosen by the schema: whatever a
 * section's {% schema %} declares is editable here without this file knowing
 * the section exists — the contract that makes a theme's own sections, and
 * sections a developer adds in the code editor, customisable immediately.
 */

interface Props {
  definition: SettingDefinition
  value: SettingValue
  disabled?: boolean
  onChange: (value: SettingValue) => void
}

const label = (definition: SettingDefinition) => definition.label ?? definition.id ?? ''

/** Text that commits as you type but keeps the caret: local state, pushed up on each change. */
function useLocal<T>(value: T) {
  const [local, setLocal] = useState(value)
  // A new value from outside (undo, another panel) replaces what is typed — adjusted during render, not in an effect.
  const [seen, setSeen] = useState(value)
  if (!Object.is(seen, value)) {
    setSeen(value)
    setLocal(value)
  }
  return [local, setLocal] as const
}

function Help({ definition }: { definition: SettingDefinition }) {
  if (!definition.info) return null
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
      {definition.info}
    </Typography>
  )
}

function ImageSetting({ definition, value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null
  const media = useMediaItem(id)
  const url = media.data?.media ? thumbUrl(media.data.media, 'md') : typeof value === 'string' && /^https?:/.test(value) ? value : null
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
        {label(definition)}
      </Typography>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`Choose ${label(definition)}`}
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={(event) => event.key === 'Enter' && !disabled && setOpen(true)}
        sx={{
          position: 'relative',
          height: url ? 140 : 96,
          borderRadius: 1.5,
          border: 1,
          borderStyle: url ? 'solid' : 'dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          cursor: disabled ? 'default' : 'pointer',
          '&:hover .image-actions': { opacity: 1 },
        }}
      >
        {url ? (
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Stack spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <ImageOutlinedIcon />
            <Typography variant="caption">Select image</Typography>
          </Stack>
        )}
        {url && !disabled && (
          <Stack className="image-actions" direction="row" spacing={1} sx={{ position: 'absolute', bottom: 8, right: 8, opacity: 0, transition: 'opacity .15s' }}>
            <Button size="small" variant="contained" color="inherit" onClick={(event) => { event.stopPropagation(); setOpen(true) }}>
              Change
            </Button>
            <Button size="small" variant="contained" color="inherit" onClick={(event) => { event.stopPropagation(); onChange(null) }}>
              Remove
            </Button>
          </Stack>
        )}
      </Box>
      <Help definition={definition} />
      <MediaPicker
        open={open}
        multiple={false}
        title={label(definition)}
        initialSelectedIds={id ? [id] : []}
        onClose={() => setOpen(false)}
        onSelect={(selection) => {
          if (selection[0]) onChange(selection[0].id)
          setOpen(false)
        }}
      />
    </Box>
  )
}

function ColorSetting({ definition, value, disabled, onChange }: Props) {
  const [local, setLocal] = useLocal(typeof value === 'string' ? value : '')
  const valid = /^#[0-9a-f]{3,8}$/i.test(local)
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
        {label(definition)}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box component="label" sx={{ position: 'relative', width: 40, height: 40, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: valid ? local : 'transparent', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, backgroundImage: valid ? undefined : 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 10px 10px' }}>
          <input
            type="color"
            disabled={disabled}
            value={valid ? local.slice(0, 7) : '#000000'}
            onChange={(event) => {
              setLocal(event.target.value.toUpperCase())
              onChange(event.target.value.toUpperCase())
            }}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'inherit' }}
            aria-label={`${label(definition)} colour`}
          />
        </Box>
        <TextField
          size="small"
          value={local}
          disabled={disabled}
          error={Boolean(local) && !valid}
          placeholder="#1A1A1A"
          onChange={(event) => {
            const next = event.target.value.trim()
            setLocal(next)
            if (/^#[0-9a-f]{6}$/i.test(next) || /^#[0-9a-f]{3}$/i.test(next)) onChange(next.toUpperCase())
          }}
          slotProps={{ htmlInput: { style: { fontFamily: 'ui-monospace, monospace' }, 'aria-label': label(definition) } }}
          sx={{ flex: 1 }}
        />
        {definition.type === 'color_background' && local && !disabled && (
          <IconButton size="small" aria-label="Clear" onClick={() => { setLocal(''); onChange(null) }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Help definition={definition} />
    </Box>
  )
}

function TextSetting({ definition, value, disabled, onChange, multiline, mono }: Props & { multiline?: boolean; mono?: boolean }) {
  const [local, setLocal] = useLocal(typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value))
  return (
    <TextField
      size="small"
      fullWidth
      label={label(definition)}
      value={local}
      disabled={disabled}
      placeholder={definition.placeholder}
      helperText={definition.info ?? (definition.type === 'richtext' ? 'Basic formatting: <p>, <strong>, <em>, <a>.' : undefined)}
      multiline={multiline}
      minRows={multiline ? (mono ? 6 : 3) : undefined}
      onChange={(event) => {
        setLocal(event.target.value)
        onChange(event.target.value)
      }}
      slotProps={{ htmlInput: mono ? { style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 } } : undefined }}
    />
  )
}

function RangeSetting({ definition, value, disabled, onChange }: Props) {
  const min = definition.min ?? 0
  const max = definition.max ?? 100
  const current = typeof value === 'number' ? value : Number(value ?? definition.default ?? min)
  const [local, setLocal] = useLocal(current)
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label(definition)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {local}
          {definition.unit ?? ''}
        </Typography>
      </Stack>
      <Slider
        size="small"
        min={min}
        max={max}
        step={definition.step ?? 1}
        value={local}
        disabled={disabled}
        onChange={(_event, next) => setLocal(Number(next))}
        onChangeCommitted={(_event, next) => onChange(Number(next))}
        aria-label={label(definition)}
      />
      <Help definition={definition} />
    </Box>
  )
}

function SelectSetting({ definition, value, disabled, onChange }: Props) {
  const options = definition.options ?? []
  const current = String(value ?? definition.default ?? options[0]?.value ?? '')
  // Two or three short choices read better as a segmented control, as in Shopify's editor.
  if (options.length <= 3 && options.every((option) => option.label.length <= 14)) {
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
          {label(definition)}
        </Typography>
        <ToggleButtonGroup size="small" exclusive fullWidth value={current} disabled={disabled} onChange={(_event, next) => next !== null && onChange(next)}>
          {options.map((option) => (
            <ToggleButton key={option.value} value={option.value} sx={{ textTransform: 'none', py: 0.5 }}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Help definition={definition} />
      </Box>
    )
  }
  return (
    <FormControl size="small" fullWidth>
      <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
        {label(definition)}
      </Typography>
      <Select value={current} disabled={disabled} onChange={(event) => onChange(event.target.value)} inputProps={{ 'aria-label': label(definition) }}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      <Help definition={definition} />
    </FormControl>
  )
}

function FontSetting({ definition, value, disabled, onChange }: Props) {
  const current = typeof value === 'string' && value ? value.replace(/_[nib]\d$/, '').replace(/_/g, ' ') : String(definition.default ?? 'Inter')
  const families = Object.keys(FONT_FAMILIES).includes(current) ? Object.keys(FONT_FAMILIES) : [current, ...Object.keys(FONT_FAMILIES)]
  return (
    <FormControl size="small" fullWidth>
      <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
        {label(definition)}
      </Typography>
      <Select
        value={current}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        renderValue={(family) => <span style={{ fontFamily: `"${family}", system-ui` }}>{family}</span>}
        MenuProps={{ slotProps: { paper: { sx: { maxHeight: 380 } } } }}
        inputProps={{ 'aria-label': label(definition) }}
      >
        {families.map((family) => (
          <MenuItem key={family} value={family} sx={{ fontFamily: `"${family}", system-ui`, fontSize: 16 }}>
            {family}
          </MenuItem>
        ))}
      </Select>
      <Help definition={definition} />
    </FormControl>
  )
}

export function SettingField(props: Props) {
  const { definition, value, disabled, onChange } = props
  switch (definition.type) {
    case 'header':
      return (
        <Typography variant="overline" sx={{ display: 'block', pt: 1, color: 'text.secondary', letterSpacing: '.08em', lineHeight: 1.6 }}>
          {definition.content}
        </Typography>
      )
    case 'paragraph':
      return (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {definition.content}
        </Typography>
      )
    case 'checkbox':
      return (
        <Box>
          <FormControlLabel control={<Switch size="small" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />} label={<Typography variant="body2">{label(definition)}</Typography>} />
          <Help definition={definition} />
        </Box>
      )
    case 'range':
      return <RangeSetting {...props} />
    case 'number':
      return (
        <TextField
          size="small"
          type="number"
          fullWidth
          label={label(definition)}
          value={value ?? ''}
          disabled={disabled}
          helperText={definition.info}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
          slotProps={{ input: definition.unit ? { endAdornment: <InputAdornment position="end">{definition.unit}</InputAdornment> } : undefined }}
        />
      )
    case 'select':
      return <SelectSetting {...props} />
    case 'radio':
      return (
        <FormControl>
          <FormLabel sx={{ typography: 'body2', fontWeight: 500, color: 'text.primary' }}>{label(definition)}</FormLabel>
          <RadioGroup value={String(value ?? definition.default ?? '')} onChange={(event) => onChange(event.target.value)}>
            {(definition.options ?? []).map((option) => (
              <FormControlLabel key={option.value} value={option.value} control={<Radio size="small" />} label={<Typography variant="body2">{option.label}</Typography>} disabled={disabled} />
            ))}
          </RadioGroup>
          <Help definition={definition} />
        </FormControl>
      )
    case 'color':
    case 'color_background':
      return <ColorSetting {...props} />
    case 'font_picker':
      return <FontSetting {...props} />
    case 'image_picker':
      return <ImageSetting {...props} />
    case 'textarea':
    case 'richtext':
      return <TextSetting {...props} multiline />
    case 'html':
    case 'liquid':
      return <TextSetting {...props} multiline mono />
    case 'collection':
    case 'product':
    case 'page':
    case 'blog':
    case 'article':
    case 'link_list':
      return <ResourcePicker type={definition.type} label={label(definition)} info={definition.info} disabled={disabled} value={typeof value === 'string' && value ? value : null} onChange={onChange} />
    case 'collection_list':
    case 'product_list':
      return (
        <ResourceListPicker
          type={definition.type === 'collection_list' ? 'collection' : 'product'}
          label={label(definition)}
          info={definition.info}
          disabled={disabled}
          limit={definition.limit}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )
    default:
      // text, inline_richtext, url, video_url and anything newer: a text box never loses data.
      return <TextSetting {...props} />
  }
}
