import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControlLabel,
  FormHelperText,
  IconButton,
  MenuItem,
  Rating,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { storeCurrency } from '../../lib/format'
import { RichTextEditor } from '../content/pages/RichTextEditor'
import { MediaPicker } from '../media/MediaPicker'
import { MEASUREMENT_UNITS, parseFieldType, REFERENCE_KIND } from './fieldMeta'
import type { FieldSpec, ReferenceItem } from './types'
import { useReferenceLabels, useReferenceSearch } from './useCatalog'

/**
 * One custom field's value, drawn for its type — the same control whether the
 * field is on a product, a variant or a metaobject entry. Values go out in the
 * shape the API checks (catalog/fieldTypes.ts): a measurement is {value, unit},
 * money {amount, currency_code}, a reference an id, a list an array.
 */

interface Props {
  field: FieldSpec
  value: unknown
  onChange(value: unknown): void
  error?: string
  disabled?: boolean
}

export function FieldInput({ field, value, onChange, error, disabled }: Props) {
  const { base, list } = parseFieldType(field.type)
  const label = `${field.name}${field.required ? ' *' : ''}`
  const help = error ?? field.description ?? undefined

  if (base in REFERENCE_KIND) {
    return <ReferenceInput kind={REFERENCE_KIND[base]} label={label} multiple={list} value={value} onChange={onChange} help={help} error={Boolean(error)} disabled={disabled} metaobjectType={field.validations.metaobject_type} />
  }
  // A dropdown list is a multi-select; any other list repeats the single control.
  if (list && base === 'single_line_text_field' && field.validations.choices?.length) {
    return (
      <Autocomplete
        multiple
        options={field.validations.choices}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={(_event, next) => onChange(next.length ? next : null)}
        disabled={disabled}
        renderInput={(params) => <TextField {...params} label={label} error={Boolean(error)} helperText={help} />}
      />
    )
  }
  if (list) {
    const items = Array.isArray(value) ? value : []
    const set = (next: unknown[]) => onChange(next.length ? next : null)
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
          {label}
        </Typography>
        <Stack spacing={1}>
          {items.map((item, index) => (
            <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <SingleInput base={base} field={field} label={`${field.name} ${index + 1}`} value={item} onChange={(next) => set(items.map((old, at) => (at === index ? next : old)))} disabled={disabled} />
              </Box>
              <IconButton aria-label="Remove" size="small" onClick={() => set(items.filter((_, at) => at !== index))} disabled={disabled} sx={{ mt: 1 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, emptyOf(base)])} disabled={disabled} sx={{ mt: 0.5 }}>
          Add item
        </Button>
        {help && <FormHelperText error={Boolean(error)}>{help}</FormHelperText>}
      </Box>
    )
  }
  return <SingleInput base={base} field={field} label={label} value={value} onChange={onChange} error={error} help={help} disabled={disabled} />
}

function emptyOf(base: string): unknown {
  if (base in MEASUREMENT_UNITS) return { value: '', unit: MEASUREMENT_UNITS[base][0] }
  if (base === 'link') return { text: '', url: '' }
  if (base === 'color') return '#000000'
  return ''
}

interface SingleProps {
  base: string
  field: FieldSpec
  label: string
  value: unknown
  onChange(value: unknown): void
  error?: string
  help?: string
  disabled?: boolean
}

function SingleInput({ base, field, label, value, onChange, error, help, disabled }: SingleProps) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  const common = { label, fullWidth: true, disabled, error: Boolean(error), helperText: help }
  const clearable = (next: string) => onChange(next === '' ? null : next)

  switch (base) {
    case 'single_line_text_field':
      if (field.validations.choices?.length) {
        return (
          <TextField select {...common} value={text} onChange={(event) => clearable(event.target.value)}>
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {field.validations.choices.map((choice) => (
              <MenuItem key={choice} value={choice}>
                {choice}
              </MenuItem>
            ))}
          </TextField>
        )
      }
      return <TextField {...common} value={text} onChange={(event) => clearable(event.target.value)} />
    case 'multi_line_text_field':
      return <TextField {...common} multiline minRows={3} value={text} onChange={(event) => clearable(event.target.value)} />
    case 'rich_text_field':
      return (
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
            {label}
          </Typography>
          <RichTextEditor content={text} onChange={(html) => clearable(html === '<p></p>' ? '' : html)} disabled={disabled} error={Boolean(error)} helperText={help} />
        </Box>
      )
    case 'number_integer':
    case 'number_decimal':
      return (
        <TextField
          {...common}
          type="number"
          value={text}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
          slotProps={{ htmlInput: { step: base === 'number_integer' ? 1 : 'any' } }}
        />
      )
    case 'date':
      return <TextField {...common} type="date" value={text.slice(0, 10)} onChange={(event) => clearable(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    case 'date_time':
      return (
        <TextField
          {...common}
          type="datetime-local"
          value={text ? toLocalInput(text) : ''}
          onChange={(event) => onChange(event.target.value ? new Date(event.target.value).toISOString() : null)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      )
    case 'weight':
    case 'volume':
    case 'dimension': {
      const current = (value ?? {}) as { value?: number | string; unit?: string }
      const unit = current.unit ?? MEASUREMENT_UNITS[base][0]
      return (
        <Stack direction="row" spacing={1}>
          <TextField
            {...common}
            type="number"
            value={current.value ?? ''}
            onChange={(event) => onChange(event.target.value === '' ? null : { value: Number(event.target.value), unit })}
            slotProps={{ htmlInput: { step: 'any', min: 0 } }}
          />
          <TextField select label="Unit" value={unit} disabled={disabled} onChange={(event) => onChange({ value: current.value === '' || current.value === undefined ? 0 : Number(current.value), unit: event.target.value })} sx={{ width: 110 }}>
            {MEASUREMENT_UNITS[base].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )
    }
    case 'boolean':
      return (
        <Box>
          <FormControlLabel control={<Switch checked={value === true} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />} label={label} />
          {help && <FormHelperText error={Boolean(error)}>{help}</FormHelperText>}
        </Box>
      )
    case 'color':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Box
            component="input"
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(text) ? text : '#000000'}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            disabled={disabled}
            aria-label={`${field.name} colour`}
            sx={{ width: 48, height: 40, p: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, background: 'none', cursor: 'pointer' }}
          />
          <TextField {...common} value={text} placeholder="#1a2b3c" onChange={(event) => clearable(event.target.value)} />
        </Stack>
      )
    case 'url':
      return <TextField {...common} type="url" placeholder="https://" value={text} onChange={(event) => clearable(event.target.value)} />
    case 'link': {
      const current = (value ?? {}) as { text?: string; url?: string }
      const set = (patch: Partial<{ text: string; url: string }>) => {
        const next = { text: current.text ?? '', url: current.url ?? '', ...patch }
        onChange(next.url || next.text ? next : null)
      }
      return (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label={`${label} — text`} fullWidth disabled={disabled} value={current.text ?? ''} onChange={(event) => set({ text: event.target.value })} />
          <TextField label="URL" fullWidth disabled={disabled} placeholder="https:// or /pages/…" value={current.url ?? ''} onChange={(event) => set({ url: event.target.value })} error={Boolean(error)} helperText={help} />
        </Stack>
      )
    }
    case 'money': {
      const current = (value ?? {}) as { amount?: string | number; currency_code?: string }
      const currency = current.currency_code ?? field.validations.currency_code ?? storeCurrency()
      return (
        <TextField
          {...common}
          type="number"
          value={current.amount ?? ''}
          onChange={(event) => onChange(event.target.value === '' ? null : { amount: event.target.value, currency_code: currency })}
          slotProps={{ htmlInput: { step: '0.01', min: 0 }, input: { endAdornment: <Typography variant="body2" color="text.secondary">{currency}</Typography> } }}
        />
      )
    }
    case 'rating': {
      const scaleMin = field.validations.scale_min ?? 0
      const scaleMax = field.validations.scale_max ?? 5
      const current = typeof value === 'object' && value !== null ? Number((value as { value?: number }).value) : typeof value === 'number' ? value : null
      return (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {scaleMax - scaleMin <= 10 && scaleMin >= 0 ? (
              <Rating max={scaleMax} precision={0.5} value={current} onChange={(_event, next) => onChange(next === null ? null : next)} disabled={disabled} />
            ) : (
              <TextField size="small" type="number" value={current ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} disabled={disabled} />
            )}
            <Typography variant="caption">
              {scaleMin}–{scaleMax}
            </Typography>
          </Stack>
          {help && <FormHelperText error={Boolean(error)}>{help}</FormHelperText>}
        </Box>
      )
    }
    case 'json':
      return <JsonInput label={label} value={value} onChange={onChange} error={error} help={help} disabled={disabled} />
    default:
      return <TextField {...common} value={text} onChange={(event) => clearable(event.target.value)} />
  }
}

function toLocalInput(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** JSON is edited as text and only sent once it parses, so a half-typed brace is not an error. */
function JsonInput({ label, value, onChange, error, help, disabled }: { label: string; value: unknown; onChange(value: unknown): void; error?: string; help?: string; disabled?: boolean }) {
  const [draft, setDraft] = useState(() => (value === null || value === undefined ? '' : JSON.stringify(value, null, 2)))
  const [invalid, setInvalid] = useState(false)
  return (
    <TextField
      label={label}
      fullWidth
      multiline
      minRows={4}
      disabled={disabled}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value)
        if (!event.target.value.trim()) {
          setInvalid(false)
          onChange(null)
          return
        }
        try {
          onChange(JSON.parse(event.target.value))
          setInvalid(false)
        } catch {
          setInvalid(true)
        }
      }}
      error={invalid || Boolean(error)}
      helperText={invalid ? 'Not valid JSON yet.' : help}
      slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
    />
  )
}

