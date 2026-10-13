import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { formatRelative } from '../../lib/format'
import { FieldInput } from './FieldInput'
import { TypePicker, ValidationsEditor } from './fieldEditors'
import { keyFromName, typeLabel } from './fieldMeta'
import type { MetaobjectDefinition, MetaobjectEntry, Validations } from './types'
import { detailErrors, useDeleteEntry, useDeleteMetaobjectType, useEntries, useFieldTypes, useMetaobjectTypes, useSaveEntry, useSaveMetaobjectType } from './useCatalog'

/**
 * Metaobjects: structured types of the merchant's own ("Ingredient", "Size
 * chart", "Designer") whose entries products point at — through a custom
 * field, or as the values of an option.
 */
export function MetaobjectsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('custom_data.manage')
  const types = useMetaobjectTypes()
  const fieldTypes = useFieldTypes()
  const [editing, setEditing] = useState<MetaobjectDefinition | 'new' | null>(null)
  const { flash, success, clear } = useFlash()
  const rows = types.data?.definitions ?? []

  return (
    <Box>
      <PageHeader
        title="Metaobjects"
        subtitle="Structured content of your own — ingredients, size charts, designers — that products can point at"
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              Add type
            </Button>
          )
        }
      />
      <Card>
        {types.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
            <Typography sx={{ mb: 1 }}>No metaobject types yet.</Typography>
            <Typography variant="body2" color="text.secondary">
              Make a type like "Ingredient" with its own fields (name, benefit, image), add its entries once, and pick them on any product.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Fields</TableCell>
                <TableCell align="right">Entries</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/catalog/metaobjects/${encodeURIComponent(row.type)}`)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {row.type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{row.fields.map((field) => `${field.name} (${typeLabel(field.type, fieldTypes.data).toLowerCase()})`).join(', ')}</Typography>
                  </TableCell>
                  <TableCell align="right">{row.entry_count}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{formatRelative(row.updated_at)}</Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                    {canManage && (
                      <Button size="small" onClick={() => setEditing(row)}>
                        Edit type
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {editing && (
        <TypeDialog
          definition={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(definition, created) => {
            setEditing(null)
            success(`${definition.name} saved`)
            if (created) navigate(`/catalog/metaobjects/${encodeURIComponent(definition.type)}`)
          }}
          onDeleted={(name) => {
            setEditing(null)
            success(`${name} deleted`)
          }}
        />
      )}
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

interface FieldDraft {
  key: string
  name: string
  type: string
  description: string
  required: boolean
  validations: Validations
  keyTouched: boolean
}

function TypeDialog({ definition, onClose, onSaved, onDeleted }: { definition: MetaobjectDefinition | null; onClose(): void; onSaved(definition: MetaobjectDefinition, created: boolean): void; onDeleted(name: string): void }) {
  const save = useSaveMetaobjectType(definition?.id ?? null)
  const remove = useDeleteMetaobjectType()
  const fieldTypes = useFieldTypes()
  const [name, setName] = useState(definition?.name ?? '')
  const [type, setType] = useState(definition?.type ?? '')
  const [typeTouched, setTypeTouched] = useState(Boolean(definition))
  const [description, setDescription] = useState(definition?.description ?? '')
  const [fields, setFields] = useState<FieldDraft[]>(
    definition?.fields.map((field) => ({ ...field, description: field.description ?? '', keyTouched: true })) ?? [
      { key: 'name', name: 'Name', type: 'single_line_text_field', description: '', required: true, validations: {}, keyTouched: false },
    ],
  )
  const [displayKey, setDisplayKey] = useState(definition?.display_name_key ?? 'name')
  const [flags, setFlags] = useState({ publishable: definition?.publishable ?? true, storefront: definition?.storefront ?? true, translatable: definition?.translatable ?? false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const setField = (index: number, patch: Partial<FieldDraft>) => setFields((current) => current.map((field, at) => (at === index ? { ...field, ...patch } : field)))
  const move = (index: number, by: number) =>
    setFields((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })

  const submit = () => {
    setErrors({})
    setMessage(null)
    save.mutate(
      {
        name,
        type: type || keyFromName(name).replace(/_/g, '-'),
        description: description || null,
        display_name_key: displayKey || null,
        fields: fields.map((field) => ({ key: field.key || keyFromName(field.name), name: field.name, type: field.type, description: field.description || null, required: field.required, validations: field.validations })),
        ...flags,
      },
      {
        onSuccess: (data) => onSaved(data.definition, !definition),
        onError: (caught) => {
          setErrors(detailErrors(caught))
          setMessage(errorMessage(caught))
        },
      },
    )
  }

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{definition ? `Edit ${definition.name}` : 'Add a metaobject type'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {message && <Alert severity="error">{message}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              autoFocus
              fullWidth
              label="Name"
              placeholder="Ingredient"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (!typeTouched) setType(keyFromName(event.target.value).replace(/_/g, '-'))
              }}
              error={Boolean(errors.name)}
              helperText={errors.name}
            />
            <TextField
              fullWidth
              label="Type handle"
              value={type}
              onChange={(event) => {
                setTypeTouched(true)
                setType(event.target.value)
              }}
              error={Boolean(errors.type)}
              helperText={errors.type ?? `Themes read it as metaobjects.${type || 'type'}`}
            />
          </Stack>
          <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />

          <Divider textAlign="left">
            <Typography variant="caption">Fields</Typography>
          </Divider>
          {errors.fields && <Alert severity="error">{errors.fields}</Alert>}
          <Box>
            {fields.map((field, index) => {
              const prefix = `fields.${index}`
              const fieldErrors = Object.fromEntries(Object.entries(errors).filter(([path]) => path.startsWith(`${prefix}.`)).map(([path, text]) => [path.slice(prefix.length + 1), text]))
              return (
                <Accordion key={index} disableGutters defaultExpanded={!field.name}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {field.name || 'New field'}
                      </Typography>
                      <Typography variant="caption" noWrap>
                        {typeLabel(field.type, fieldTypes.data)}
                        {field.required ? ' · required' : ''}
                      </Typography>
                      {Object.keys(fieldErrors).length > 0 && <Chip size="small" color="error" label="Needs attention" />}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Field name"
                          value={field.name}
                          onChange={(event) => setField(index, { name: event.target.value, ...(field.keyTouched ? {} : { key: keyFromName(event.target.value) }) })}
                          error={Boolean(fieldErrors.name)}
                          helperText={fieldErrors.name}
                        />
                        <TextField size="small" fullWidth label="Key" value={field.key} onChange={(event) => setField(index, { key: event.target.value, keyTouched: true })} error={Boolean(fieldErrors.key)} helperText={fieldErrors.key} />
                      </Stack>
                      <TypePicker value={field.type} onChange={(next) => setField(index, { type: next, validations: {} })} error={fieldErrors.type} />
                      <ValidationsEditor type={field.type} value={field.validations} onChange={(validations) => setField(index, { validations })} errors={fieldErrors} />
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <FormControlLabel control={<Checkbox checked={field.required} onChange={(event) => setField(index, { required: event.target.checked })} />} label="Required" sx={{ flex: 1 }} />
                        <IconButton size="small" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" aria-label="Move down" disabled={index === fields.length - 1} onClick={() => move(index, 1)}>
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" aria-label="Remove field" disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, at) => at !== index))}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )
            })}
            <Button
              size="small"
              startIcon={<AddIcon />}
              sx={{ mt: 1 }}
              onClick={() => setFields((current) => [...current, { key: '', name: '', type: 'single_line_text_field', description: '', required: false, validations: {}, keyTouched: false }])}
            >
              Add field
            </Button>
          </Box>

          <TextField select label="Entries are called by" value={displayKey} onChange={(event) => setDisplayKey(event.target.value)} helperText="The field whose value names an entry in lists and pickers" error={Boolean(errors.display_name_key)}>
            {fields
              .filter((field) => field.type === 'single_line_text_field')
              .map((field) => (
                <MenuItem key={field.key || field.name} value={field.key || keyFromName(field.name)}>
                  {field.name || field.key}
                </MenuItem>
              ))}
          </TextField>
          <Box>
            <FormControlLabel control={<Checkbox checked={flags.publishable} onChange={(event) => setFlags({ ...flags, publishable: event.target.checked })} />} label="Entries can be drafts (only active ones show on the store)" />
            <FormControlLabel control={<Checkbox checked={flags.storefront} onChange={(event) => setFlags({ ...flags, storefront: event.target.checked })} />} label="Readable by the storefront (themes, Storefront API)" />
            <FormControlLabel control={<Checkbox checked={flags.translatable} onChange={(event) => setFlags({ ...flags, translatable: event.target.checked })} />} label="Translatable" />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        {definition && (
          <Button color="error" onClick={() => setConfirmDelete(true)} sx={{ mr: 'auto' }}>
            Delete type
          </Button>
        )}
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!name.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
      {definition && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${definition.name}?`}
          body={`Its ${definition.entry_count} entr${definition.entry_count === 1 ? 'y goes' : 'ies go'} too, and fields that pointed at them are left empty. This cannot be undone.`}
          confirmLabel="Delete type"
          destructive
          typeToConfirm={definition.entry_count ? definition.name : undefined}
          busy={remove.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate(definition.id, { onSuccess: () => onDeleted(definition.name), onError: (caught) => setMessage(errorMessage(caught)) })}
        />
      )}
    </Dialog>
  )
}

