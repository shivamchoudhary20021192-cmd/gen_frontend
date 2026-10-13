import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ArrowDownward as DownIcon,
  ArrowUpward as UpIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material'
import { PageHeader } from '../../../components/PageHeader'
import { tokens } from '../../../theme'
import {
  useDeleteShelf,
  useReorderShelves,
  useShelfCatalogue,
  useShelves,
  type Shelf,
} from './useShelves'

/**
 * Every shelf on the storefront, grouped by the page it belongs to.
 *
 * Grouped rather than filtered, because the question a merchandiser actually
 * has is "what does the home page look like" — and a single flat list sorted
 * by a placement column makes them assemble that in their head. The order
 * inside each group is the order on the page, and it is moved with the arrows
 * rather than a drag handle: a list of five things does not need a drag
 * library, and arrows work on a phone and with a keyboard.
 */

const PLACEMENT_BLURB: Record<string, string> = {
  home: 'Down the front page, in this order.',
  shop: 'On the main product listing.',
  category: 'On category pages — all of them, or one.',
  collection: 'On collection pages — all of them, or one.',
  product: 'Below the detail on a product page.',
}

export function ShelvesPage() {
  const shelves = useShelves()
  const catalogue = useShelfCatalogue()
  const reorder = useReorderShelves()
  const remove = useDeleteShelf()
  const [confirming, setConfirming] = useState<Shelf | null>(null)

  const grouped = useMemo(() => {
    const rows = shelves.data?.shelves ?? []
    const order = catalogue.data?.placements.map((placement) => placement.key) ?? []
    const groups = new Map<string, Shelf[]>()
    for (const key of order) groups.set(key, [])
    for (const shelf of rows) {
      const list = groups.get(shelf.placement)
      if (list) list.push(shelf)
      else groups.set(shelf.placement, [shelf])
    }
    return [...groups.entries()]
  }, [shelves.data, catalogue.data])

  function move(group: Shelf[], index: number, delta: number) {
    const next = [...group]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    // Only this placement's ids are sent. Sending every shelf would renumber
    // the other groups against an order this screen never showed.
    reorder.mutate(next.map((shelf) => shelf.id))
  }

  return (
    <Box>
      <PageHeader
        title="Shelves"
        subtitle="The rows of products on the storefront — what is in them, and how they are drawn"
        actions={
          <Button
            component={RouterLink}
            to="/merchandising/shelves/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            New shelf
          </Button>
        }
      />

      {shelves.isError && <Alert severity="error">The shelves could not be loaded.</Alert>}
      {shelves.isLoading && <CircularProgress size={22} />}

      {!shelves.isLoading &&
        grouped.map(([placement, rows]) => {
          const label =
            catalogue.data?.placements.find((item) => item.key === placement)?.label ?? placement
          return (
            <Box key={placement} sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
                <Typography variant="subtitle2">{label}</Typography>
                <Typography variant="caption" sx={{ color: tokens.subdued }}>
                  {PLACEMENT_BLURB[placement] ?? ''}
                </Typography>
              </Stack>

              {rows.length === 0 ? (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      Nothing here yet.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <Stack spacing={1}>
                  {rows.map((shelf, index) => (
                    <Card key={shelf.id} variant="outlined" data-shelf-row={shelf.id}>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Stack sx={{ flexShrink: 0 }}>
                            <IconButton
                              size="small"
                              aria-label={`Move ${shelf.title} up`}
                              disabled={index === 0 || reorder.isPending}
                              onClick={() => move(rows, index, -1)}
                            >
                              <UpIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`Move ${shelf.title} down`}
                              disabled={index === rows.length - 1 || reorder.isPending}
                              onClick={() => move(rows, index, 1)}
                            >
                              <DownIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {shelf.title}
                              </Typography>
                              {shelf.eyebrow && (
                                <Typography variant="caption" sx={{ color: tokens.subdued }}>
                                  {shelf.eyebrow}
                                </Typography>
                              )}
                            </Stack>

                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.75 }}
                            >
                              <Chip size="small" label={shelf.source_label} data-shelf-source={shelf.source} />
                              <Chip size="small" variant="outlined" label={shelf.layout} />
                              {shelf.effective_window_days !== null && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`last ${shelf.effective_window_days} days`}
                                />
                              )}
                              <Chip size="small" variant="outlined" label={`up to ${shelf.max_products}`} />
                              {shelf.pin_count > 0 && (
                                <Tooltip title="Pinned products come first; the rule fills the rest">
                                  <Chip size="small" color="primary" label={`${shelf.pin_count} pinned`} />
                                </Tooltip>
                              )}
                              {shelf.source_collection_title && (
                                <Chip size="small" variant="outlined" label={shelf.source_collection_title} />
                              )}
                            </Stack>

                            {shelf.hidden_because && (
                              <Typography
                                variant="caption"
                                data-shelf-hidden
                                sx={{ display: 'block', mt: 0.75, color: tokens.warning }}
                              >
                                Not on the site — {shelf.hidden_because.toLowerCase()}
                              </Typography>
                            )}
                          </Box>

                          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                            <IconButton
                              size="small"
                              component={RouterLink}
                              to={`/merchandising/shelves/${shelf.id}?preview=1`}
                              aria-label={`Preview ${shelf.title}`}
                            >
                              <PreviewIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              component={RouterLink}
                              to={`/merchandising/shelves/${shelf.id}`}
                              aria-label={`Edit ${shelf.title}`}
                            >
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`Delete ${shelf.title}`}
                              onClick={() => setConfirming(shelf)}
                            >
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Box>
          )
        })}

      {/* Confirmed rather than undone: a shelf is a page layout, and putting one
          back means remembering the rule, the window and the pins it had. */}
      <Dialog open={confirming !== null} onClose={() => setConfirming(null)}>
        <DialogTitle>Delete this shelf?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{confirming?.title}” will stop appearing on the storefront. The products themselves are
            untouched.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(null)}>Keep it</Button>
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={() => {
              if (confirming) remove.mutate(confirming.id, { onSettled: () => setConfirming(null) })
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
