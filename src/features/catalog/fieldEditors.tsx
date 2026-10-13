import {
  Autocomplete,
  Checkbox,
  Chip,
  FormControlLabel,
  FormGroup,
  Grid,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { MEASUREMENT_UNITS, parseFieldType } from './fieldMeta'
import type { FieldType, Validations } from './types'
import { useFieldTypes, useMetaobjectTypes } from './useCatalog'

const GROUP_LABEL: Record<FieldType['group'], string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date and time',
  measurement: 'Measurement',
  reference: 'Reference',
  other: 'Other',
}

const GROUP_ORDER: FieldType['group'][] = ['text', 'number', 'date', 'measurement', 'reference', 'other']

/** A type and whether it is a list of that type, chosen together. */
export function TypePicker({ value, onChange, disabled, error, helperText }: { value: string; onChange(type: string): void; disabled?: boolean; error?: string; helperText?: string }) {
  const types = useFieldTypes()
  const { base, list } = parseFieldType(value)
  const info = types.data?.find((type) => type.type === base)
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
      <TextField
        select
        label="Type"
        value={base}
        onChange={(event) => {
          const next = types.data?.find((type) => type.type === event.target.value)
          onChange(list && next?.listable ? `list.${event.target.value}` : event.target.value)
        }}
        disabled={disabled}
        error={Boolean(error)}
        helperText={error ?? helperText}
        sx={{ flex: 1 }}
      >
        {GROUP_ORDER.flatMap((group) => [
          <ListSubheader key={`h-${group}`}>{GROUP_LABEL[group]}</ListSubheader>,
          ...(types.data ?? [])
            .filter((type) => type.group === group)
            .map((type) => (
              <MenuItem key={type.type} value={type.type}>
                {type.label}
              </MenuItem>
            )),
        ])}
      </TextField>
      <FormControlLabel
        control={<Checkbox checked={list} onChange={(event) => onChange(event.target.checked ? `list.${base}` : base)} disabled={disabled || !info?.listable} />}
        label="List of values"
      />
    </Stack>
  )
}