// ── one type's entries ───────────────────────────────────────────────────────

export function MetaobjectEntriesPage() {
  const { type = '' } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canEdit = can('metaobjects.manage')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MetaobjectEntry | 'new' | null>(null)
  const { flash, success, clear } = useFlash()
  const entries = useEntries(type, search)
  const definition = entries.data?.definition

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <Box>
      <PageHeader
        back={
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/catalog/metaobjects')} sx={{ mb: 1, ml: -1 }}>
            Metaobjects
          </Button>
        }
        title={definition?.name ?? type}
        subtitle={definition?.description ?? undefined}
        actions={
          canEdit &&
          definition && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              Add entry
            </Button>
          )
        }
      />
      {entries.isError && <Alert severity="error">{errorMessage(entries.error)}</Alert>}
      <Card>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search entries"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
        </Box>
        {entries.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (entries.data?.entries.length ?? 0) === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
            {search ? 'No entries match.' : 'No entries yet.'}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Entry</TableCell>
                {definition?.publishable && <TableCell>Status</TableCell>}
                <TableCell>Handle</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.data?.entries.map((entry) => (
                <TableRow key={entry.id} hover sx={{ cursor: 'pointer' }} onClick={() => setEditing(entry)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {entry.display_name}
                    </Typography>
                  </TableCell>
                  {definition?.publishable && (
                    <TableCell>
                      <Chip size="small" label={entry.status === 'active' ? 'Active' : 'Draft'} color={entry.status === 'active' ? 'success' : 'default'} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {entry.handle}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{formatRelative(entry.updated_at)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {editing && definition && (
        <EntryDialog
          definition={definition}
          entry={editing === 'new' ? null : editing}
          disabled={!canEdit}
          onClose={() => setEditing(null)}
          onDone={(text) => {
            setEditing(null)
            success(text)
          }}
        />
      )}
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

function EntryDialog({ definition, entry, disabled, onClose, onDone }: { definition: MetaobjectDefinition; entry: MetaobjectEntry | null; disabled?: boolean; onClose(): void; onDone(text: string): void }) {
  const save = useSaveEntry(definition.type, entry?.id ?? null)
  const remove = useDeleteEntry(definition.type)
  const [values, setValues] = useState<Record<string, unknown>>(entry?.fields ?? {})
  const [handle, setHandle] = useState(entry?.handle ?? '')
  const [status, setStatus] = useState<'draft' | 'active'>(entry?.status ?? 'active')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = () => {
    setErrors({})
    setMessage(null)
    save.mutate(
      { fields: values, ...(handle ? { handle } : {}), status },
      {
        onSuccess: (data) => onDone(`${data.entry.display_name} saved`),
        onError: (caught) => {
          setErrors(detailErrors(caught))
          setMessage(errorMessage(caught))
        },
      },
    )
  }

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{entry ? entry.display_name : `Add ${definition.name.toLowerCase()}`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {message && <Alert severity="error">{message}</Alert>}
          {definition.fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={values[field.key] ?? null}
              onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              error={errors[`fields.${field.key}`] ?? errors[field.key]}
              disabled={disabled}
            />
          ))}
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" fullWidth label="Handle" placeholder="Made from the name" value={handle} onChange={(event) => setHandle(event.target.value)} disabled={disabled} error={Boolean(errors.handle)} helperText={errors.handle} />
            {definition.publishable && (
              <TextField select size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'active')} disabled={disabled} sx={{ minWidth: 140 }}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </TextField>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        {entry && !disabled && (
          <Button color="error" onClick={() => setConfirmDelete(true)} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose} disabled={save.isPending}>
          {disabled ? 'Close' : 'Cancel'}
        </Button>
        {!disabled && (
          <Button variant="contained" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </DialogActions>
      {entry && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${entry.display_name}?`}
          body="Fields and options that point at it are left empty."
          confirmLabel="Delete"
          destructive
          busy={remove.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate(entry.id, { onSuccess: () => onDone(`${entry.display_name} deleted`), onError: (caught) => setMessage(errorMessage(caught)) })}
        />
      )}
    </Dialog>
  )
}
