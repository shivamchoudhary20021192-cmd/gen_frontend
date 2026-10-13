import AddIcon from '@mui/icons-material/Add'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
import SearchIcon from '@mui/icons-material/Search'
import {
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
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { formatPriceRange, formatRelative } from '../../lib/format'
import { STATUS_COLOR, STATUS_LABEL, type CatalogListItem, type CatalogStatus } from './types'
import { useAdoptClassic, useCatalogBulk, useCatalogList, useClassicCandidates, type CatalogListParams } from './useCatalog'

const SORTS: { value: string; label: string }[] = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
]

export function CatalogProductsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { flash, success, error: flashError, clear } = useFlash()
  const [tab, setTab] = useState<'all' | CatalogStatus>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('updated_desc')
  const [cursors, setCursors] = useState<string[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [bulkMenu, setBulkMenu] = useState<HTMLElement | null>(null)
  const [tagDialog, setTagDialog] = useState<'add_tags' | 'remove_tags' | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setCursors([])
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params: CatalogListParams = useMemo(
    () => ({ status: tab === 'all' ? undefined : tab, q: search || undefined, sort, after: cursors[cursors.length - 1], limit: 50 }),
    [tab, search, sort, cursors],
  )
  const list = useCatalogList(params)
  const bulk = useCatalogBulk()
  const rows = list.data?.products ?? []
  const counts = list.data?.counts
  // Counts come with the first page only; keep them while paging.
  const [lastCounts, setLastCounts] = useState(counts)
  if (counts && counts !== lastCounts) setLastCounts(counts)

  const runBulk = (input: { action: string; status?: CatalogStatus; tags?: string[] }) => {
    setBulkMenu(null)
    bulk.mutate(
      { ids: selected, ...input },
      {
        onSuccess: (result) => {
          setSelected([])
          if (result.failed.length) flashError(`${result.done.length} changed; ${result.failed.length} not: ${result.failed[0].error}`)
          else success(`${result.done.length} product${result.done.length === 1 ? '' : 's'} changed`)
        },
        onError: (caught) => flashError(errorMessage(caught)),
      },
    )
  }

  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id))

  return (
    <Box>
      <PageHeader
        title="Products (new)"
        subtitle="Options, variants and fields of your own — for any kind of product"
        actions={
          <>
            {can('products.update') && (
              <Button variant="outlined" onClick={() => setMoveOpen(true)}>
                Move from classic
              </Button>
            )}
            {can('products.create') && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/catalog/products/new')}>
                Add product
              </Button>
            )}
          </>
        }
      />

      <Card>
        <Tabs
          value={tab}
          onChange={(_event, next) => {
            setTab(next)
            setCursors([])
            setSelected([])
          }}
          variant="scrollable"
          sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          {(['all', 'active', 'draft', 'unlisted', 'archived'] as const).map((key) => (
            <Tab key={key} value={key} label={`${key === 'all' ? 'All' : STATUS_LABEL[key]}${lastCounts ? ` (${lastCounts[key] ?? 0})` : ''}`} />
          ))}
        </Tabs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="Search title, handle, vendor, type, SKU or barcode"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField
            select
            size="small"
            label="Sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value)
              setCursors([])
            }}
            sx={{ minWidth: 200 }}
          >
            {SORTS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {selected.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ px: 2, pb: 1.5, alignItems: 'center' }}>
            <Typography variant="body2">{selected.length} selected</Typography>
            <Button size="small" variant="outlined" onClick={() => runBulk({ action: 'set_status', status: 'active' })} disabled={bulk.isPending}>
              Set as active
            </Button>
            <Button size="small" variant="outlined" onClick={() => runBulk({ action: 'set_status', status: 'draft' })} disabled={bulk.isPending}>
              Set as draft
            </Button>
            <Button size="small" variant="outlined" onClick={(event) => setBulkMenu(event.currentTarget)} disabled={bulk.isPending}>
              More actions
            </Button>
            <Menu anchorEl={bulkMenu} open={Boolean(bulkMenu)} onClose={() => setBulkMenu(null)}>
              <MenuItem onClick={() => runBulk({ action: 'set_status', status: 'unlisted' })}>Set as unlisted</MenuItem>
              <MenuItem onClick={() => runBulk({ action: 'set_status', status: 'archived' })}>Archive</MenuItem>
              <MenuItem
                onClick={() => {
                  setBulkMenu(null)
                  setTagDialog('add_tags')
                }}
              >
                Add tags
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setBulkMenu(null)
                  setTagDialog('remove_tags')
                }}
              >
                Remove tags
              </MenuItem>
              {can('products.delete') && (
                <MenuItem sx={{ color: 'error.main' }} onClick={() => window.confirm(`Delete ${selected.length} product(s)? Past orders keep their lines.`) && runBulk({ action: 'delete' })}>
                  Delete
                </MenuItem>
              )}
            </Menu>
          </Stack>
        )}

        {list.isError && <Alert severity="error" sx={{ m: 2 }}>{errorMessage(list.error)}</Alert>}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox checked={allSelected} indeterminate={selected.length > 0 && !allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((row) => row.id))} />
                </TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Inventory</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {!list.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {search || tab !== 'all' ? 'No products match.' : 'No products here yet.'}
                    </Typography>
                    {!search && tab === 'all' && (
                      <Typography variant="body2" color="text.secondary">
                        Add a product, or move your classic products over — they keep their orders, stock and reviews.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <ProductRow
                  key={row.id}
                  row={row}
                  selected={selected.includes(row.id)}
                  onSelect={() => setSelected((current) => (current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]))}
                  onOpen={() => navigate(`/catalog/products/${row.id}`)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" spacing={1} sx={{ p: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption">{list.data?.total !== null && list.data?.total !== undefined ? `${list.data.total} product${list.data.total === 1 ? '' : 's'}` : ''}</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={cursors.length === 0} onClick={() => setCursors((current) => current.slice(0, -1))}>
              Previous
            </Button>
            <Button size="small" disabled={!list.data?.next} onClick={() => list.data?.next && setCursors((current) => [...current, list.data!.next!])}>
              Next
            </Button>
          </Stack>
        </Stack>
      </Card>

      {tagDialog && <TagsDialog action={tagDialog} count={selected.length} onClose={() => setTagDialog(null)} onApply={(tags) => {
        setTagDialog(null)
        runBulk({ action: tagDialog, tags })
      }} />}
      {moveOpen && <MoveClassicDialog onClose={() => setMoveOpen(false)} onDone={(message) => success(message)} onError={flashError} />}
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

function ProductRow({ row, selected, onSelect, onOpen }: { row: CatalogListItem; selected: boolean; onSelect(): void; onOpen(): void }) {
  const stock = row.inventory.tracked_variants === 0 ? 'Not tracked' : `${row.inventory.available} in stock${row.variant_count > 1 ? ` for ${row.variant_count} variants` : ''}`
  return (
    <TableRow hover selected={selected} onClick={onOpen} sx={{ cursor: 'pointer' }}>
      <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={selected} onChange={onSelect} />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
            {row.image ? <Box component="img" src={row.image} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageNotSupportedIcon fontSize="small" color="disabled" />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {row.title}
            </Typography>
            {row.product_type && <Typography variant="caption">{row.product_type}</Typography>}
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip size="small" label={STATUS_LABEL[row.status]} color={STATUS_COLOR[row.status]} />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color={row.inventory.tracked_variants > 0 && row.inventory.available <= 0 ? 'error' : undefined}>
          {stock}
        </Typography>
      </TableCell>
      <TableCell>{row.price_min === null ? '—' : formatPriceRange(row.price_min, row.price_max)}</TableCell>
      <TableCell>
        <Typography variant="body2" noWrap title={row.category?.full_name}>
          {row.category?.name ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>{row.vendor ?? '—'}</TableCell>
      <TableCell>
        <Typography variant="caption">{formatRelative(row.updated_at)}</Typography>
      </TableCell>
    </TableRow>
  )
}

function TagsDialog({ action, count, onClose, onApply }: { action: 'add_tags' | 'remove_tags'; count: number; onClose(): void; onApply(tags: string[]): void }) {
  const [text, setText] = useState('')
  const tags = text.split(',').map((tag) => tag.trim()).filter(Boolean)
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{action === 'add_tags' ? 'Add tags' : 'Remove tags'} ({count} products)</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth label="Tags" placeholder="sale, summer" helperText="Separate tags with commas" value={text} onChange={(event) => setText(event.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={tags.length === 0} onClick={() => onApply(tags)}>
          {action === 'add_tags' ? 'Add' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Classic products → Products (new). A moved product keeps its id, so its
 * orders, stock, reviews and collections stay with it; from then on the classic
 * editor shows it read-only. It cannot be moved back, so this says so first.
 */
function MoveClassicDialog({ onClose, onDone, onError }: { onClose(): void; onDone(message: string): void; onError(message: string): void }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [failures, setFailures] = useState<{ id: number; error: string }[]>([])
  const candidates = useClassicCandidates(q, true)
  const adopt = useAdoptClassic()
  const rows = candidates.data?.products ?? []
  const toggle = (id: number) => setPicked((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]))

  return (
    <Dialog open onClose={adopt.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move classic products</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          A moved product keeps its id, orders, stock, reviews and collections, and is edited here from then on — the classic editor shows it read-only. Moving cannot be undone.
          Beauty details (INCI, skin types…) stay on the classic record; add custom fields for the ones you want to keep editing.
        </Alert>
        <TextField size="small" fullWidth placeholder="Search classic products" value={q} onChange={(event) => setQ(event.target.value)} sx={{ mb: 1 }} />
        {failures.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {failures.map((failure) => (
              <div key={failure.id}>{failure.error}</div>
            ))}
          </Alert>
        )}
        {candidates.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            {q ? 'No classic products match.' : 'Every classic product has been moved.'}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
            {rows.map((row) => (
              <ListItemButton key={row.id} onClick={() => toggle(row.id)}>
                <ListItemIcon>
                  <Checkbox edge="start" checked={picked.includes(row.id)} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText primary={row.title} secondary={`${row.status} · ${row.variant_count} variant${row.variant_count === 1 ? '' : 's'}`} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" sx={{ flex: 1, pl: 1 }}>
          {candidates.data ? `${candidates.data.remaining} not moved yet` : ''}
        </Typography>
        <Button onClick={() => setPicked(picked.length === rows.length ? [] : rows.map((row) => row.id))} disabled={rows.length === 0}>
          {picked.length === rows.length && rows.length > 0 ? 'Select none' : 'Select all shown'}
        </Button>
        <Button onClick={onClose} disabled={adopt.isPending}>
          Close
        </Button>
        <Button
          variant="contained"
          disabled={picked.length === 0 || adopt.isPending}
          onClick={() =>
            adopt.mutate(picked, {
              onSuccess: (result) => {
                setPicked([])
                setFailures(result.failed)
                if (result.done.length) onDone(`${result.done.length} product${result.done.length === 1 ? '' : 's'} moved`)
                if (!result.failed.length) onClose()
              },
              onError: (caught) => onError(errorMessage(caught)),
            })
          }
        >
          {adopt.isPending ? 'Moving…' : `Move ${picked.length || ''}`.trim()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