/** The type's validation options (and only those — the API drops any others). */
export function ValidationsEditor({ type, value, onChange, errors, disabled }: { type: string; value: Validations; onChange(value: Validations): void; errors: Record<string, string>; disabled?: boolean }) {
  const types = useFieldTypes()
  const metaobjectTypes = useMetaobjectTypes()
  const { base, list } = parseFieldType(type)
  const allowed = new Set(types.data?.find((item) => item.type === base)?.validations ?? [])
  const set = (patch: Partial<Validations>) => onChange({ ...value, ...patch })
  const err = (key: string) => errors[`validations.${key}`] ?? errors[key]
  const num = (text: string) => (text.trim() === '' ? null : Number(text))
  const isDate = base === 'date' || base === 'date_time'
  const measurement = base in MEASUREMENT_UNITS
  const bound = (key: 'min' | 'max') => {
    const current = value[key]
    if (measurement) {
      const m = (current ?? null) as { value: number; unit: string } | null
      return (
        <Stack direction="row" spacing={1}>
          <TextField size="small" fullWidth type="number" label={key === 'min' ? 'Minimum' : 'Maximum'} value={m?.value ?? ''} onChange={(event) => set({ [key]: event.target.value === '' ? null : { value: Number(event.target.value), unit: m?.unit ?? MEASUREMENT_UNITS[base][0] } })} disabled={disabled} error={Boolean(err(key))} helperText={err(key)} />
          <TextField select size="small" value={m?.unit ?? MEASUREMENT_UNITS[base][0]} onChange={(event) => m && set({ [key]: { ...m, unit: event.target.value } })} disabled={disabled || !m} sx={{ width: 100 }}>
            {MEASUREMENT_UNITS[base].map((unit) => (
              <MenuItem key={unit} value={unit}>
                {unit}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )
    }
    const text = typeof current === 'number' || typeof current === 'string' ? String(current) : ''
    return (
      <TextField
        size="small"
        fullWidth
        type={isDate ? (base === 'date' ? 'date' : 'datetime-local') : 'number'}
        label={base.endsWith('text_field') ? (key === 'min' ? 'Minimum length' : 'Maximum length') : key === 'min' ? 'Minimum' : 'Maximum'}
        value={isDate ? text.slice(0, base === 'date' ? 10 : 16) : text}
        onChange={(event) => set({ [key]: isDate ? event.target.value || null : num(event.target.value) })}
        disabled={disabled}
        error={Boolean(err(key))}
        helperText={err(key)}
        slotProps={isDate ? { inputLabel: { shrink: true } } : undefined}
      />
    )
  }

  if (allowed.size === 0 && !list) {
    return (
      <Typography variant="body2" color="text.secondary">
        This type has no rules to set.
      </Typography>
    )
  }

  return (
    <Grid container spacing={2}>
      {allowed.has('choices') && (
        <Grid size={12}>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={value.choices ?? []}
            onChange={(_event, next) => set({ choices: next.length ? next.map(String) : null })}
            disabled={disabled}
            renderValue={(items, getItemProps) => items.map((item, index) => <Chip {...getItemProps({ index })} key={item} size="small" label={item} />)}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Preset choices" placeholder="Type a choice, press Enter" error={Boolean(err('choices'))} helperText={err('choices') ?? 'With choices, this field is a dropdown: only these values are accepted.'} />
            )}
          />
        </Grid>
      )}
      {allowed.has('min') && <Grid size={{ xs: 12, sm: 6 }}>{bound('min')}</Grid>}
      {allowed.has('max') && <Grid size={{ xs: 12, sm: 6 }}>{bound('max')}</Grid>}
      {allowed.has('max_precision') && (
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth type="number" label="Decimal places" value={value.max_precision ?? ''} onChange={(event) => set({ max_precision: num(event.target.value) })} disabled={disabled} error={Boolean(err('max_precision'))} helperText={err('max_precision')} />
        </Grid>
      )}
      {allowed.has('regex') && (
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth label="Regular expression" placeholder="^[A-Z]{2}-\d+$" value={value.regex ?? ''} onChange={(event) => set({ regex: event.target.value || null })} disabled={disabled} error={Boolean(err('regex'))} helperText={err('regex')} />
        </Grid>
      )}
      {allowed.has('allowed_domains') && (
        <Grid size={12}>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={value.allowed_domains ?? []}
            onChange={(_event, next) => set({ allowed_domains: next.length ? next.map(String) : null })}
            disabled={disabled}
            renderInput={(params) => <TextField {...params} size="small" label="Allowed domains" placeholder="youtube.com" error={Boolean(err('allowed_domains'))} helperText={err('allowed_domains')} />}
          />
        </Grid>
      )}
      {allowed.has('file_types') && (
        <Grid size={12}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Accept
          </Typography>
          <FormGroup row>
            {(['image', 'video', 'document'] as const).map((kind) => (
              <FormControlLabel
                key={kind}
                label={kind[0].toUpperCase() + kind.slice(1) + 's'}
                control={
                  <Checkbox
                    checked={!value.file_types?.length || value.file_types.includes(kind)}
                    onChange={(event) => {
                      const current = value.file_types?.length ? value.file_types : (['image', 'video', 'document'] as const)
                      const next = event.target.checked ? [...new Set([...current, kind])] : current.filter((item) => item !== kind)
                      set({ file_types: next.length === 3 ? null : [...next] })
                    }}
                    disabled={disabled}
                  />
                }
              />
            ))}
          </FormGroup>
        </Grid>
      )}
      {allowed.has('metaobject_type') && (
        <Grid size={12}>
          <TextField
            select
            size="small"
            fullWidth
            label="Metaobject type"
            value={value.metaobject_type ?? ''}
            onChange={(event) => set({ metaobject_type: event.target.value || null })}
            disabled={disabled}
            error={Boolean(err('metaobject_type'))}
            helperText={err('metaobject_type') ?? (metaobjectTypes.data?.definitions.length ? 'Entries of this type can be chosen' : 'Make a metaobject type first, in Metaobjects')}
          >
            {(metaobjectTypes.data?.definitions ?? []).map((definition) => (
              <MenuItem key={definition.type} value={definition.type}>
                {definition.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      )}
      {allowed.has('scale_min') && (
        <Grid size={{ xs: 6 }}>
          <TextField size="small" fullWidth type="number" label="Scale from" value={value.scale_min ?? ''} placeholder="0" onChange={(event) => set({ scale_min: num(event.target.value) })} disabled={disabled} error={Boolean(err('scale_min'))} helperText={err('scale_min')} />
        </Grid>
      )}
      {allowed.has('scale_max') && (
        <Grid size={{ xs: 6 }}>
          <TextField size="small" fullWidth type="number" label="Scale to" value={value.scale_max ?? ''} placeholder="5" onChange={(event) => set({ scale_max: num(event.target.value) })} disabled={disabled} error={Boolean(err('scale_max'))} helperText={err('scale_max')} />
        </Grid>
      )}
      {allowed.has('currency_code') && (
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth label="Currency" placeholder="The store's currency" value={value.currency_code ?? ''} onChange={(event) => set({ currency_code: event.target.value.toUpperCase().slice(0, 3) || null })} disabled={disabled} error={Boolean(err('currency_code'))} helperText={err('currency_code')} />
        </Grid>
      )}
      {list && (
        <>
          <Grid size={{ xs: 6 }}>
            <TextField size="small" fullWidth type="number" label="Fewest items" value={value.list_min ?? ''} onChange={(event) => set({ list_min: num(event.target.value) })} disabled={disabled} error={Boolean(err('list_min'))} helperText={err('list_min')} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField size="small" fullWidth type="number" label="Most items" value={value.list_max ?? ''} onChange={(event) => set({ list_max: num(event.target.value) })} disabled={disabled} error={Boolean(err('list_max'))} helperText={err('list_max')} />
          </Grid>
        </>
      )}
    </Grid>
  )
}