// ── references ───────────────────────────────────────────────────────────────

interface ReferenceProps {
  kind: string
  label: string
  multiple: boolean
  value: unknown
  onChange(value: unknown): void
  help?: string
  error: boolean
  disabled?: boolean
  metaobjectType?: string | null
}

function ReferenceInput({ kind, label, multiple, value, onChange, help, error, disabled, metaobjectType }: ReferenceProps) {
  const ids = useMemo(() => (Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : [value]).map(Number).filter(Boolean), [value])
  const labels = useReferenceLabels(kind, ids)
  const known = new Map((labels.data?.items ?? []).map((item) => [item.id, item]))
  const selected: ReferenceItem[] = ids.map((id) => known.get(id) ?? { id, label: `#${id}` })

  if (kind === 'file') return <FileReferenceInput label={label} multiple={multiple} selected={selected} onChange={onChange} help={help} error={error} disabled={disabled} />
  return <ReferenceSearch kind={kind} label={label} multiple={multiple} selected={selected} onChange={onChange} help={help} error={error} disabled={disabled} metaobjectType={metaobjectType} />
}

function ReferenceSearch({
  kind,
  label,
  multiple,
  selected,
  onChange,
  help,
  error,
  disabled,
  metaobjectType,
}: Omit<ReferenceProps, 'value'> & { selected: ReferenceItem[] }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const search = useReferenceSearch(kind, input, metaobjectType, open)
  const options = search.data?.items ?? []
  const commit = (items: ReferenceItem[]) => onChange(multiple ? (items.length ? items.map((item) => item.id) : null) : (items[0]?.id ?? null))

  return (
    <Autocomplete<ReferenceItem, boolean>
      multiple={multiple}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      loading={search.isFetching}
      filterOptions={(all) => all}
      value={multiple ? selected : (selected[0] ?? null)}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      getOptionLabel={(option) => option.label}
      onInputChange={(_event, next, reason) => reason === 'input' && setInput(next)}
      onChange={(_event, next) => commit(Array.isArray(next) ? next : next ? [next] : [])}
      disabled={disabled}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {option.image && <Box component="img" src={option.image} alt="" sx={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 0.5 }} />}
            <Box>
              <Typography variant="body2">{option.label}</Typography>
              {option.sublabel && <Typography variant="caption">{option.sublabel}</Typography>}
            </Box>
          </Stack>
        </li>
      )}
      renderValue={
        multiple
          ? (items, getItemProps) =>
              (items as ReferenceItem[]).map((item, index) => <Chip {...getItemProps({ index })} key={item.id} size="small" label={item.label} color={item.missing ? 'warning' : 'default'} />)
          : undefined
      }
      renderInput={(params) => <TextField {...params} label={label} placeholder={`Search ${kind === 'metaobject' ? metaobjectType ?? 'entries' : `${kind}s`}`} error={error} helperText={help} />}
    />
  )
}

function FileReferenceInput({ label, multiple, selected, onChange, help, error, disabled }: { label: string; multiple: boolean; selected: ReferenceItem[]; onChange(value: unknown): void; help?: string; error: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const set = (ids: number[]) => onChange(multiple ? (ids.length ? ids : null) : (ids[0] ?? null))
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {selected.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            avatar={item.image ? <Box component="img" src={item.image} alt="" /> : undefined}
            onDelete={disabled ? undefined : () => set(selected.filter((other) => other.id !== item.id).map((other) => other.id))}
          />
        ))}
        <Button size="small" onClick={() => setOpen(true)} disabled={disabled}>
          {selected.length ? (multiple ? 'Add files' : 'Change file') : 'Select file'}
        </Button>
      </Stack>
      {help && <FormHelperText error={error}>{help}</FormHelperText>}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        multiple={multiple}
        defaultMediaType=""
        initialSelectedIds={selected.map((item) => item.id)}
        title={`Select ${multiple ? 'files' : 'a file'}`}
        onSelect={(media) => {
          set(media.map((item) => item.id))
          setOpen(false)
        }}
      />
    </Box>
  )
}
