import AddIcon from '@mui/icons-material/Add'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import {
  Alert,
  Autocomplete,
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
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { TypePicker, ValidationsEditor } from './fieldEditors'
import { keyFromName, parseFieldType, typeLabel } from './fieldMeta'
import type { Definition, OwnerType, Validations } from './types'
import { detailErrors, useDefinitions, useDeleteDefinition, useFieldTypes, useSaveDefinition, useSetPinned, useSuggestions } from './useCatalog'

const UNIQUE_CAPABLE = new Set(['single_line_text_field', 'url', 'number_integer', 'number_decimal'])

/**
 * Custom fields (Shopify: Settings › Custom data): the merchant's own fields
 * for products and variants — what used to take a new column and a release.
 */
export function CustomFieldsPage() {
  const { can } = useAuth()
  const canManage = can('custom_data.manage')
  const [owner, setOwner] = useState<OwnerType>('product')
  const [editing, setEditing] = useState<Definition | 'new' | null>(null)
  const [removing, setRemoving] = useState<Definition | null>(null)
  const { flash, success, error: flashError, clear } = useFlash()
  const definitions = useDefinitions(owner)
  const types = useFieldTypes()
  const remove = useDeleteDefinition()
  const pin = useSetPinned()
  const rows = definitions.data?.definitions ?? []

  const togglePin = (definition: Definition) => {
    const pinned = rows.filter((row) => row.pinned).sort((a, b) => (a.pinned_position ?? 0) - (b.pinned_position ?? 0)).map((row) => row.id)
    const ids = definition.pinned ? pinned.filter((id) => id !== definition.id) : [...pinned, definition.id]
    pin.mutate({ owner_type: owner, ids }, { onError: (caught) => flashError(errorMessage(caught)) })
  }

  return (
    <Box>
      <PageHeader
        title="Custom fields"
        subtitle="Fields of your own on products and variants — material, care, size chart, anything"
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              Add field
            </Button>
          )
        }
      />
      <Card>
        <Tabs value={owner} onChange={(_event, next) => setOwner(next)} sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="product" label="Products" />
          <Tab value="variant" label="Variants" />
        </Tabs>
        {definitions.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ mb: 1 }}>No {owner} fields yet.</Typography>
            <Typography variant="body2" color="text.secondary">
              A field shows on every {owner}'s page in Products (new), typed and checked — text, a dropdown, a number, a measurement, a file, a link to another product…
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Shows for</TableCell>
                <TableCell align="right">In use</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: canManage ? 'pointer' : 'default' }} onClick={() => canManage && setEditing(row)}>
                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    <Tooltip title={row.pinned ? 'Pinned: shown first on the product page' : 'Pin to show first'}>
                      <span>
                        <IconButton size="small" onClick={() => togglePin(row)} disabled={!canManage || pin.isPending}>
                          {row.pinned ? <PushPinIcon fontSize="small" color="primary" /> : <PushPinOutlinedIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {row.name}
                      {row.required && ' *'}
                    </Typography>
                    {row.description && <Typography variant="caption">{row.description}</Typography>}
                  </TableCell>
                  <TableCell>
                    {typeLabel(row.type, types.data)}
                    {row.validations.choices?.length ? <Chip size="small" label={`${row.validations.choices.length} choices`} sx={{ ml: 1 }} /> : null}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {row.full_key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {[...(row.constraints?.product_types ?? []), ...(row.constraints?.categories ?? []).map((code) => code.split('/').pop())].join(', ') || 'All'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{row.values_count ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && (
        <DefinitionDialog
          owner={owner}
          definition={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null)
            success(`${name} saved`)
          }}
          onRemove={(definition) => {
            setEditing(null)
            setRemoving(definition)
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Delete ${removing?.name ?? 'field'}?`}
        body={removing?.values_count ? `The values ${removing.values_count} ${owner}(s) have in it are deleted too. This cannot be undone.` : 'No product has a value in it yet.'}
        confirmLabel="Delete field"
        destructive
        typeToConfirm={removing?.values_count ? removing.name : undefined}
        busy={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              success(`${removing.name} deleted`)
              setRemoving(null)
            },
            onError: (caught) => flashError(errorMessage(caught)),
          })
        }
      />
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

function DefinitionDialog({ owner, definition, onClose, onSaved, onRemove }: { owner: OwnerType; definition: Definition | null; onClose(): void; onSaved(name: string): void; onRemove(definition: Definition): void }) {
  const save = useSaveDefinition(definition?.id ?? null)
  const [name, setName] = useState(definition?.name ?? '')
  const [key, setKey] = useState(definition?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(Boolean(definition))
  const [namespace, setNamespace] = useState(definition?.namespace ?? 'custom')
  const [description, setDescription] = useState(definition?.description ?? '')
  const [type, setType] = useState(definition?.type ?? 'single_line_text_field')
  const [validations, setValidations] = useState<Validations>(definition?.validations ?? {})
  const [flags, setFlags] = useState({
    required: definition?.required ?? false,
    storefront: definition?.storefront ?? true,
    filterable: definition?.filterable ?? false,
    unique_values: definition?.unique_values ?? false,
    pinned: definition?.pinned ?? true,
  })
  const [productTypes, setProductTypes] = useState<string[]>(definition?.constraints?.product_types ?? [])
  const [typeInput, setTypeInput] = useState('')
  const typeSuggestions = useSuggestions('product_type', typeInput)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const { base, list } = parseFieldType(type)

  const submit = () => {
    setErrors({})
    setMessage(null)
    save.mutate(
      {
        owner_type: owner,
        name,
        namespace,
        key: key || keyFromName(name),
        description: description || null,
        type,
        validations,
        constraints: owner === 'product' && productTypes.length ? { product_types: productTypes } : null,
        ...flags,
        unique_values: flags.unique_values && UNIQUE_CAPABLE.has(base) && !list,
      },
      {
        onSuccess: () => onSaved(name),
        onError: (caught) => {
          setErrors(detailErrors(caught))
          setMessage(errorMessage(caught))
        },
      },
    )
  }

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{definition ? `Edit ${definition.name}` : `Add a ${owner} field`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {message && <Alert severity="error">{message}</Alert>}
          <TextField
            autoFocus
            label="Name"
            placeholder="Care instructions"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (!keyTouched) setKey(keyFromName(event.target.value))
            }}
            error={Boolean(errors.name)}
            helperText={errors.name}
          />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Namespace" value={namespace} onChange={(event) => setNamespace(event.target.value)} error={Boolean(errors.namespace)} helperText={errors.namespace} sx={{ width: 160 }} />
            <TextField
              size="small"
              fullWidth
              label="Key"
              value={key}
              onChange={(event) => {
                setKeyTouched(true)
                setKey(event.target.value)
              }}
              error={Boolean(errors.key)}
              helperText={errors.key ?? `Themes read it as product.metafields.${namespace || 'custom'}.${key || 'key'}`}
            />
          </Stack>
          <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} helperText="Shown under the field, for whoever fills it in" />
          <TypePicker value={type} onChange={setType} error={errors.type} helperText={definition?.values_count ? 'Values are already entered: the type can only swap between single- and multi-line text.' : undefined} />
          <Divider textAlign="left">
            <Typography variant="caption">Rules</Typography>
          </Divider>
          <ValidationsEditor type={type} value={validations} onChange={setValidations} errors={errors} />
          <Divider textAlign="left">
            <Typography variant="caption">Options</Typography>
          </Divider>
          <Box>
            <FormControlLabel control={<Checkbox checked={flags.pinned} onChange={(event) => setFlags({ ...flags, pinned: event.target.checked })} />} label="Pin to the top of the product page" />
            <FormControlLabel control={<Checkbox checked={flags.required} onChange={(event) => setFlags({ ...flags, required: event.target.checked })} />} label="Required — a product cannot be saved without it" />
            <FormControlLabel control={<Checkbox checked={flags.storefront} onChange={(event) => setFlags({ ...flags, storefront: event.target.checked })} />} label="Readable by the storefront (themes, Storefront API)" />
            <FormControlLabel control={<Checkbox checked={flags.filterable} onChange={(event) => setFlags({ ...flags, filterable: event.target.checked })} />} label="Use as a filter on collection and search pages" />
            {UNIQUE_CAPABLE.has(base) && !list && (
              <FormControlLabel control={<Checkbox checked={flags.unique_values} onChange={(event) => setFlags({ ...flags, unique_values: event.target.checked })} />} label="Unique — no two products may have the same value" />
            )}
          </Box>
          {owner === 'product' && (
            <Autocomplete
              multiple
              freeSolo
              options={typeSuggestions.data?.values ?? []}
              value={productTypes}
              inputValue={typeInput}
              onInputChange={(_event, next) => setTypeInput(next)}
              onChange={(_event, next) => setProductTypes(next.map(String))}
              renderInput={(params) => <TextField {...params} size="small" label="Show only for product types" placeholder="All products" helperText="Leave empty to show this field on every product" />}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {definition && (
          <Button color="error" onClick={() => onRemove(definition)} sx={{ mr: 'auto' }}>
            Delete field
          </Button>
        )}
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!name.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
